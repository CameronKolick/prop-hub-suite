import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthClient } from "@/lib/auth";
import { useAuth } from "@/lib/auth/useAuth";
import { houseCheckWorkflow, useWorkflow } from "@/lib/ai/workflows";
import { WorkflowFormRenderer } from "@/components/workflows/WorkflowFormRenderer";

/**
 * Mobile-first preview of the house-check workflow.
 *
 * This is the web stand-in for what will become the Expo house-watcher app:
 * single-purpose, no chrome, role auto-resolved. Useful for dev and demo; not
 * the final mobile story.
 *
 * Lives outside the Supabase auth gate and auto-signs the mock auth client in
 * as the seeded house watcher so the URL "just works."
 */
export default function MobileHouseCheck() {
  const auth = useAuth();
  const [autoSignInTried, setAutoSignInTried] = useState(false);

  useEffect(() => {
    if (auth.status === "unauthenticated" && !autoSignInTried) {
      setAutoSignInTried(true);
      void getAuthClient().signInAsRole("house_watcher");
    }
  }, [auth.status, autoSignInTried]);

  if (auth.status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Signing in…</p>
      </div>
    );
  }

  return <WorkflowShell />;
}

function WorkflowShell() {
  const { snapshot, start, submitInput, cancel, error } =
    useWorkflow(houseCheckWorkflow);
  const [starting, setStarting] = useState(false);

  const status = snapshot?.status ?? "idle";

  async function handleStart() {
    setStarting(true);
    try {
      await start();
    } finally {
      setStarting(false);
    }
  }

  // Auto-start on first mount so landing on the page drops the user straight
  // into the workflow — no splash.
  useEffect(() => {
    if (status === "idle" && !starting) {
      void handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header status={status} />

      <main className="flex-1 px-4 py-5 max-w-lg w-full mx-auto">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 mb-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        {status === "running" || status === "idle" ? (
          <p className="text-sm text-muted-foreground">Working…</p>
        ) : null}

        {status === "awaiting_input" && snapshot?.awaitingStep ? (
          <WorkflowFormRenderer
            form={snapshot.awaitingStep.form}
            onSubmit={submitInput}
            state={snapshot.state}
          />
        ) : null}

        {status === "completed" ? (
          <CompletedSummary
            summary={extractSummary(snapshot?.state)}
            onRestart={() => window.location.reload()}
          />
        ) : null}

        {(status === "failed" || status === "cancelled") ? (
          <div className="space-y-3">
            <p className="text-sm">
              {status === "failed"
                ? "Something went wrong."
                : "Check cancelled."}
            </p>
            <Button onClick={() => window.location.reload()}>Start over</Button>
          </div>
        ) : null}
      </main>

      {status === "awaiting_input" || status === "running" ? (
        <footer className="sticky bottom-0 border-t bg-background px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="text-muted-foreground w-full"
          >
            Cancel this check
          </Button>
        </footer>
      ) : null}
    </div>
  );
}

function Header({ status }: { status: string }) {
  return (
    <header className="sticky top-0 border-b bg-background px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold">House Check</h1>
        <p className="text-xs text-muted-foreground">
          Mobile preview · mock backend
        </p>
      </div>
      <Badge variant="outline" className="text-xs">
        {status}
      </Badge>
    </header>
  );
}

function CompletedSummary({
  summary,
  onRestart,
}: {
  summary: string | null;
  onRestart: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 bg-card">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Check complete
        </p>
        {summary ? (
          <p className="text-sm leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Check saved. Summary not available.
          </p>
        )}
      </div>
      <Button onClick={onRestart} className="w-full">
        Start another check
      </Button>
    </div>
  );
}

function extractSummary(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const s = (state as { summary?: unknown }).summary;
  return typeof s === "string" ? s : null;
}
