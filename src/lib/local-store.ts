/**
 * Local development store — a JSON file on disk plus a promise queue so
 * concurrent route handlers never interleave writes.
 *
 * NOT for production hosting: serverless platforms (Vercel, etc.) have
 * read-only, ephemeral filesystems, so writes throw and data disappears
 * between deployments. `getStore()` only selects this store when Supabase
 * is not configured.
 */
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { ExperienceStore, ScanResult } from "./store";
import { seedExperience, stripAnalytics } from "./store";
import type {
  Experience,
  ExperienceInput,
  ExperienceWithStats,
  ScanJob,
  ViewEvent,
} from "./types";

interface DBShape {
  experiences: ExperienceWithStats[];
  scanJobs?: ScanJob[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
/** Keep at most this many raw events per experience (aggregates stay accurate via totalViews) */
const MAX_EVENTS = 500;

function isFsCode(e: unknown, ...codes: string[]): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    codes.includes(String((e as { code: unknown }).code))
  );
}

export class JsonFileStore implements ExperienceStore {
  private queue: Promise<unknown> = Promise.resolve();

  /** Serialize all read-modify-write cycles */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => {});
    return next;
  }

  private async load(): Promise<DBShape> {
    let raw: string;
    try {
      raw = await fs.readFile(DB_FILE, "utf8");
    } catch (e) {
      if (isFsCode(e, "ENOENT")) {
        // First run — seed a demo experience so the flow is testable immediately
        const seeded: DBShape = { experiences: [seedExperience()] };
        await this.persist(seeded);
        return seeded;
      }
      throw new Error(`Local store: could not read ${DB_FILE}: ${String(e)}`);
    }
    try {
      return JSON.parse(raw) as DBShape;
    } catch {
      // Never silently wipe user data on a corrupt file
      throw new Error(
        `Local store: ${DB_FILE} contains invalid JSON. Fix or delete the file (deleting loses local data).`
      );
    }
  }

  private async persist(db: DBShape): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await fs.rename(tmp, DB_FILE);
    } catch (e) {
      if (isFsCode(e, "EROFS", "EACCES", "EPERM")) {
        throw new Error(
          "Local store: the filesystem is read-only. This happens on serverless hosts " +
            "(Vercel, etc.) — the local JSON store only works on your own machine. " +
            "Configure Supabase (see SETUP.md) for production."
        );
      }
      throw new Error(`Local store: write failed: ${String(e)}`);
    }
  }

  list(): Promise<ExperienceWithStats[]> {
    return this.enqueue(async () => {
      const db = await this.load();
      return [...db.experiences].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
    });
  }

  get(id: string): Promise<ExperienceWithStats | null> {
    return this.enqueue(async () => {
      const db = await this.load();
      return db.experiences.find((e) => e.id === id) ?? null;
    });
  }

  create(input: ExperienceInput): Promise<Experience> {
    return this.enqueue(async () => {
      const db = await this.load();
      const now = new Date().toISOString();
      const exp: ExperienceWithStats = {
        id: nanoid(10),
        title: input.title.trim() || "Untitled experience",
        description: input.description?.trim() ?? "",
        type: input.type,
        status: input.status ?? "draft",
        thumbnail: input.thumbnail,
        content: input.content ?? {},
        createdAt: now,
        updatedAt: now,
        analytics: { totalViews: 0, lastViewedAt: null, events: [] },
      };
      db.experiences.push(exp);
      await this.persist(db);
      return stripAnalytics(exp);
    });
  }

  update(id: string, patch: Partial<ExperienceInput>): Promise<Experience | null> {
    return this.enqueue(async () => {
      const db = await this.load();
      const exp = db.experiences.find((e) => e.id === id);
      if (!exp) return null;
      if (patch.title !== undefined) exp.title = patch.title.trim() || exp.title;
      if (patch.description !== undefined) exp.description = patch.description;
      if (patch.type !== undefined) exp.type = patch.type;
      if (patch.status !== undefined) exp.status = patch.status;
      if (patch.thumbnail !== undefined) exp.thumbnail = patch.thumbnail;
      if (patch.content !== undefined)
        exp.content = { ...exp.content, ...patch.content };
      exp.updatedAt = new Date().toISOString();
      await this.persist(db);
      return stripAnalytics(exp);
    });
  }

  remove(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const db = await this.load();
      const before = db.experiences.length;
      db.experiences = db.experiences.filter((e) => e.id !== id);
      if (db.experiences.length === before) return false;
      await this.persist(db);
      return true;
    });
  }

  trackView(id: string, event: ViewEvent): Promise<boolean> {
    return this.enqueue(async () => {
      const db = await this.load();
      const exp = db.experiences.find((e) => e.id === id);
      if (!exp) return false;
      exp.analytics.totalViews += 1;
      exp.analytics.lastViewedAt = event.at;
      exp.analytics.events.push(event);
      if (exp.analytics.events.length > MAX_EVENTS) {
        exp.analytics.events = exp.analytics.events.slice(-MAX_EVENTS);
      }
      await this.persist(db);
      return true;
    });
  }

  /* --------------------------------- scans -------------------------------- */

  createScanJob(input: { title: string; frameUrls: string[] }): Promise<ScanJob> {
    return this.enqueue(async () => {
      const db = await this.load();
      db.scanJobs ??= [];
      const now = new Date().toISOString();
      const job: ScanJob = {
        id: nanoid(10),
        status: "queued",
        title: input.title.trim() || "3D scan",
        frameUrls: input.frameUrls,
        createdAt: now,
        updatedAt: now,
      };
      db.scanJobs.push(job);
      await this.persist(db);
      return job;
    });
  }

  getScanJob(id: string): Promise<ScanJob | null> {
    return this.enqueue(async () => {
      const db = await this.load();
      return db.scanJobs?.find((j) => j.id === id) ?? null;
    });
  }

  claimScanJob(): Promise<ScanJob | null> {
    return this.enqueue(async () => {
      const db = await this.load();
      const job = (db.scanJobs ?? [])
        .filter((j) => j.status === "queued")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!job) return null;
      job.status = "processing";
      job.updatedAt = new Date().toISOString();
      await this.persist(db);
      return job;
    });
  }

  completeScanJob(id: string, result: ScanResult): Promise<ScanJob | null> {
    return this.enqueue(async () => {
      const db = await this.load();
      const job = db.scanJobs?.find((j) => j.id === id);
      if (!job) return null;
      job.status = "ready";
      job.resultGlbUrl = result.resultGlbUrl;
      job.resultUsdzUrl = result.resultUsdzUrl;
      job.thumbnailUrl = result.thumbnailUrl;
      job.experienceId = result.experienceId;
      job.error = undefined;
      job.updatedAt = new Date().toISOString();
      await this.persist(db);
      return job;
    });
  }

  failScanJob(id: string, message: string): Promise<ScanJob | null> {
    return this.enqueue(async () => {
      const db = await this.load();
      const job = db.scanJobs?.find((j) => j.id === id);
      if (!job) return null;
      job.status = "failed";
      job.error = message;
      job.updatedAt = new Date().toISOString();
      await this.persist(db);
      return job;
    });
  }
}
