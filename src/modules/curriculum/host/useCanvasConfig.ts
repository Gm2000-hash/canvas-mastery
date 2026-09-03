import type { CanvasConfig } from "@/modules/curriculum/host/canvas-api";

/** Canvas LMS is not connected in this project. */
export function useCanvasConfig() {
  return { config: null as CanvasConfig, isConfigured: false, loading: false };
}
