import type { LlmClient, LlmRequest, LlmResponse } from "./contracts";

/**
 * Deterministic stub LLM. Produces something useful-looking per `label` so the
 * workflow engine can be exercised end-to-end without an API key. When
 * expectJson is true, returns a syntactically valid JSON string.
 */
export class StubLlmClient implements LlmClient {
  async complete(req: LlmRequest): Promise<LlmResponse> {
    const label = req.label ?? "generic";
    if (req.expectJson) {
      return { text: JSON.stringify(stubJson(label, req)), stop: "end_turn" };
    }
    return { text: stubText(label, req), stop: "end_turn" };
  }
}

function stubText(label: string, req: LlmRequest): string {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const snippet = lastUser?.content.slice(0, 140) ?? "";
  switch (label) {
    case "house_check_summary":
      return [
        "Property check complete. Exterior and interior appeared secure with no visible issues.",
        "HVAC running within expected range. No signs of leaks or pests noted.",
        "Flagged for owner review: none. Recommend next check on schedule.",
      ].join(" ");
    default:
      return `[stub:${label}] ${snippet}`;
  }
}

function stubJson(label: string, req: LlmRequest): unknown {
  switch (label) {
    case "house_check_summary":
      return {
        headline: "All clear",
        issues: [],
        recommendations: ["Next check on schedule"],
      };
    case "ai_prefill_profile":
      return {
        dba: null,
        ein: null,
        brandPrimaryColor: "#0A84FF",
        brandSecondaryColor: "#111827",
        logoUrl: null,
        notes:
          "Stub AI prefill — in production this would draw on public records and your website. Edit freely.",
      };
    default:
      return { label, echo: req.messages.at(-1)?.content ?? null };
  }
}
