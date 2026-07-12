/** Minimal typings for the parts of MindAR we use (browser dist build). */
declare module "mind-ar/dist/mindar-image.prod.js" {
  /** Compiles target images into a .mind feature file (runs in the browser). */
  export class Compiler {
    compileImageTargets(
      images: HTMLImageElement[],
      onProgress: (progress: number) => void
    ): Promise<unknown>;
    exportData(): Promise<ArrayBuffer>;
  }

  export interface MindARControllerUpdate {
    type: string;
    targetIndex?: number;
    worldMatrix?: number[] | null;
  }

  /** Core tracking controller — camera-frame in, target world matrices out. */
  export class Controller {
    inputWidth: number;
    inputHeight: number;
    constructor(options: {
      inputWidth: number;
      inputHeight: number;
      maxTrack?: number;
      filterMinCF?: number | null;
      filterBeta?: number | null;
      warmupTolerance?: number | null;
      missTolerance?: number | null;
      onUpdate?: (data: MindARControllerUpdate) => void;
    });
    addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>;
    getProjectionMatrix(): number[];
    dummyRun(video: HTMLVideoElement): Promise<void>;
    processVideo(video: HTMLVideoElement): void;
    stopProcessVideo(): void;
    dispose(): void;
  }
}
