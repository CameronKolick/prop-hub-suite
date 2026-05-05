/**
 * Workflow engine types. Workflows are data, not code — a WorkflowDefinition is
 * a graph of steps the runner walks until it hits an `end` step. Steps either
 * act (call the LLM, read/write data) or pause and wait for user input.
 *
 * Every step reads and writes a shared `context.state` blob (`Record<string,
 * unknown>`). Steps are pure descriptions; all side effects go through the
 * runner, which holds the DataClient, LlmClient, and user identity.
 */

import type { AuthUser } from "../../data/types";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

/** Path into the state blob, e.g. "property.id" or "responses.item_ext_entry". */
export type StatePath = string;

// ---------- Step kinds ----------

export interface AiPromptStep {
  kind: "ai_prompt";
  id: string;
  /** Template rendered with {{path.to.state}} placeholders. */
  prompt: string;
  system?: string;
  /** Where the LLM's text response gets stored. */
  writeTo: StatePath;
  /** If provided, parse the response as JSON and validate shape before writing. */
  expectJson?: boolean;
  next: string;
}

export interface UserInputStep {
  kind: "user_input";
  id: string;
  /** Declarative description of what the UI should render. */
  form: UserInputForm;
  /** Where the submitted form values get merged into state. */
  writeTo: StatePath;
  next: string;
}

export interface DataReadStep {
  kind: "data_read";
  id: string;
  /** Which DataClient repo method to call, plus args pulled from state. */
  call: DataCall;
  writeTo: StatePath;
  next: string;
}

export interface DataWriteStep {
  kind: "data_write";
  id: string;
  call: DataCall;
  /** Optional: path to write the result of the call to. */
  writeTo?: StatePath;
  next: string;
}

export interface BranchStep {
  kind: "branch";
  id: string;
  branches: BranchCondition[];
  /** Fallback if no branch matches. */
  default: string;
}

export interface ComputeStep {
  kind: "compute";
  id: string;
  /** Name of a registered compute function — resolved at runtime, allowlist-gated. */
  fn: string;
  /** Arguments passed to the function; `{path}` refs resolved against state. */
  args: WorkflowArg[];
  writeTo: StatePath;
  next: string;
}

export interface EndStep {
  kind: "end";
  id: string;
  /** Final status to stamp on the WorkflowRun. */
  outcome: "completed" | "cancelled";
}

export type Step =
  | AiPromptStep
  | UserInputStep
  | DataReadStep
  | DataWriteStep
  | ComputeStep
  | BranchStep
  | EndStep;

// ---------- Supporting shapes ----------

export interface UserInputForm {
  title: string;
  description?: string;
  fields: UserInputField[];
  submitLabel?: string;
}

export type UserInputField =
  | {
      kind: "text";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      multiline?: boolean;
      /** Optional default value the renderer seeds the field with. */
      defaultValue?: string;
      /** Optional state path whose value (if set) overrides defaultValue. */
      defaultValuePath?: StatePath;
    }
  | {
      kind: "boolean";
      name: string;
      label: string;
      required?: boolean;
      defaultValue?: boolean;
      defaultValuePath?: StatePath;
    }
  | {
      kind: "choice";
      name: string;
      label: string;
      /** Static options. Ignored if optionsFromPath is set. */
      options?: { value: string; label: string }[];
      /**
       * Path to an array of objects in state. Each element is turned into an
       * option using `optionValueKey` and `optionLabelKey`. Use this to pick
       * from data loaded earlier in the workflow (e.g. the watcher's
       * assigned properties).
       */
      optionsFromPath?: StatePath;
      optionValueKey?: string; // default "id"
      optionLabelKey?: string; // default "label"
      /**
       * Optional template for building the option label from the raw item.
       * Uses {{key}} placeholders pulled from the array element. Overrides
       * optionLabelKey when set.
       */
      optionLabelTemplate?: string;
      required?: boolean;
      defaultValue?: string;
      defaultValuePath?: StatePath;
    }
  | {
      kind: "photo";
      name: string;
      label: string;
      /** Max number of photos; default 1. */
      max?: number;
      required?: boolean;
    }
  | {
      /**
       * A file upload — CSV, Excel, PDF. The renderer returns a
       * `{fileName, mimeType, textContent}` object in the submitted values.
       * For MVP we read the file as UTF-8 text (good enough for CSV); binary
       * formats land on mobile/infra.
       */
      kind: "file_upload";
      name: string;
      label: string;
      accept: string; // comma-separated mime types / extensions
      required?: boolean;
    }
  | {
      /**
       * Declarative "review and edit a table of rows" field. Used by Shape B
       * of the portfolio importer — the user walks a grid of AI-parsed rows,
       * toggling acceptance and fixing values.
       *
       * The field's value is a state path (not a literal) pointing at an array
       * of `PortfolioImportRow`-like objects in the workflow state. The
       * renderer reads/writes that array in place. On submit the workflow
       * receives the final array under `name`.
       */
      kind: "rows_review";
      name: string;
      label: string;
      /** Path in state pointing at the initial rows to review. */
      sourcePath: StatePath;
      /** Columns to display and allow editing. */
      columns: Array<{ field: string; label: string }>;
      required?: boolean;
    };

/**
 * A workflow arg is a literal JSON value, a `{path}` reference, or an object/
 * array that mixes the two at any depth. The runner walks recursively and
 * resolves every `{path}` before dispatching.
 */
export type PathRef = { path: StatePath };
export type WorkflowArg =
  | string
  | number
  | boolean
  | null
  | PathRef
  | WorkflowArg[]
  | { [k: string]: WorkflowArg };

/**
 * A declarative call against the DataClient. The runner resolves arguments
 * from state just before dispatching. `repo.method` is looked up on the client
 * via a method table, so workflow definitions never import concrete code.
 */
export interface DataCall {
  repo: DataRepoName;
  method: string;
  args: WorkflowArg[];
}

export type DataRepoName =
  | "properties"
  | "houseWatchers"
  | "checkTemplates"
  | "checkSessions"
  | "checkResponses"
  | "photos"
  | "workflowRuns"
  | "pmCompanies"
  | "pmTeam"
  | "pmFeeSchedules"
  | "pmPolicies"
  | "owners"
  | "units"
  | "leases"
  | "tenants"
  | "portfolioImports";

export interface BranchCondition {
  /** Path into state. */
  path: StatePath;
  /** How to compare the value at `path` against `value`. */
  op: "eq" | "neq" | "exists" | "not_exists" | "truthy" | "falsy";
  value?: JsonValue;
  next: string;
}

// ---------- The workflow itself ----------

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  /** Roles that are allowed to start this workflow. */
  allowedRoles: AuthUser["role"][];
  /** Starting step id. */
  entry: string;
  steps: Step[];
}

// ---------- Runtime ----------

export type RunnerStatus =
  | "idle"
  | "running"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunnerSnapshot {
  runId: string;
  workflowId: string;
  status: RunnerStatus;
  currentStepId: string | null;
  /** Present when status === 'awaiting_input'. */
  awaitingStep: UserInputStep | null;
  state: Record<string, JsonValue>;
  error: string | null;
}
