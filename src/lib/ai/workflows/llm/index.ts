import { ClaudeLlmClient } from "./claude";
import type { LlmClient } from "./contracts";
import { StubLlmClient } from "./stub";

export type { LlmClient, LlmMessage, LlmRequest, LlmResponse } from "./contracts";

let instance: LlmClient | null = null;

export function getLlmClient(): LlmClient {
  if (instance) return instance;
  const backend = (import.meta.env?.VITE_LLM_BACKEND ?? "stub") as string;
  switch (backend) {
    case "stub":
      instance = new StubLlmClient();
      break;
    case "claude": {
      const key = import.meta.env?.VITE_ANTHROPIC_API_KEY as string | undefined;
      if (!key) {
        console.warn(
          "[llm] VITE_LLM_BACKEND=claude but VITE_ANTHROPIC_API_KEY missing; falling back to stub.",
        );
        instance = new StubLlmClient();
      } else {
        instance = new ClaudeLlmClient(key);
      }
      break;
    }
    default:
      console.warn(`[llm] Unknown VITE_LLM_BACKEND="${backend}", using stub.`);
      instance = new StubLlmClient();
  }
  return instance;
}

export function __resetLlmClientForTests() {
  instance = null;
}
