import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthClient } from "@/lib/auth";
import { useAuth } from "@/lib/auth/useAuth";
import { getDataClient } from "@/lib/data";
import type { Role } from "@/lib/data/types";
import {
  houseCheckWorkflow,
  pmOnboardingWorkflow,
  useWorkflow,
} from "@/lib/ai/workflows";
import type { WorkflowDefinition } from "@/lib/ai/workflows";
import { WorkflowFormRenderer } from "@/components/workflows/WorkflowFormRenderer";
import { clearStore } from "@/lib/data/mock/storage";

const ROLES: Role[] = [
  "house_watcher",
  "admin",
  "property_manager",
  "owner_investor",
  "tenant",
];

/**
 * Dev-only page that exercises the end-to-end workflow engine:
 *   role switcher → start workflow → walk each step → see final state.
 *
 * Lives outside the Supabase auth gate so it works without a real login.
 */
export default function WorkflowsDemo() {
  const auth = useAuth();
  const [signingIn, setSigningIn] = useState<Role | null>(null);

  async function signIn(role: Role) {
    setSigningIn(role);
    try {
      await getAuthClient().signInAsRole(role);
    } finally {
      setSigningIn(null);
    }
  }

  async function signOut() {
    await getAuthClient().signOut();
  }

  function resetMockData() {
    clearStore();
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Workflow Engine Demo</h1>
          <p className="text-sm text-muted-foreground">
            Dev harness for the new AI workflow engine. Backend is in-memory /
            localStorage. No real data is touched.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.status === "authenticated" ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge>{auth.user.role}</Badge>
                  <span className="text-sm">
                    {auth.user.displayName} · {auth.user.email}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">Sign in as a role to start:</p>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={r === "property_manager" ? "default" : "outline"}
                      disabled={signingIn !== null}
                      onClick={() => signIn(r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetMockData}
                className="text-xs text-muted-foreground"
              >
                Reset mock data
              </Button>
            </div>
          </CardContent>
        </Card>

        {auth.status === "authenticated" ? (
          <>
            <WorkflowPanel
              definition={pmOnboardingWorkflow}
              startLabel="Start PM company onboarding"
            />
            <WorkflowPanel
              definition={houseCheckWorkflow}
              startLabel="Start house check"
            />
          </>
        ) : null}

        <PropertiesPreview />
      </div>
    </div>
  );
}

function WorkflowPanel({
  definition,
  startLabel,
}: {
  definition: WorkflowDefinition;
  startLabel: string;
}) {
  const { snapshot, start, submitInput, cancel, error } = useWorkflow(definition);
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      await start();
    } finally {
      setStarting(false);
    }
  }

  const status = snapshot?.status ?? "idle";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{definition.name}</CardTitle>
          <Badge variant="outline">{status}</Badge>
        </div>
        {definition.description ? (
          <p className="text-xs text-muted-foreground">
            {definition.description}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {status === "idle" ||
        status === "completed" ||
        status === "cancelled" ||
        status === "failed" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleStart} disabled={starting}>
              {starting ? "Starting…" : startLabel}
            </Button>
            {status !== "idle" ? (
              <span className="text-xs text-muted-foreground">
                Last run ended: {status}
              </span>
            ) : null}
          </div>
        ) : null}

        {status === "awaiting_input" && snapshot?.awaitingStep ? (
          <WorkflowFormRenderer
            form={snapshot.awaitingStep.form}
            onSubmit={submitInput}
            state={snapshot.state}
          />
        ) : null}

        {status === "running" ? (
          <p className="text-sm text-muted-foreground">Working…</p>
        ) : null}

        {(status === "completed" ||
          status === "awaiting_input" ||
          status === "running" ||
          status === "failed") && snapshot ? (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Workflow state
              </span>
              {status === "awaiting_input" || status === "running" ? (
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Cancel run
                </Button>
              ) : null}
            </div>
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-[400px]">
              {JSON.stringify(snapshot.state, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PropertiesPreview() {
  const [items, setItems] = useState<
    Array<{ id: string; address: string; city: string; state: string }>
  >([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const data = getDataClient();
      // Mock seed assigns all properties to the demo watcher. Listing by
      // the known watcher id is enough for a preview.
      const watcher = await data.houseWatchers.getByUserId("user_watcher_1");
      if (!watcher) return;
      const list = await data.properties.listForHouseWatcher(watcher.id);
      if (live) setItems(list);
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seeded properties</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No properties yet. Reload after resetting mock data if this stays empty.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2"
              >
                <span>
                  {p.address}, {p.city}, {p.state}
                </span>
                <code className="text-xs text-muted-foreground">{p.id}</code>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Tip: during the workflow's "pick property" step, paste one of these IDs.
        </p>
      </CardContent>
    </Card>
  );
}
