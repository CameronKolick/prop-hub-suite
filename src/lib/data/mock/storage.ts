/**
 * Tiny localStorage-backed persistence helper for the mock data client.
 *
 * Everything the mock client holds lives under a single JSON blob keyed by
 * STORAGE_KEY so we can wipe state cleanly in dev. Photos are kept as
 * data URLs so they survive page reloads without needing a blob store.
 */

const STORAGE_KEY = "prop-hub-suite.mock-data.v2";

export interface MockStore {
  properties: Record<string, unknown>;
  houseWatchers: Record<string, unknown>;
  checkTemplates: Record<string, unknown>;
  checkSessions: Record<string, unknown>;
  checkResponses: Record<string, unknown>;
  photos: Record<string, unknown>;
  workflowRuns: Record<string, unknown>;

  pmCompanies: Record<string, unknown>;
  pmTeam: Record<string, unknown>;
  pmFeeSchedules: Record<string, unknown>;
  pmPolicies: Record<string, unknown>;
  owners: Record<string, unknown>;
  units: Record<string, unknown>;
  leases: Record<string, unknown>;
  tenants: Record<string, unknown>;
  portfolioImports: Record<string, unknown>;
}

export function emptyStore(): MockStore {
  return {
    properties: {},
    houseWatchers: {},
    checkTemplates: {},
    checkSessions: {},
    checkResponses: {},
    photos: {},
    workflowRuns: {},
    pmCompanies: {},
    pmTeam: {},
    pmFeeSchedules: {},
    pmPolicies: {},
    owners: {},
    units: {},
    leases: {},
    tenants: {},
    portfolioImports: {},
  };
}

export function loadStore(): MockStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockStore;
  } catch {
    return null;
  }
}

export function saveStore(store: MockStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or serialization failure — mock is best-effort persistence.
  }
}

export function clearStore(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === "undefined") {
    const buf = await blob.arrayBuffer();
    const b64 = btoa(
      new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""),
    );
    return `data:${blob.type || "application/octet-stream"};base64,${b64}`;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
