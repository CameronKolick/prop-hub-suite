import { MockDataClient } from "./mock/mockClient";
import type { DataClient } from "./contracts";

export type { DataClient } from "./contracts";
export * from "./types";

let instance: DataClient | null = null;

/**
 * Returns the process-wide DataClient. The backend (mock vs. Google Cloud) is
 * selected here based on env so the rest of the app never imports a concrete
 * implementation. Today only the mock exists; the Google client will be added
 * as src/lib/data/google/googleClient.ts and wired in below.
 */
export function getDataClient(): DataClient {
  if (instance) return instance;
  const backend = (import.meta.env?.VITE_DATA_BACKEND ?? "mock") as string;
  switch (backend) {
    case "mock":
      instance = new MockDataClient();
      break;
    default:
      // Unknown backend requested — fall back to mock rather than crashing dev.
      console.warn(
        `[data] Unknown VITE_DATA_BACKEND="${backend}", using mock client.`,
      );
      instance = new MockDataClient();
  }
  return instance;
}

/** Test-only: reset the cached client. */
export function __resetDataClientForTests() {
  instance = null;
}
