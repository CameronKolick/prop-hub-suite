import type { WorkflowDefinition } from "../types";

/**
 * PM company onboarding — the flagship "handful of clicks" workflow.
 *
 * Phases:
 *  1. Account basics   → create company shell
 *  2. Confirm profile  → AI-prefilled company details, fees, policies
 *  3. Portfolio import → CSV upload, AI column mapping, Shape A (accept all)
 *                        vs. Shape B (review each row)
 *
 * Phase 4 (banking, integrations, compliance auto-check) is deferred until
 * real infrastructure is wired up — those steps need real external APIs.
 *
 * This workflow intentionally avoids any UI logic: every user touchpoint is a
 * `user_input` step, every AI call is an `ai_prompt` step, every side effect
 * goes through the DataClient. The web demo and the future mobile app render
 * the same definition.
 */
export const pmOnboardingWorkflow: WorkflowDefinition = {
  id: "wf.pm_onboarding.v1",
  name: "Start your property management company",
  description:
    "End-to-end onboarding for a new PM company — account, profile, portfolio.",
  allowedRoles: ["admin", "property_manager"],
  entry: "welcome",
  steps: [
    // ---------- Phase 1: Account basics ----------
    {
      kind: "user_input",
      id: "welcome",
      form: {
        title: "Let's set up your company",
        description:
          "We'll prefill as much as we can. You can always edit anything later.",
        fields: [
          {
            kind: "text",
            name: "legalName",
            label: "Company legal name",
            required: true,
            placeholder: "e.g. Bayside Property Management LLC",
          },
          {
            kind: "choice",
            name: "state",
            label: "Primary state of operation",
            required: true,
            options: [
              { value: "FL", label: "Florida" },
              { value: "MN", label: "Minnesota" },
              { value: "VA", label: "Virginia" },
            ],
          },
          {
            kind: "text",
            name: "website",
            label: "Website (optional)",
            placeholder: "https://",
          },
        ],
        submitLabel: "Create company",
      },
      writeTo: "basics",
      next: "create_company",
    },
    {
      kind: "data_write",
      id: "create_company",
      call: {
        repo: "pmCompanies",
        method: "create",
        args: [
          {
            legalName: { path: "basics.legalName" },
            state: { path: "basics.state" },
            website: { path: "basics.website" },
          },
        ],
      },
      writeTo: "company",
      next: "load_state_defaults",
    },
    {
      kind: "compute",
      id: "load_state_defaults",
      fn: "pm.stateDefaults",
      args: [{ path: "basics.state" }],
      writeTo: "stateDefaults",
      next: "ai_prefill_profile",
    },

    // ---------- Phase 2: Confirm profile ----------
    {
      kind: "ai_prompt",
      id: "ai_prefill_profile",
      system:
        "You are an onboarding assistant for a property management SaaS. Produce a JSON object that prefills a company profile based on the legal name, state, and optional website. Be conservative — if you do not know a value, use null. Never fabricate an EIN. Output ONLY valid JSON with keys: dba (string|null), ein (null — never guess), brandPrimaryColor (hex string|null), brandSecondaryColor (hex string|null), logoUrl (null — we'll upload later), notes (short paragraph of plain English about anything relevant to onboarding this company).",
      prompt:
        "Company legal name: {{basics.legalName}}\n" +
        "State of operation: {{basics.state}}\n" +
        "Website: {{basics.website}}\n\n" +
        "Return the JSON now.",
      expectJson: true,
      writeTo: "ai.profile",
      next: "confirm_profile",
    },
    {
      kind: "user_input",
      id: "confirm_profile",
      form: {
        title: "Confirm your company profile",
        description:
          "We prefilled what we could. Fix anything that's wrong — you can update this any time later.",
        fields: [
          {
            kind: "text",
            name: "dba",
            label: "Doing-business-as / brand name",
            placeholder: "Leave blank if you trade under your legal name",
            defaultValuePath: "ai.profile.dba",
          },
          {
            kind: "text",
            name: "ein",
            label: "EIN (federal tax ID)",
            placeholder: "XX-XXXXXXX — add now or fill in later",
            defaultValuePath: "ai.profile.ein",
          },
          {
            kind: "text",
            name: "brandPrimaryColor",
            label: "Primary brand color (hex)",
            placeholder: "#0A84FF",
            defaultValuePath: "ai.profile.brandPrimaryColor",
          },
        ],
        submitLabel: "Looks good — next",
      },
      writeTo: "profile",
      next: "update_company_profile",
    },
    {
      kind: "data_write",
      id: "update_company_profile",
      call: {
        repo: "pmCompanies",
        method: "update",
        args: [
          { path: "company.id" },
          {
            dba: { path: "profile.dba" },
            ein: { path: "profile.ein" },
            brandPrimaryColor: { path: "profile.brandPrimaryColor" },
          },
        ],
      },
      writeTo: "company",
      next: "confirm_fees",
    },
    {
      kind: "user_input",
      id: "confirm_fees",
      form: {
        title: "Confirm your fee structure",
        description:
          "Defaults below are typical for {{stateDefaults.displayName}}. Edit anything that doesn't match how you charge.",
        fields: [
          {
            kind: "text",
            name: "managementPercent",
            label: "Management fee (% of monthly rent)",
            required: true,
            placeholder: "8",
            defaultValuePath: "stateDefaults.managementFeePercent",
          },
          {
            kind: "text",
            name: "leasingFeeMonthsOfRent",
            label: "Leasing fee (months of rent)",
            required: true,
            placeholder: "1",
            defaultValuePath: "stateDefaults.leasingFeeMonthsOfRent",
          },
          {
            kind: "text",
            name: "lateFeeGraceDays",
            label: "Late fee grace period (days)",
            required: true,
            placeholder: "5",
            defaultValuePath: "stateDefaults.lateFeeGraceDays",
          },
        ],
        submitLabel: "Save fees",
      },
      writeTo: "fees",
      next: "persist_fees",
    },
    {
      kind: "data_write",
      id: "persist_fees",
      call: {
        repo: "pmFeeSchedules",
        method: "upsert",
        args: [
          {
            companyId: { path: "company.id" },
            managementPercent: { path: "fees.managementPercent" },
            leasingFeeMonthsOfRent: { path: "fees.leasingFeeMonthsOfRent" },
            renewalFeeFlat: null,
            lateFeeFlat: null,
            lateFeeGraceDays: { path: "fees.lateFeeGraceDays" },
            nsfFeeFlat: null,
          },
        ],
      },
      writeTo: "feeSchedule",
      next: "import_mode",
    },

    // ---------- Phase 3: Portfolio import ----------
    {
      kind: "user_input",
      id: "import_mode",
      form: {
        title: "How do you want to add your portfolio?",
        description:
          "If your data is clean, use Quick Import and we'll bring it all in. If you want to verify each property first, use Guided Review.",
        fields: [
          {
            kind: "choice",
            name: "mode",
            label: "Import mode",
            required: true,
            defaultValue: "quick",
            options: [
              { value: "quick", label: "Quick — accept everything the AI mapped" },
              { value: "guided", label: "Guided — review each property before commit" },
              { value: "skip", label: "Skip for now — I'll add properties later" },
            ],
          },
        ],
        submitLabel: "Continue",
      },
      writeTo: "import",
      next: "branch_import_mode",
    },
    {
      kind: "branch",
      id: "branch_import_mode",
      branches: [
        { path: "import.mode", op: "eq", value: "skip", next: "end_ok" },
      ],
      default: "upload_rent_roll",
    },
    {
      kind: "user_input",
      id: "upload_rent_roll",
      form: {
        title: "Upload your rent roll",
        description:
          "CSV or Excel export. We'll auto-detect your columns. If you don't have one handy, submit without a file to use our demo sample.",
        fields: [
          {
            kind: "file_upload",
            name: "file",
            label: "Rent roll file",
            accept: ".csv,text/csv,application/vnd.ms-excel,.xlsx",
          },
        ],
        submitLabel: "Parse file",
      },
      writeTo: "upload",
      next: "parse_upload",
    },
    {
      kind: "compute",
      id: "parse_upload",
      fn: "portfolio.parseUpload",
      args: [{ path: "upload.file" }],
      writeTo: "imported",
      next: "create_import_record",
    },
    {
      kind: "data_write",
      id: "create_import_record",
      call: {
        repo: "portfolioImports",
        method: "create",
        args: [
          {
            companyId: { path: "company.id" },
            uploadedFileName: { path: "imported.fileName" },
            sourceFormat: { path: "imported.sourceFormat" },
            mappings: { path: "imported.mappings" },
            rows: { path: "imported.rows" },
          },
        ],
      },
      writeTo: "importRecord",
      next: "branch_import_shape",
    },
    {
      kind: "branch",
      id: "branch_import_shape",
      branches: [
        { path: "import.mode", op: "eq", value: "guided", next: "guided_review" },
      ],
      default: "quick_confirm",
    },

    // Shape A — quick confirm
    {
      kind: "user_input",
      id: "quick_confirm",
      form: {
        title: "Ready to import {{imported.rawRowCount}} properties?",
        description:
          "We mapped your columns automatically. Hit confirm and we'll create everything. If you'd rather review each row, go back and pick Guided.",
        fields: [
          {
            kind: "boolean",
            name: "confirmed",
            label: "Yes, create everything",
            required: true,
          },
        ],
        submitLabel: "Commit import",
      },
      writeTo: "quick",
      next: "commit_import",
    },

    // Shape B — guided review
    {
      kind: "user_input",
      id: "guided_review",
      form: {
        title: "Review your properties",
        description:
          "Each row below is one property unit we parsed. Uncheck anything you don't want imported, fix any values that look off, then commit.",
        fields: [
          {
            kind: "rows_review",
            name: "rows",
            label: "Parsed rows",
            sourcePath: "imported.rows",
            columns: [
              { field: "property.address", label: "Address" },
              { field: "property.city", label: "City" },
              { field: "property.state", label: "State" },
              { field: "unit.label", label: "Unit" },
              { field: "lease.monthlyRent", label: "Rent" },
              { field: "tenant.firstName", label: "Tenant first" },
              { field: "tenant.lastName", label: "Tenant last" },
            ],
          },
        ],
        submitLabel: "Commit reviewed rows",
      },
      writeTo: "review",
      next: "save_reviewed_rows",
    },
    {
      kind: "data_write",
      id: "save_reviewed_rows",
      call: {
        repo: "portfolioImports",
        method: "updateRows",
        args: [{ path: "importRecord.id" }, { path: "review.rows" }],
      },
      writeTo: "importRecord",
      next: "commit_import",
    },

    // Both shapes converge here
    {
      kind: "data_write",
      id: "commit_import",
      call: {
        repo: "portfolioImports",
        method: "commit",
        args: [{ path: "importRecord.id" }],
      },
      writeTo: "importRecord",
      next: "activate_company",
    },
    {
      kind: "data_write",
      id: "activate_company",
      call: {
        repo: "pmCompanies",
        method: "update",
        args: [{ path: "company.id" }, { status: "active" }],
      },
      writeTo: "company",
      next: "end_ok",
    },

    { kind: "end", id: "end_ok", outcome: "completed" },
  ],
};
