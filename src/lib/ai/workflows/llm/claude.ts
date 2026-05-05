import type { LlmClient, LlmRequest, LlmResponse } from "./contracts";

/**
 * Direct Anthropic API client. Opt-in via VITE_LLM_BACKEND=claude; requires
 * VITE_ANTHROPIC_API_KEY at build time.
 *
 * Note: hitting Anthropic directly from the browser exposes the API key. For
 * production we want this call to go through our Cloud Run API — at that point
 * the same contract still applies, we just swap the fetch URL and drop the
 * key header. For now this exists so the shape is provably correct.
 */
export class ClaudeLlmClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-opus-4-7",
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const body = {
      model: this.model,
      max_tokens: 1024,
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API ${res.status}: ${err}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      stop_reason: string;
    };
    const text = json.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    return {
      text,
      stop: json.stop_reason === "end_turn" ? "end_turn" : "max_tokens",
    };
  }
}
