/**
 * Registry of pure compute functions a workflow is allowed to call from a
 * `compute` step. Kept as an explicit allowlist (same security model as
 * DataClient method dispatch) so workflow definitions can't invoke arbitrary
 * code by name.
 */

import {
  buildRows,
  DEMO_CSV_SAMPLE,
  parseCsv,
  proposeMappings,
} from "../../pm/portfolioImport";
import { getStateDefaults } from "../../pm/stateConfig";
import type { UsStateCode } from "../../data/types";

export type ComputeFn = (...args: unknown[]) => unknown;

const REGISTRY: Record<string, ComputeFn> = {
  /**
   * Takes a CSV upload object `{fileName, mimeType, textContent}` (or null
   * to fall back to the demo sample) and returns `{headers, rows, mappings,
   * parsedRows}` ready to drop into a PortfolioImport.
   */
  "portfolio.parseUpload": (upload: unknown) => {
    const textContent =
      (upload as { textContent?: string } | null)?.textContent ??
      DEMO_CSV_SAMPLE;
    const parsed = parseCsv(textContent);
    const mappings = proposeMappings(parsed.headers);
    const rows = buildRows(parsed, mappings);
    return {
      headers: parsed.headers,
      rawRowCount: parsed.rows.length,
      mappings,
      rows,
      fileName:
        (upload as { fileName?: string } | null)?.fileName ?? "demo.csv",
      sourceFormat: "csv",
    };
  },

  /** Return state-specific defaults the onboarding workflow should prefill. */
  "pm.stateDefaults": (state: unknown) =>
    getStateDefaults(state as UsStateCode),
};

export function callCompute(fn: string, args: unknown[]): unknown {
  const impl = REGISTRY[fn];
  if (!impl) {
    throw new Error(`Workflow tried to call unknown compute function "${fn}"`);
  }
  return impl(...args);
}

export function isAllowedComputeFn(fn: string): boolean {
  return fn in REGISTRY;
}
