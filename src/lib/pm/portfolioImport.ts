/**
 * Portfolio import helpers — CSV parsing, heuristic column mapping, and
 * row building. Designed so the workflow engine can call these as pure
 * functions without touching the DataClient. AI (optional) can refine the
 * mapping but the heuristics alone get us ~80% coverage on common rent rolls.
 */

import type {
  PortfolioImportColumnMapping,
  PortfolioImportRow,
  PortfolioTargetField,
} from "../data/types";

// ---------- CSV parsing ----------

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Minimal RFC-4180 CSV parser. Handles quoted fields, embedded commas,
 * escaped quotes ("") and both \r\n and \n line endings. Good enough for the
 * rent rolls users will paste in during onboarding.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());
  const out = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows: out };
}

// ---------- Heuristic column mapping ----------

/**
 * Heuristic regex/alias map from common rent-roll column names to our
 * canonical target fields. Order matters — first match wins when multiple
 * patterns could apply.
 */
const MAPPING_HINTS: Array<{
  target: PortfolioTargetField;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    target: "property.address",
    patterns: [/^addr(ess)?$/i, /street.?address/i, /property.?address/i, /location/i],
    confidence: 0.95,
  },
  { target: "property.city", patterns: [/^city$/i], confidence: 0.95 },
  {
    target: "property.state",
    patterns: [/^state$/i, /^st$/i, /province/i],
    confidence: 0.9,
  },
  {
    target: "property.postalCode",
    patterns: [/^zip$/i, /^zip.?code$/i, /^postal.?code$/i],
    confidence: 0.95,
  },
  {
    target: "property.ownerName",
    patterns: [/owner.?name/i, /^owner$/i],
    confidence: 0.9,
  },
  {
    target: "property.ownerEmail",
    patterns: [/owner.?email/i, /owner.?e-?mail/i],
    confidence: 0.95,
  },
  {
    target: "unit.label",
    patterns: [/^unit$/i, /unit.?(no|number|label|name)/i, /^apt$/i, /apartment/i],
    confidence: 0.85,
  },
  {
    target: "unit.bedrooms",
    patterns: [/^bed(room)?s?$/i, /^bd$/i, /^br$/i],
    confidence: 0.9,
  },
  {
    target: "unit.bathrooms",
    patterns: [/^bath(room)?s?$/i, /^ba$/i],
    confidence: 0.9,
  },
  {
    target: "lease.monthlyRent",
    patterns: [/monthly.?rent/i, /^rent$/i, /rent.?amount/i, /market.?rent/i],
    confidence: 0.9,
  },
  {
    target: "lease.startDate",
    patterns: [/lease.?start/i, /move.?in/i, /start.?date/i],
    confidence: 0.85,
  },
  {
    target: "lease.endDate",
    patterns: [/lease.?end/i, /move.?out/i, /end.?date/i, /expir(y|ation)/i],
    confidence: 0.85,
  },
  {
    target: "lease.status",
    patterns: [/lease.?status/i, /^status$/i, /tenancy.?status/i],
    confidence: 0.75,
  },
  {
    target: "tenant.firstName",
    patterns: [/tenant.?first/i, /first.?name/i, /^given.?name$/i],
    confidence: 0.9,
  },
  {
    target: "tenant.lastName",
    patterns: [/tenant.?last/i, /last.?name/i, /^surname$/i, /family.?name/i],
    confidence: 0.9,
  },
  {
    target: "tenant.email",
    patterns: [/tenant.?e-?mail/i, /^e-?mail$/i],
    confidence: 0.85,
  },
  {
    target: "tenant.phone",
    patterns: [/tenant.?phone/i, /^phone$/i, /^mobile$/i, /cell/i],
    confidence: 0.85,
  },
];

export function proposeMappings(
  headers: string[],
): PortfolioImportColumnMapping[] {
  const usedTargets = new Set<PortfolioTargetField>();
  const mappings: PortfolioImportColumnMapping[] = [];

  for (const header of headers) {
    let bestTarget: PortfolioTargetField | null = null;
    let bestConfidence = 0;
    for (const hint of MAPPING_HINTS) {
      if (usedTargets.has(hint.target)) continue;
      if (hint.patterns.some((r) => r.test(header))) {
        if (hint.confidence > bestConfidence) {
          bestTarget = hint.target;
          bestConfidence = hint.confidence;
        }
      }
    }
    if (bestTarget) usedTargets.add(bestTarget);
    mappings.push({
      sourceHeader: header,
      target: bestTarget,
      confidence: bestConfidence,
    });
  }
  return mappings;
}

// ---------- Row building ----------

const ROW_ID_PREFIX = "impr_";
const newRowId = (i: number) => `${ROW_ID_PREFIX}${i.toString(36)}`;

export function buildRows(
  parsed: ParsedCsv,
  mappings: PortfolioImportColumnMapping[],
): PortfolioImportRow[] {
  const headerToTarget = new Map<string, PortfolioTargetField>();
  for (const m of mappings) {
    if (m.target) headerToTarget.set(m.sourceHeader, m.target);
  }

  return parsed.rows.map((source, idx) => {
    const projected: Partial<Record<PortfolioTargetField, string>> = {};
    for (const [header, value] of Object.entries(source)) {
      const target = headerToTarget.get(header);
      if (target && value) projected[target] = value;
    }
    const issues = validateRow(projected);
    return {
      id: newRowId(idx),
      source,
      parsed: projected,
      issues,
      accepted: issues.length === 0,
    };
  });
}

function validateRow(
  parsed: Partial<Record<PortfolioTargetField, string>>,
): string[] {
  const issues: string[] = [];
  if (!parsed["property.address"]) issues.push("missing address");
  if (!parsed["property.state"]) issues.push("missing state");
  const rent = parsed["lease.monthlyRent"];
  if (rent !== undefined) {
    const n = Number(rent.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(n) || n < 0) issues.push("invalid rent amount");
  }
  return issues;
}

// ---------- Fixture for demo ----------

export const DEMO_CSV_SAMPLE = `Address,City,State,Zip,Owner Name,Owner Email,Unit,Beds,Baths,Rent,Lease Start,Lease End,Tenant First,Tenant Last,Tenant Email,Tenant Phone
1420 Bayshore Dr,Tampa,FL,33606,Acme Holdings LLC,ops@acmeholdings.com,,3,2,2850,2024-09-01,2025-08-31,Morgan,Reyes,morgan.reyes@example.com,813-555-0112
2210 Lyndale Ave S #4,Minneapolis,MN,55405,River Oak Properties,contact@riveroakmn.com,4,2,1,1650,2025-01-15,2026-01-14,Devin,Chu,devin.chu@example.com,612-555-0177
508 Monument Ave,Richmond,VA,23220,Monument Partners,hello@monumentpartners.co,,4,2.5,3400,2024-06-01,2025-05-31,Samira,Patel,samira.p@example.com,804-555-0198
`;
