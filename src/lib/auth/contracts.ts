/**
 * AuthClient contract — single interface for all authentication and role lookup
 * in new workflow-driven code. Today backed by MockAuthClient; Firebase Auth
 * will implement the same interface when the infra engineer wires it up.
 */

import type { AuthUser, Role } from "../data/types";

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser };

export type AuthListener = (state: AuthState) => void;

export interface AuthClient {
  getState(): AuthState;
  subscribe(listener: AuthListener): () => void;
  signInAsRole(role: Role): Promise<AuthUser>;
  signOut(): Promise<void>;
}
