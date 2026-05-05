import type { DataClient } from "../../data/contracts";
import type { AuthUser } from "../../data/types";
import type { LlmClient } from "./llm/contracts";
import type {
  AiPromptStep,
  BranchCondition,
  BranchStep,
  ComputeStep,
  DataCall,
  DataReadStep,
  DataRepoName,
  DataWriteStep,
  EndStep,
  JsonValue,
  RunnerSnapshot,
  RunnerStatus,
  StatePath,
  Step,
  UserInputStep,
  WorkflowDefinition,
} from "./types";
import { callCompute, isAllowedComputeFn } from "./compute";
// WorkflowArg is used only structurally via resolveArg's signature; no runtime import needed.

export interface RunnerDeps {
  data: DataClient;
  llm: LlmClient;
  user: AuthUser;
}

/**
 * Methods on the DataClient that workflow definitions are allowed to call.
 * Keeping this an explicit table — rather than reflecting over the client —
 * means a malformed workflow can't invoke arbitrary internals.
 */
const ALLOWED_CALLS: Record<DataRepoName, Set<string>> = {
  properties: new Set(["listForHouseWatcher", "get"]),
  houseWatchers: new Set(["getByUserId"]),
  checkTemplates: new Set(["get", "listAll"]),
  checkSessions: new Set([
    "listForHouseWatcher",
    "get",
    "create",
    "updateStatus",
  ]),
  checkResponses: new Set(["listForSession", "upsert"]),
  photos: new Set(["upload", "listForSession"]),
  workflowRuns: new Set(["create", "get", "update", "listForUser"]),
  pmCompanies: new Set(["create", "get", "update", "listForUser"]),
  pmTeam: new Set(["listForCompany", "add", "update", "remove"]),
  pmFeeSchedules: new Set(["getForCompany", "upsert"]),
  pmPolicies: new Set(["getForCompany", "upsert"]),
  owners: new Set(["listForCompany", "upsertByEmail"]),
  units: new Set(["listForProperty", "create"]),
  leases: new Set(["listForUnit", "create"]),
  tenants: new Set(["listForCompany", "create"]),
  portfolioImports: new Set([
    "create",
    "get",
    "updateStatus",
    "updateRows",
    "commit",
  ]),
};

export interface StartOptions {
  /** Optional seed state merged into the run's initial state. */
  initialState?: Record<string, JsonValue>;
}

export class WorkflowRunner {
  private readonly def: WorkflowDefinition;
  private readonly steps: Map<string, Step>;
  private readonly deps: RunnerDeps;

  private runId: string | null = null;
  private currentStepId: string | null = null;
  private state: Record<string, JsonValue> = {};
  private status: RunnerStatus = "idle";
  private error: string | null = null;

  constructor(def: WorkflowDefinition, deps: RunnerDeps) {
    assertRoleAllowed(def, deps.user);
    this.def = def;
    this.steps = new Map(def.steps.map((s) => [s.id, s]));
    this.deps = deps;
  }

  snapshot(): RunnerSnapshot {
    const awaitingStep =
      this.status === "awaiting_input" && this.currentStepId
        ? (this.getStep(this.currentStepId) as UserInputStep)
        : null;
    return {
      runId: this.runId ?? "",
      workflowId: this.def.id,
      status: this.status,
      currentStepId: this.currentStepId,
      awaitingStep,
      state: this.state,
      error: this.error,
    };
  }

  async start(opts: StartOptions = {}): Promise<RunnerSnapshot> {
    if (this.runId) throw new Error("Runner already started");
    const run = await this.deps.data.workflowRuns.create({
      workflowId: this.def.id,
      userId: this.deps.user.id,
      state: opts.initialState ?? {},
    });
    this.runId = run.id;
    this.state = { ...(opts.initialState ?? {}) };
    this.currentStepId = this.def.entry;
    this.status = "running";
    await this.persist();
    await this.drive();
    return this.snapshot();
  }

  /** Resume a user_input step with the submitted values. */
  async submitInput(values: Record<string, JsonValue>): Promise<RunnerSnapshot> {
    if (this.status !== "awaiting_input" || !this.currentStepId) {
      throw new Error("Runner is not awaiting input");
    }
    const step = this.getStep(this.currentStepId) as UserInputStep;
    setStatePath(this.state, step.writeTo, values);
    this.currentStepId = step.next;
    this.status = "running";
    await this.persist();
    await this.drive();
    return this.snapshot();
  }

  async cancel(): Promise<RunnerSnapshot> {
    this.status = "cancelled";
    await this.persist();
    return this.snapshot();
  }

  // ---------- Internals ----------

  private getStep(id: string): Step {
    const s = this.steps.get(id);
    if (!s) throw new Error(`Unknown step "${id}" in workflow ${this.def.id}`);
    return s;
  }

  private async drive(): Promise<void> {
    // Walk steps until we hit a user_input (pause), end, or failure.
    while (this.status === "running" && this.currentStepId) {
      const step = this.getStep(this.currentStepId);
      try {
        await this.runStep(step);
      } catch (err) {
        this.status = "failed";
        this.error = err instanceof Error ? err.message : String(err);
        await this.persist();
        return;
      }
    }
  }

  private async runStep(step: Step): Promise<void> {
    switch (step.kind) {
      case "user_input":
        this.status = "awaiting_input";
        await this.persist();
        return;
      case "ai_prompt":
        await this.runAiPrompt(step);
        await this.persist();
        return;
      case "data_read":
        await this.runDataRead(step);
        await this.persist();
        return;
      case "data_write":
        await this.runDataWrite(step);
        await this.persist();
        return;
      case "compute":
        await this.runCompute(step);
        await this.persist();
        return;
      case "branch":
        this.currentStepId = this.runBranch(step);
        await this.persist();
        return;
      case "end":
        await this.runEnd(step);
        return;
    }
  }

  private async runAiPrompt(step: AiPromptStep): Promise<void> {
    const userContent = renderTemplate(step.prompt, this.state);
    const res = await this.deps.llm.complete({
      system: step.system,
      messages: [{ role: "user", content: userContent }],
      expectJson: step.expectJson,
      label: step.id,
    });
    let value: JsonValue = res.text;
    if (step.expectJson) {
      try {
        value = JSON.parse(res.text) as JsonValue;
      } catch (err) {
        throw new Error(
          `Step ${step.id} expected JSON but LLM returned invalid JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    setStatePath(this.state, step.writeTo, value);
    this.currentStepId = step.next;
  }

  private async runDataRead(step: DataReadStep): Promise<void> {
    const result = await this.dispatch(step.call);
    setStatePath(this.state, step.writeTo, toJsonValue(result));
    this.currentStepId = step.next;
  }

  private async runDataWrite(step: DataWriteStep): Promise<void> {
    const result = await this.dispatch(step.call);
    if (step.writeTo) {
      setStatePath(this.state, step.writeTo, toJsonValue(result));
    }
    this.currentStepId = step.next;
  }

  private async runCompute(step: ComputeStep): Promise<void> {
    if (!isAllowedComputeFn(step.fn)) {
      throw new Error(`Workflow tried to call disallowed compute fn "${step.fn}"`);
    }
    const args = step.args.map((a) => resolveArg(a, this.state));
    const result = callCompute(step.fn, args);
    setStatePath(this.state, step.writeTo, toJsonValue(result));
    this.currentStepId = step.next;
  }

  private runBranch(step: BranchStep): string {
    for (const b of step.branches) {
      if (evalBranch(b, this.state)) return b.next;
    }
    return step.default;
  }

  private async runEnd(step: EndStep): Promise<void> {
    this.status = step.outcome === "completed" ? "completed" : "cancelled";
    this.currentStepId = null;
    await this.persist(true);
  }

  private async dispatch(call: DataCall): Promise<unknown> {
    const allowed = ALLOWED_CALLS[call.repo];
    if (!allowed || !allowed.has(call.method)) {
      throw new Error(
        `Workflow tried to call disallowed method ${call.repo}.${call.method}`,
      );
    }
    const repo = this.deps.data[call.repo] as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    const fn = repo[call.method];
    if (typeof fn !== "function") {
      throw new Error(`DataClient has no method ${call.repo}.${call.method}`);
    }
    const args = call.args.map((a) => resolveArg(a, this.state));
    return await fn.apply(repo, args);
  }

  private async persist(final = false): Promise<void> {
    if (!this.runId) return;
    await this.deps.data.workflowRuns.update(this.runId, {
      status: mapStatus(this.status),
      currentStepId: this.currentStepId,
      state: this.state,
      completedAt: final ? new Date().toISOString() : null,
      error: this.error,
    });
  }
}

// ---------- Helpers ----------

function assertRoleAllowed(def: WorkflowDefinition, user: AuthUser): void {
  if (!def.allowedRoles.includes(user.role)) {
    throw new Error(
      `Role "${user.role}" is not allowed to run workflow "${def.id}"`,
    );
  }
}

/**
 * Resolve a workflow arg. Walks recursively so `{path}` references work at any
 * depth — e.g. `{propertyId: {path: "selection.propertyId"}}` becomes
 * `{propertyId: <resolved value>}` before dispatch.
 */
function resolveArg(
  arg: unknown,
  state: Record<string, JsonValue>,
): unknown {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg !== "object") return arg;
  if (Array.isArray(arg)) return arg.map((a) => resolveArg(a, state));
  const obj = arg as Record<string, unknown>;
  if ("path" in obj && typeof obj.path === "string" && Object.keys(obj).length === 1) {
    return getStatePath(state, obj.path);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = resolveArg(v, state);
  }
  return out;
}

function evalBranch(
  cond: BranchCondition,
  state: Record<string, JsonValue>,
): boolean {
  const actual = getStatePath(state, cond.path);
  switch (cond.op) {
    case "eq":
      return actual === cond.value;
    case "neq":
      return actual !== cond.value;
    case "exists":
      return actual !== undefined && actual !== null;
    case "not_exists":
      return actual === undefined || actual === null;
    case "truthy":
      return Boolean(actual);
    case "falsy":
      return !actual;
  }
}

const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

function renderTemplate(
  template: string,
  state: Record<string, JsonValue>,
): string {
  return template.replace(TEMPLATE_RE, (_, path: string) => {
    const v = getStatePath(state, path.trim());
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  });
}

export function getStatePath(
  state: Record<string, JsonValue>,
  path: StatePath,
): JsonValue | undefined {
  const parts = path.split(".");
  let cur: JsonValue | undefined = state;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return undefined;
    }
    cur = (cur as { [k: string]: JsonValue })[part];
    if (cur === undefined) return undefined;
  }
  return cur;
}

export function setStatePath(
  state: Record<string, JsonValue>,
  path: StatePath,
  value: JsonValue | Record<string, JsonValue>,
): void {
  const parts = path.split(".");
  const last = parts.pop()!;
  let cur: Record<string, JsonValue> = state;
  for (const part of parts) {
    const next = cur[part];
    if (next === undefined || next === null || typeof next !== "object" || Array.isArray(next)) {
      const fresh: Record<string, JsonValue> = {};
      cur[part] = fresh;
      cur = fresh;
    } else {
      cur = next as Record<string, JsonValue>;
    }
  }
  cur[last] = value as JsonValue;
}

function toJsonValue(v: unknown): JsonValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return v;
  }
  // Objects/arrays: pass through a JSON round-trip to drop non-JSON values.
  try {
    return JSON.parse(JSON.stringify(v)) as JsonValue;
  } catch {
    return null;
  }
}

function mapStatus(s: RunnerStatus) {
  switch (s) {
    case "idle":
    case "running":
      return "running" as const;
    case "awaiting_input":
      return "awaiting_input" as const;
    case "completed":
      return "completed" as const;
    case "failed":
      return "failed" as const;
    case "cancelled":
      return "cancelled" as const;
  }
}
