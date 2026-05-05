/**
 * LlmClient contract. Implementations:
 *   - StubLlmClient  — deterministic fake, used in dev and tests
 *   - ClaudeLlmClient — direct Anthropic API call (requires VITE_ANTHROPIC_API_KEY)
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system?: string;
  messages: LlmMessage[];
  /** Hint to implementations that JSON is expected; stub honors this. */
  expectJson?: boolean;
  /** Caller-supplied label so stubs and logs can correlate calls. */
  label?: string;
}

export interface LlmResponse {
  text: string;
  stop: "end_turn" | "max_tokens" | "error";
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<LlmResponse>;
}
