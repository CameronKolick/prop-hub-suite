/**
 * Backend-agnostic domain types for the workflow-driven features of prop-hub-suite.
 *
 * Scope is intentionally narrow: only the entities the new AI workflow engine
 * and mobile house-check flow depend on. Legacy Supabase-backed features keep
 * using their existing types under src/integrations/supabase until migrated.
 */

export type Role =
  | "admin"
  | "property_manager"
  | "owner_investor"
  | "tenant"
  | "house_watcher";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
}

export interface Property {
  id: string;
  /** PM company that manages this property (null for legacy seed data). */
  companyId: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  ownerId: string;
  assignedHouseWatcherId: string | null;
  notes: string | null;
}

export interface HouseWatcher {
  id: string;
  userId: string;
  displayName: string;
  email: string;
}

export interface CheckTemplate {
  id: string;
  name: string;
  description: string | null;
  sections: CheckTemplateSection[];
}

export interface CheckTemplateSection {
  id: string;
  templateId: string;
  name: string;
  order: number;
  items: CheckTemplateItem[];
}

export interface CheckTemplateItem {
  id: string;
  sectionId: string;
  prompt: string;
  order: number;
  required: boolean;
  allowsPhoto: boolean;
  allowsNote: boolean;
}

export type CheckSessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface CheckSession {
  id: string;
  propertyId: string;
  templateId: string;
  houseWatcherId: string;
  status: CheckSessionStatus;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
}

export type ItemResponseValue =
  | { kind: "boolean"; value: boolean }
  | { kind: "text"; value: string }
  | { kind: "skipped" };

export interface CheckItemResponse {
  id: string;
  sessionId: string;
  itemId: string;
  value: ItemResponseValue;
  note: string | null;
  photoIds: string[];
  answeredAt: string;
}

export interface Photo {
  id: string;
  sessionId: string;
  itemId: string | null;
  url: string;
  capturedAt: string;
}

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  userId: string;
  status: WorkflowRunStatus;
  currentStepId: string | null;
  state: Record<string, unknown>;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

// ---------- PM company onboarding ----------

export type UsStateCode = "FL" | "MN" | "VA";

export type PmCompanyStatus = "onboarding" | "active" | "paused";

export interface PmCompany {
  id: string;
  legalName: string;
  dba: string | null;
  ein: string | null;
  state: UsStateCode;
  website: string | null;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  status: PmCompanyStatus;
  createdAt: string;
}

export type PmTeamRole =
  | "owner"
  | "property_manager"
  | "leasing_agent"
  | "maintenance_coordinator"
  | "bookkeeper";

export type PmTeamInviteStatus = "pending" | "accepted" | "revoked";

export interface PmTeamMember {
  id: string;
  companyId: string;
  userId: string | null; // null until invite is accepted
  firstName: string;
  lastName: string;
  email: string;
  role: PmTeamRole;
  inviteStatus: PmTeamInviteStatus;
}

export interface PmFeeSchedule {
  id: string;
  companyId: string;
  managementPercent: number;      // e.g. 8 → 8% of rent
  leasingFeeMonthsOfRent: number; // e.g. 1 → 1 month's rent
  renewalFeeFlat: number | null;
  lateFeeFlat: number | null;
  lateFeeGraceDays: number;
  nsfFeeFlat: number | null;
}

export interface PmPolicy {
  id: string;
  companyId: string;
  petPolicy: "allowed" | "case_by_case" | "not_allowed";
  petFeeFlat: number | null;
  smokingAllowed: boolean;
  screeningMinCreditScore: number | null;
  screeningRequiresIncomeMultiple: number | null; // e.g. 3 → 3x monthly rent
  inspectionCadenceMonths: number;                 // how often to inspect
}

// Portfolio entities — the things a PM company manages. Kept minimal on
// purpose; we'll expand as other workflows need more fields.

export interface Owner {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export interface Unit {
  id: string;
  propertyId: string;
  label: string;          // "Unit A", "#101", "" for single-family
  bedrooms: number | null;
  bathrooms: number | null;
}

export type LeaseStatus = "active" | "notice" | "ended" | "future";

export interface Lease {
  id: string;
  unitId: string;
  primaryTenantId: string;
  monthlyRent: number;
  startDate: string;      // YYYY-MM-DD
  endDate: string | null; // null = month-to-month
  status: LeaseStatus;
}

export interface Tenant {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

// Portfolio import workflow — captures the state of a CSV/Excel upload being
// mapped into our schema. Deliberately rich so the UI can show previews and
// errors without calling back into the LLM.

export type PortfolioImportStatus =
  | "pending"
  | "mapping"
  | "previewing"
  | "committed"
  | "failed";

export type PortfolioImportSourceFormat = "csv" | "xlsx" | "pdf";

export interface PortfolioImportColumnMapping {
  /** Column header as it appeared in the source file. */
  sourceHeader: string;
  /** Canonical field the column maps to, or null if ignored. */
  target: PortfolioTargetField | null;
  /** AI's confidence in the mapping (0..1). */
  confidence: number;
}

/**
 * Canonical fields the importer can populate. The workflow presents a subset
 * to the user depending on data richness; missing fields are fine.
 */
export type PortfolioTargetField =
  | "property.address"
  | "property.city"
  | "property.state"
  | "property.postalCode"
  | "property.ownerName"
  | "property.ownerEmail"
  | "unit.label"
  | "unit.bedrooms"
  | "unit.bathrooms"
  | "lease.monthlyRent"
  | "lease.startDate"
  | "lease.endDate"
  | "lease.status"
  | "tenant.firstName"
  | "tenant.lastName"
  | "tenant.email"
  | "tenant.phone";

/**
 * One parsed row from the source file, projected into our schema. The
 * importer flags any row that's missing a required field so the reviewer can
 * fix or drop it before commit.
 */
export interface PortfolioImportRow {
  id: string;                                 // row id, stable across edits
  source: Record<string, string>;             // original row, header → value
  parsed: Partial<Record<PortfolioTargetField, string>>;
  issues: string[];                           // human-readable problems
  accepted: boolean;                          // user toggled this row on
}

export interface PortfolioImport {
  id: string;
  companyId: string;
  uploadedFileName: string;
  sourceFormat: PortfolioImportSourceFormat;
  status: PortfolioImportStatus;
  mappings: PortfolioImportColumnMapping[];
  rows: PortfolioImportRow[];
  /** Populated when status === 'committed'. */
  createdPropertyIds: string[];
  createdAt: string;
  committedAt: string | null;
  error: string | null;
}
