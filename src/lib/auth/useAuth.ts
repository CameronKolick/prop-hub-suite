import { useEffect, useState } from "react";
import { getAuthClient } from ".";
import type { AuthState } from "./contracts";

/**
 * Subscribe to the workflow-side auth client. This is independent of the
 * legacy Supabase AuthContext — new workflow code should use this hook so it
 * swaps cleanly to Firebase Auth later.
 */
export function useAuth(): AuthState {
  const client = getAuthClient();
  const [state, setState] = useState<AuthState>(() => client.getState());

  useEffect(() => {
    return client.subscribe(setState);
  }, [client]);

  return state;
}
