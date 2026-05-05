import type { AuthUser, Role } from "../../data/types";
import type { AuthClient, AuthListener, AuthState } from "../contracts";

const STORAGE_KEY = "prop-hub-suite.mock-auth.v1";

const DEMO_USERS: Record<Role, AuthUser> = {
  admin: {
    id: "user_admin_1",
    email: "admin@example.com",
    displayName: "Alex Admin",
    role: "admin",
  },
  property_manager: {
    id: "user_pm_1",
    email: "pm@example.com",
    displayName: "Pat Manager",
    role: "property_manager",
  },
  owner_investor: {
    id: "user_owner_1",
    email: "owner@example.com",
    displayName: "Olivia Owner",
    role: "owner_investor",
  },
  tenant: {
    id: "user_tenant_1",
    email: "tenant@example.com",
    displayName: "Toni Tenant",
    role: "tenant",
  },
  house_watcher: {
    // matches seed.ts buildSeed() watcher userId so workflow lookups connect
    id: "user_watcher_1",
    email: "jamie@example.com",
    displayName: "Jamie Rivera",
    role: "house_watcher",
  },
};

/**
 * Dev-only auth. Persists the selected role in localStorage so page reloads
 * keep you in the same persona. Swap for Firebase Auth when ready.
 */
export class MockAuthClient implements AuthClient {
  private state: AuthState;
  private listeners = new Set<AuthListener>();

  constructor() {
    this.state = hydrate();
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async signInAsRole(role: Role): Promise<AuthUser> {
    const user = DEMO_USERS[role];
    this.setState({ status: "authenticated", user });
    return user;
  }

  async signOut(): Promise<void> {
    this.setState({ status: "unauthenticated" });
  }

  private setState(next: AuthState) {
    this.state = next;
    persist(next);
    for (const l of this.listeners) l(next);
  }
}

function hydrate(): AuthState {
  if (typeof window === "undefined") return { status: "unauthenticated" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "unauthenticated" };
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed.status === "authenticated" && parsed.user) return parsed;
    return { status: "unauthenticated" };
  } catch {
    return { status: "unauthenticated" };
  }
}

function persist(state: AuthState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort
  }
}
