import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDataClient } from "../../data";
import { getLlmClient } from "./llm";
import { WorkflowRunner, type StartOptions } from "./runner";
import type { JsonValue, RunnerSnapshot, WorkflowDefinition } from "./types";
import { useAuth } from "../../auth/useAuth";

export interface UseWorkflowResult {
  snapshot: RunnerSnapshot | null;
  start: (opts?: StartOptions) => Promise<void>;
  submitInput: (values: Record<string, JsonValue>) => Promise<void>;
  cancel: () => Promise<void>;
  error: string | null;
}

/**
 * React hook that owns a single WorkflowRunner instance for the lifetime of
 * the component. Consumers render whatever `snapshot` describes — the same
 * component can drive any workflow since all the behavior lives in the
 * definition + runner.
 *
 * The hook does NOT auto-start; callers invoke `start()` when ready. That
 * keeps render-time side effects out of the workflow engine.
 */
export function useWorkflow(
  definition: WorkflowDefinition,
): UseWorkflowResult {
  const auth = useAuth();
  const runnerRef = useRef<WorkflowRunner | null>(null);
  const [snapshot, setSnapshot] = useState<RunnerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build a fresh runner when the auth user or workflow definition changes.
  const runner = useMemo(() => {
    if (auth.status !== "authenticated") return null;
    try {
      return new WorkflowRunner(definition, {
        data: getDataClient(),
        llm: getLlmClient(),
        user: auth.user,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [auth, definition]);

  useEffect(() => {
    runnerRef.current = runner;
    setSnapshot(runner?.snapshot() ?? null);
  }, [runner]);

  const start = useCallback(
    async (opts: StartOptions = {}) => {
      const r = runnerRef.current;
      if (!r) return;
      setError(null);
      try {
        // Seed `state.user` so workflows can reference auth in paths.
        const merged = {
          ...(opts.initialState ?? {}),
          user:
            auth.status === "authenticated"
              ? {
                  id: auth.user.id,
                  email: auth.user.email,
                  displayName: auth.user.displayName,
                  role: auth.user.role,
                }
              : null,
        } as Record<string, JsonValue>;
        const snap = await r.start({ ...opts, initialState: merged });
        setSnapshot(snap);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [auth],
  );

  const submitInput = useCallback(async (values: Record<string, JsonValue>) => {
    const r = runnerRef.current;
    if (!r) return;
    setError(null);
    try {
      const snap = await r.submitInput(values);
      setSnapshot(snap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const cancel = useCallback(async () => {
    const r = runnerRef.current;
    if (!r) return;
    try {
      const snap = await r.cancel();
      setSnapshot(snap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { snapshot, start, submitInput, cancel, error };
}
