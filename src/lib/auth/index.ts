import type { AuthClient } from "./contracts";
import { MockAuthClient } from "./mock/mockAuthClient";

export type { AuthClient, AuthListener, AuthState } from "./contracts";

let instance: AuthClient | null = null;

export function getAuthClient(): AuthClient {
  if (instance) return instance;
  const backend = (import.meta.env?.VITE_AUTH_BACKEND ?? "mock") as string;
  switch (backend) {
    case "mock":
      instance = new MockAuthClient();
      break;
    default:
      console.warn(
        `[auth] Unknown VITE_AUTH_BACKEND="${backend}", using mock client.`,
      );
      instance = new MockAuthClient();
  }
  return instance;
}

export function __resetAuthClientForTests() {
  instance = null;
}
