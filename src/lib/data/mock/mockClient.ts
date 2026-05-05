import type {
  CheckResponsesRepo,
  CheckSessionsRepo,
  CheckTemplatesRepo,
  DataClient,
  HouseWatchersRepo,
  LeasesRepo,
  NewPhotoInput,
  OwnersRepo,
  PhotosRepo,
  PmCompaniesRepo,
  PmFeeSchedulesRepo,
  PmPoliciesRepo,
  PmTeamRepo,
  PortfolioImportsRepo,
  PropertiesRepo,
  TenantsRepo,
  UnitsRepo,
  WorkflowRunsRepo,
} from "../contracts";
import type {
  CheckItemResponse,
  CheckSession,
  CheckSessionStatus,
  CheckTemplate,
  HouseWatcher,
  Lease,
  Owner,
  Photo,
  PmCompany,
  PmFeeSchedule,
  PmPolicy,
  PmTeamMember,
  PortfolioImport,
  PortfolioImportRow,
  PortfolioImportStatus,
  PortfolioTargetField,
  Property,
  Tenant,
  Unit,
  WorkflowRun,
} from "../types";
import { buildSeed } from "./seed";
import {
  blobToDataUrl,
  emptyStore,
  loadStore,
  saveStore,
  type MockStore,
} from "./storage";

type EntityMap<T> = Record<string, T>;

const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/**
 * In-memory + localStorage data client used during development. Hydrates from
 * a deterministic seed the first time it boots so the UI has something to show.
 */
export class MockDataClient implements DataClient {
  private store: MockStore;

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

  constructor() {
    this.store = hydrateStore();

    this.properties = {
      listForHouseWatcher: async (houseWatcherId) =>
        values<Property>(this.store.properties).filter(
          (p) => p.assignedHouseWatcherId === houseWatcherId,
        ),
      get: async (id) => (this.store.properties[id] as Property) ?? null,
    };

    this.houseWatchers = {
      getByUserId: async (userId) =>
        values<HouseWatcher>(this.store.houseWatchers).find(
          (w) => w.userId === userId,
        ) ?? null,
    };

    this.checkTemplates = {
      get: async (id) => (this.store.checkTemplates[id] as CheckTemplate) ?? null,
      listAll: async () => values<CheckTemplate>(this.store.checkTemplates),
    };

    this.checkSessions = {
      listForHouseWatcher: async (houseWatcherId, opts) =>
        values<CheckSession>(this.store.checkSessions)
          .filter((s) => s.houseWatcherId === houseWatcherId)
          .filter((s) => (opts?.status ? s.status === opts.status : true))
          .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
      get: async (id) => (this.store.checkSessions[id] as CheckSession) ?? null,
      create: async (input) => {
        const session: CheckSession = {
          id: newId("ses"),
          propertyId: input.propertyId,
          templateId: input.templateId,
          houseWatcherId: input.houseWatcherId,
          status: "scheduled",
          scheduledFor: input.scheduledFor,
          startedAt: null,
          completedAt: null,
          summary: null,
        };
        this.store.checkSessions[session.id] = session;
        this.persist();
        return session;
      },
      updateStatus: async (id, status, opts) => {
        const existing = this.store.checkSessions[id] as CheckSession | undefined;
        if (!existing) throw new Error(`CheckSession ${id} not found`);
        const updated = applyCheckSessionStatus(existing, status, opts?.summary);
        this.store.checkSessions[id] = updated;
        this.persist();
        return updated;
      },
    };

    this.checkResponses = {
      listForSession: async (sessionId) =>
        values<CheckItemResponse>(this.store.checkResponses).filter(
          (r) => r.sessionId === sessionId,
        ),
      upsert: async ({ sessionId, itemId, value, note, photoIds }) => {
        const existing = values<CheckItemResponse>(this.store.checkResponses).find(
          (r) => r.sessionId === sessionId && r.itemId === itemId,
        );
        const response: CheckItemResponse = {
          id: existing?.id ?? newId("rsp"),
          sessionId,
          itemId,
          value,
          note: note ?? existing?.note ?? null,
          photoIds: photoIds ?? existing?.photoIds ?? [],
          answeredAt: now(),
        };
        this.store.checkResponses[response.id] = response;
        this.persist();
        return response;
      },
    };

    this.photos = {
      upload: async (input: NewPhotoInput) => {
        const url = await blobToDataUrl(input.blob);
        const photo: Photo = {
          id: newId("pho"),
          sessionId: input.sessionId,
          itemId: input.itemId,
          url,
          capturedAt: input.capturedAt ?? now(),
        };
        this.store.photos[photo.id] = photo;
        this.persist();
        return photo;
      },
      listForSession: async (sessionId) =>
        values<Photo>(this.store.photos).filter((p) => p.sessionId === sessionId),
    };

    this.workflowRuns = {
      create: async ({ workflowId, userId, state }) => {
        const run: WorkflowRun = {
          id: newId("run"),
          workflowId,
          userId,
          status: "pending",
          currentStepId: null,
          state: state ?? {},
          startedAt: now(),
          updatedAt: now(),
          completedAt: null,
          error: null,
        };
        this.store.workflowRuns[run.id] = run;
        this.persist();
        return run;
      },
      get: async (id) => (this.store.workflowRuns[id] as WorkflowRun) ?? null,
      update: async (id, patch) => {
        const existing = this.store.workflowRuns[id] as WorkflowRun | undefined;
        if (!existing) throw new Error(`WorkflowRun ${id} not found`);
        const next: WorkflowRun = {
          ...existing,
          ...patch,
          state: patch.state ?? existing.state,
          updatedAt: now(),
        } as WorkflowRun;
        this.store.workflowRuns[id] = next;
        this.persist();
        return next;
      },
      listForUser: async (userId) =>
        values<WorkflowRun>(this.store.workflowRuns)
          .filter((r) => r.userId === userId)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    };

    this.pmCompanies = {
      create: async ({ legalName, state, website }) => {
        const company: PmCompany = {
          id: newId("co"),
          legalName,
          dba: null,
          ein: null,
          state,
          website: website ?? null,
          logoUrl: null,
          brandPrimaryColor: null,
          brandSecondaryColor: null,
          status: "onboarding",
          createdAt: now(),
        };
        this.store.pmCompanies[company.id] = company;
        this.persist();
        return company;
      },
      get: async (id) => (this.store.pmCompanies[id] as PmCompany) ?? null,
      update: async (id, patch) => {
        const existing = this.store.pmCompanies[id] as PmCompany | undefined;
        if (!existing) throw new Error(`PmCompany ${id} not found`);
        const updated: PmCompany = { ...existing, ...patch };
        this.store.pmCompanies[id] = updated;
        this.persist();
        return updated;
      },
      // For the MVP the mock treats every company as visible to every user —
      // a real backend will filter by team membership.
      listForUser: async () => values<PmCompany>(this.store.pmCompanies),
    };

    this.pmTeam = {
      listForCompany: async (companyId) =>
        values<PmTeamMember>(this.store.pmTeam).filter(
          (m) => m.companyId === companyId,
        ),
      add: async (input) => {
        const member: PmTeamMember = { id: newId("mem"), ...input };
        this.store.pmTeam[member.id] = member;
        this.persist();
        return member;
      },
      update: async (id, patch) => {
        const existing = this.store.pmTeam[id] as PmTeamMember | undefined;
        if (!existing) throw new Error(`PmTeamMember ${id} not found`);
        const updated: PmTeamMember = { ...existing, ...patch };
        this.store.pmTeam[id] = updated;
        this.persist();
        return updated;
      },
      remove: async (id) => {
        delete this.store.pmTeam[id];
        this.persist();
      },
    };

    this.pmFeeSchedules = {
      getForCompany: async (companyId) =>
        values<PmFeeSchedule>(this.store.pmFeeSchedules).find(
          (s) => s.companyId === companyId,
        ) ?? null,
      upsert: async (input) => {
        const existing = values<PmFeeSchedule>(this.store.pmFeeSchedules).find(
          (s) => s.companyId === input.companyId,
        );
        const record: PmFeeSchedule = {
          id: existing?.id ?? newId("fee"),
          ...input,
        };
        this.store.pmFeeSchedules[record.id] = record;
        this.persist();
        return record;
      },
    };

    this.pmPolicies = {
      getForCompany: async (companyId) =>
        values<PmPolicy>(this.store.pmPolicies).find(
          (p) => p.companyId === companyId,
        ) ?? null,
      upsert: async (input) => {
        const existing = values<PmPolicy>(this.store.pmPolicies).find(
          (p) => p.companyId === input.companyId,
        );
        const record: PmPolicy = {
          id: existing?.id ?? newId("pol"),
          ...input,
        };
        this.store.pmPolicies[record.id] = record;
        this.persist();
        return record;
      },
    };

    this.owners = {
      listForCompany: async (companyId) =>
        values<Owner>(this.store.owners).filter((o) => o.companyId === companyId),
      upsertByEmail: async (input) => {
        const existing = values<Owner>(this.store.owners).find(
          (o) =>
            o.companyId === input.companyId &&
            o.email.toLowerCase() === input.email.toLowerCase(),
        );
        const record: Owner = {
          id: existing?.id ?? newId("own"),
          ...input,
        };
        this.store.owners[record.id] = record;
        this.persist();
        return record;
      },
    };

    this.units = {
      listForProperty: async (propertyId) =>
        values<Unit>(this.store.units).filter((u) => u.propertyId === propertyId),
      create: async (input) => {
        const record: Unit = { id: newId("uni"), ...input };
        this.store.units[record.id] = record;
        this.persist();
        return record;
      },
    };

    this.leases = {
      listForUnit: async (unitId) =>
        values<Lease>(this.store.leases).filter((l) => l.unitId === unitId),
      create: async (input) => {
        const record: Lease = { id: newId("lse"), ...input };
        this.store.leases[record.id] = record;
        this.persist();
        return record;
      },
    };

    this.tenants = {
      listForCompany: async (companyId) =>
        values<Tenant>(this.store.tenants).filter(
          (t) => t.companyId === companyId,
        ),
      create: async (input) => {
        const record: Tenant = { id: newId("ten"), ...input };
        this.store.tenants[record.id] = record;
        this.persist();
        return record;
      },
    };

    this.portfolioImports = {
      create: async ({
        companyId,
        uploadedFileName,
        sourceFormat,
        mappings,
        rows,
      }) => {
        const record: PortfolioImport = {
          id: newId("imp"),
          companyId,
          uploadedFileName,
          sourceFormat,
          status: "mapping",
          mappings,
          rows,
          createdPropertyIds: [],
          createdAt: now(),
          committedAt: null,
          error: null,
        };
        this.store.portfolioImports[record.id] = record;
        this.persist();
        return record;
      },
      get: async (id) =>
        (this.store.portfolioImports[id] as PortfolioImport) ?? null,
      updateStatus: async (id, status, opts) => {
        const existing = this.store.portfolioImports[id] as
          | PortfolioImport
          | undefined;
        if (!existing) throw new Error(`PortfolioImport ${id} not found`);
        const updated: PortfolioImport = {
          ...existing,
          status,
          error: opts?.error ?? existing.error,
          createdPropertyIds: opts?.createdPropertyIds ?? existing.createdPropertyIds,
          committedAt: status === "committed" ? now() : existing.committedAt,
        };
        this.store.portfolioImports[id] = updated;
        this.persist();
        return updated;
      },
      updateRows: async (id, rows) => {
        const existing = this.store.portfolioImports[id] as
          | PortfolioImport
          | undefined;
        if (!existing) throw new Error(`PortfolioImport ${id} not found`);
        const updated: PortfolioImport = { ...existing, rows };
        this.store.portfolioImports[id] = updated;
        this.persist();
        return updated;
      },
      commit: async (id) => {
        const existing = this.store.portfolioImports[id] as
          | PortfolioImport
          | undefined;
        if (!existing) throw new Error(`PortfolioImport ${id} not found`);
        if (existing.status === "committed") return existing;

        const accepted = existing.rows.filter((r) => r.accepted);
        const createdPropertyIds: string[] = [];

        for (const row of accepted) {
          const address = row.parsed["property.address"];
          if (!address) continue;
          const ownerName = row.parsed["property.ownerName"] ?? "";
          const ownerEmail = row.parsed["property.ownerEmail"] ?? "";
          let ownerId = "";
          if (ownerEmail) {
            const [firstName, ...rest] = ownerName.split(" ");
            const owner = await this.owners.upsertByEmail({
              companyId: existing.companyId,
              firstName: firstName ?? "Owner",
              lastName: rest.join(" ") || "Unknown",
              email: ownerEmail,
              phone: null,
            });
            ownerId = owner.id;
          }

          const property: Property = {
            id: newId("prop"),
            companyId: existing.companyId,
            address,
            city: row.parsed["property.city"] ?? "",
            state: row.parsed["property.state"] ?? "",
            postalCode: row.parsed["property.postalCode"] ?? "",
            ownerId: ownerId || "owner_unassigned",
            assignedHouseWatcherId: null,
            notes: null,
          };
          this.store.properties[property.id] = property;
          createdPropertyIds.push(property.id);

          const unit = await this.units.create({
            propertyId: property.id,
            label: row.parsed["unit.label"] ?? "",
            bedrooms: numOrNull(row.parsed["unit.bedrooms"]),
            bathrooms: numOrNull(row.parsed["unit.bathrooms"]),
          });

          const firstName = row.parsed["tenant.firstName"] ?? "";
          const lastName = row.parsed["tenant.lastName"] ?? "";
          if (firstName || lastName) {
            const tenant = await this.tenants.create({
              companyId: existing.companyId,
              firstName: firstName || "Unknown",
              lastName: lastName || "Tenant",
              email: row.parsed["tenant.email"] ?? null,
              phone: row.parsed["tenant.phone"] ?? null,
            });

            const rent = numOrNull(row.parsed["lease.monthlyRent"]);
            if (rent !== null) {
              await this.leases.create({
                unitId: unit.id,
                primaryTenantId: tenant.id,
                monthlyRent: rent,
                startDate: row.parsed["lease.startDate"] ?? today(),
                endDate: row.parsed["lease.endDate"] ?? null,
                status: (row.parsed["lease.status"] as Lease["status"]) ?? "active",
              });
            }
          }
        }

        return this.portfolioImports.updateStatus(id, "committed", {
          createdPropertyIds,
        });
      },
    };
  }

  private persist() {
    saveStore(this.store);
  }
}

// ---------- Helpers ----------

function hydrateStore(): MockStore {
  const loaded = loadStore();
  if (loaded) {
    return mergeMissingKeys(loaded);
  }
  const fresh = emptyStore();
  const seed = buildSeed();
  for (const w of seed.houseWatchers) fresh.houseWatchers[w.id] = w;
  for (const p of seed.properties) fresh.properties[p.id] = p;
  for (const t of seed.templates) fresh.checkTemplates[t.id] = t;
  saveStore(fresh);
  return fresh;
}

/**
 * If the stored shape predates a new repo, fill in the empty maps so we don't
 * blow up with `undefined.filter(...)`. Cheap migration path for the mock.
 */
function mergeMissingKeys(store: Partial<MockStore>): MockStore {
  const empty = emptyStore();
  return { ...empty, ...store } as MockStore;
}

function values<T>(map: EntityMap<T>): T[] {
  return Object.values(map) as T[];
}

function applyCheckSessionStatus(
  session: CheckSession,
  status: CheckSessionStatus,
  summary: string | null | undefined,
): CheckSession {
  const patch: Partial<CheckSession> = { status };
  if (status === "in_progress" && !session.startedAt) patch.startedAt = now();
  if (status === "completed" && !session.completedAt) patch.completedAt = now();
  if (summary !== undefined) patch.summary = summary;
  return { ...session, ...patch };
}

function numOrNull(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
