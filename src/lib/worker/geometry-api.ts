import * as Comlink from "comlink";
import type { GeometryWorkerAPI } from "./geometry.worker";

let worker: Worker | null = null;
let api: Comlink.Remote<GeometryWorkerAPI> | null = null;

/**
 * Lazily creates a singleton WebWorker + Comlink proxy.
 * The worker is only created when first needed (to save bandwidth).
 */
export function getGeometryAPI(): Comlink.Remote<GeometryWorkerAPI> {
  if (api) return api;

  worker = new Worker(
    new URL("./geometry.worker.ts", import.meta.url),
    { type: "module" }
  );
  api = Comlink.wrap<GeometryWorkerAPI>(worker);
  return api;
}

/** Terminate the worker and release resources */
export function terminateGeometryWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    api = null;
  }
}
