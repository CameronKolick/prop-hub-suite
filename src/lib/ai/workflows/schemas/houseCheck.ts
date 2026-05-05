import type { WorkflowDefinition } from "../types";

/**
 * First end-to-end workflow: a house watcher completes a single check.
 *
 * Shape: select property → create + start session → capture observations
 * → AI-generated summary → mark session completed with summary.
 *
 * Item-by-item checklist iteration (one step per CheckTemplateItem) will be
 * added when the runner learns `loop` steps. For v1 we stay linear.
 */
export const houseCheckWorkflow: WorkflowDefinition = {
  id: "wf.house_check.v1",
  name: "House Check",
  description: "Guided walkthrough for a house watcher to complete a property check.",
  allowedRoles: ["house_watcher", "admin"],
  entry: "load_watcher",
  steps: [
    {
      kind: "data_read",
      id: "load_watcher",
      call: {
        repo: "houseWatchers",
        method: "getByUserId",
        args: [{ path: "user.id" }],
      },
      writeTo: "watcher",
      next: "load_properties",
    },
    {
      kind: "data_read",
      id: "load_properties",
      call: {
        repo: "properties",
        method: "listForHouseWatcher",
        args: [{ path: "watcher.id" }],
      },
      writeTo: "properties",
      next: "pick_property",
    },
    {
      kind: "user_input",
      id: "pick_property",
      form: {
        title: "Which property are you checking?",
        fields: [
          {
            kind: "text",
            name: "propertyId",
            label: "Property ID",
            required: true,
            placeholder: "Copy the id from your assigned list",
          },
        ],
        submitLabel: "Start check",
      },
      writeTo: "selection",
      next: "load_selected_property",
    },
    {
      kind: "data_read",
      id: "load_selected_property",
      call: {
        repo: "properties",
        method: "get",
        args: [{ path: "selection.propertyId" }],
      },
      writeTo: "property",
      next: "branch_property_found",
    },
    {
      kind: "branch",
      id: "branch_property_found",
      branches: [{ path: "property", op: "not_exists", next: "end_not_found" }],
      default: "create_session",
    },
    {
      kind: "data_write",
      id: "create_session",
      call: {
        repo: "checkSessions",
        method: "create",
        args: [
          {
            propertyId: { path: "selection.propertyId" },
            templateId: "tpl_standard_house_check",
            houseWatcherId: { path: "watcher.id" },
            scheduledFor: new Date().toISOString(),
          },
        ],
      },
      writeTo: "session",
      next: "mark_in_progress",
    },
    {
      kind: "data_write",
      id: "mark_in_progress",
      call: {
        repo: "checkSessions",
        method: "updateStatus",
        args: [{ path: "session.id" }, "in_progress"],
      },
      writeTo: "session",
      next: "capture_observations",
    },
    {
      kind: "user_input",
      id: "capture_observations",
      form: {
        title: "Walkthrough notes",
        description:
          "Record anything you noticed — exterior, interior, systems. The assistant will turn this into a summary.",
        fields: [
          {
            kind: "boolean",
            name: "allClear",
            label: "Everything looked normal?",
          },
          {
            kind: "text",
            name: "notes",
            label: "Observations",
            multiline: true,
            placeholder:
              "e.g. exterior secure, HVAC running, one small package on porch, no leaks or pests.",
          },
        ],
        submitLabel: "Generate summary",
      },
      writeTo: "observations",
      next: "generate_summary",
    },
    {
      kind: "ai_prompt",
      id: "generate_summary",
      system:
        "You are an assistant that writes concise, professional property check summaries for a house watcher's client. Keep it under 120 words. Lead with the overall status, then note any issues or follow-ups.",
      prompt:
        "Property: {{property.address}}, {{property.city}}, {{property.state}} {{property.postalCode}}.\n" +
        "Owner notes on file: {{property.notes}}\n" +
        "All-clear flag: {{observations.allClear}}\n" +
        "Watcher observations: {{observations.notes}}\n\n" +
        "Write the summary now.",
      writeTo: "summary",
      next: "persist_summary",
    },
    {
      kind: "data_write",
      id: "persist_summary",
      call: {
        repo: "checkSessions",
        method: "updateStatus",
        args: [
          { path: "session.id" },
          "completed",
          { summary: { path: "summary" } },
        ],
      },
      next: "end_ok",
    },
    { kind: "end", id: "end_ok", outcome: "completed" },
    { kind: "end", id: "end_not_found", outcome: "cancelled" },
  ],
};
