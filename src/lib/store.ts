/**
 * Persistence layer — a JSON file on disk, guarded by a promise queue so
 * concurrent route handlers never interleave writes.
 *
 * Everything goes through the `ExperienceStore` interface, so replacing this
 * with a Supabase implementation later only means writing a second class
 * that satisfies the same interface and swapping `getStore()`.
 */
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  Experience,
  ExperienceInput,
  ExperienceWithStats,
  ViewEvent,
} from "./types";
import { SAMPLE_MODEL_NAME, SAMPLE_MODEL_URL } from "./types";

export interface ExperienceStore {
  list(): Promise<ExperienceWithStats[]>;
  get(id: string): Promise<ExperienceWithStats | null>;
  create(input: ExperienceInput): Promise<Experience>;
  update(id: string, patch: Partial<ExperienceInput>): Promise<Experience | null>;
  remove(id: string): Promise<boolean>;
  trackView(id: string, event: ViewEvent): Promise<boolean>;
}

interface DBShape {
  experiences: ExperienceWithStats[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
/** Keep at most this many raw events per experience (aggregates stay accurate via totalViews) */
const MAX_EVENTS = 500;

class JsonFileStore implements ExperienceStore {
  private queue: Promise<unknown> = Promise.resolve();

  /** Serialize all read-modify-write cycles */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => {});
    return next;
  }

  private async load(): Promise<DBShape> {
    try {
      const raw = await fs.readFile(DB_FILE, "utf8");
      return JSON.parse(raw) as DBShape;
    } catch {
      const seeded: DBShape = { experiences: [seedExperience()] };
      await this.persist(seeded);
      return seeded;
    }
  }

  private async persist(db: DBShape): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, DB_FILE);
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
}

function stripAnalytics(exp: ExperienceWithStats): Experience {
  const { analytics, ...rest } = exp;
  void analytics;
  return rest;
}

/** A ready-made experience so the end-to-end flow is testable on first run */
function seedExperience(): ExperienceWithStats {
  const now = new Date().toISOString();
  return {
    id: "demo-knot",
    title: "Aurora Knot — sample",
    description:
      "A bundled sample 3D model. Open it on your phone to try AR immediately, no upload needed.",
    type: "model",
    status: "published",
    content: { assetUrl: SAMPLE_MODEL_URL, assetName: SAMPLE_MODEL_NAME },
    createdAt: now,
    updatedAt: now,
    analytics: { totalViews: 0, lastViewedAt: null, events: [] },
  };
}

// Reuse one instance across dev hot-reloads
const globalStore = globalThis as unknown as { __holoformStore?: ExperienceStore };

export function getStore(): ExperienceStore {
  if (!globalStore.__holoformStore) {
    globalStore.__holoformStore = new JsonFileStore();
  }
  return globalStore.__holoformStore;
}
