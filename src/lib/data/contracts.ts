/**
 * DataClient contract — the single interface every backend must implement.
 *
 * Current implementations:
 *   - MockDataClient (in-memory + localStorage) for local dev
 *
 * Future implementations:
 *   - GoogleDataClient (Cloud SQL via Cloud Run API) — to be written by
 *     the infra engineer. The UI and workflow engine must never depend on
 *     anything beyond this interface.
 */

import type {
  CheckItemResponse,
  CheckSession,
  CheckSessionStatus,
  CheckTemplate,
  HouseWatcher,
  ItemResponseValue,
  Lease,
  Owner,
  Photo,
  PmCompany,
  PmFeeSchedule,
  PmPolicy,
  PmTeamMember,
  PortfolioImport,
  PortfolioImportColumnMapping,
  PortfolioImportRow,
  PortfolioImportSourceFormat,
  PortfolioImportStatus,
  Property,
  Tenant,
  Unit,
  UsStateCode,
  WorkflowRun,
  WorkflowRunStatus,
} from "./types";

export interface NewPhotoInput {
  sessionId: string;
  itemId: string | null;
  blob: Blob;
  capturedAt?: string;
}

export interface PropertiesRepo {
  listForHouseWatcher(houseWatcherId: string): Promise<Property[]>;
  get(id: string): Promise<Property | null>;
}

export interface HouseWatchersRepo {
  getByUserId(userId: string): Promise<HouseWatcher | null>;
}

export interface CheckTemplatesRepo {
  get(id: string): Promise<CheckTemplate | null>;
  listAll(): Promise<CheckTemplate[]>;
}

export interface CheckSessionsRepo {
  listForHouseWatcher(
    houseWatcherId: string,
    opts?: { status?: CheckSessionStatus },
  ): Promise<CheckSession[]>;
  get(id: string): Promise<CheckSession | null>;
  create(input: {
    propertyId: string;
    templateId: string;
    houseWatcherId: string;
    scheduledFor: string;
  }): Promise<CheckSession>;
  updateStatus(
    id: string,
    status: CheckSessionStatus,
    opts?: { summary?: string | null },
  ): Promise<CheckSession>;
}

export interface CheckResponsesRepo {
  listForSession(sessionId: string): Promise<CheckItemResponse[]>;
  upsert(input: {
    sessionId: string;
    itemId: string;
    value: ItemResponseValue;
    note?: string | null;
    photoIds?: string[];
  }): Promise<CheckItemResponse>;
}

export interface PhotosRepo {
  upload(input: NewPhotoInput): Promise<Photo>;
  listForSession(sessionId: string): Promise<Photo[]>;
}

export interface WorkflowRunsRepo {
  create(input: {
    workflowId: string;
    userId: string;
    state?: Record<string, unknown>;
  }): Promise<WorkflowRun>;
  get(id: string): Promise<WorkflowRun | null>;
  update(
    id: string,
    patch: Partial<{
      status: WorkflowRunStatus;
      currentStepId: string | null;
      state: Record<string, unknown>;
      completedAt: string | null;
      error: string | null;
    }>,
  ): Promise<WorkflowRun>;
  listForUser(userId: string): Promise<WorkflowRun[]>;
}

// ---------- PM onboarding repos ----------

export interface PmCompaniesRepo {
  create(input: {
    legalName: string;
    state: UsStateCode;
    website?: string | null;
  }): Promise<PmCompany>;
  get(id: string): Promise<PmCompany | null>;
  update(
    id: string,
    patch: Partial<Omit<PmCompany, "id" | "createdAt">>,
  ): Promise<PmCompany>;
  listForUser(userId: string): Promise<PmCompany[]>;
}

export interface PmTeamRepo {
  listForCompany(companyId: string): Promise<PmTeamMember[]>;
  add(input: Omit<PmTeamMember, "id">): Promise<PmTeamMember>;
  update(id: string, patch: Partial<PmTeamMember>): Promise<PmTeamMember>;
  remove(id: string): Promise<void>;
}

export interface PmFeeSchedulesRepo {
  getForCompany(companyId: string): Promise<PmFeeSchedule | null>;
  upsert(input: Omit<PmFeeSchedule, "id">): Promise<PmFeeSchedule>;
}

export interface PmPoliciesRepo {
  getForCompany(companyId: string): Promise<PmPolicy | null>;
  upsert(input: Omit<PmPolicy, "id">): Promise<PmPolicy>;
}

export interface OwnersRepo {
  listForCompany(companyId: string): Promise<Owner[]>;
  upsertByEmail(input: Omit<Owner, "id">): Promise<Owner>;
}

export interface UnitsRepo {
  listForProperty(propertyId: string): Promise<Unit[]>;
  create(input: Omit<Unit, "id">): Promise<Unit>;
}

export interface LeasesRepo {
  listForUnit(unitId: string): Promise<Lease[]>;
  create(input: Omit<Lease, "id">): Promise<Lease>;
}

export interface TenantsRepo {
  listForCompany(companyId: string): Promise<Tenant[]>;
  create(input: Omit<Tenant, "id">): Promise<Tenant>;
}

export interface PortfolioImportsRepo {
  create(input: {
    companyId: string;
    uploadedFileName: string;
    sourceFormat: PortfolioImportSourceFormat;
    mappings: PortfolioImportColumnMapping[];
    rows: PortfolioImportRow[];
  }): Promise<PortfolioImport>;
  get(id: string): Promise<PortfolioImport | null>;
  updateStatus(
    id: string,
    status: PortfolioImportStatus,
    opts?: { error?: string | null; createdPropertyIds?: string[] },
  ): Promise<PortfolioImport>;
  updateRows(id: string, rows: PortfolioImportRow[]): Promise<PortfolioImport>;
  /**
   * Walks accepted rows and creates Property/Unit/Lease/Tenant/Owner records.
   * Sets status to 'committed' on success. Idempotent for a given import id.
   */
  commit(id: string): Promise<PortfolioImport>;
}

export interface DataClient {
  readonly properties: PropertiesRepo;
  readonly houseWatchers: HouseWatchersRepo;
  readonly checkTemplates: CheckTemplatesRepo;
  readonly checkSessions: CheckSessionsRepo;
  readonly checkResponses: CheckResponsesRepo;
  readonly photos: PhotosRepo;
  readonly workflowRuns: WorkflowRunsRepo;

  readonly pmCompanies: PmCompaniesRepo;
  readonly pmTeam: PmTeamRepo;
  readonly pmFeeSchedules: PmFeeSchedulesRepo;
  readonly pmPolicies: PmPoliciesRepo;
  readonly owners: OwnersRepo;
  readonly units: UnitsRepo;
  readonly leases: LeasesRepo;
  readonly tenants: TenantsRepo;
  readonly portfolioImports: PortfolioImportsRepo;
}
