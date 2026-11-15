"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

function decodeRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const json = atob(base64);
    const data = JSON.parse(json);
    return data.role ?? null;
  } catch {
    return null;
  }
}

type AuthState = {
  token: string | null;
  role: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
  setSession: (params: { token: string; email?: string; username?: string; displayName?: string }) => void;
  setProfile: (params: { email: string; username: string; displayName: string }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      email: null,
      username: null,
      displayName: null,
      setSession: ({ token, email, username, displayName }) => {
        const role = decodeRole(token);
        set({ token, role, email: email ?? null, username: username ?? null, displayName: displayName ?? null });
      },
      setProfile: ({ email, username, displayName }) => set({ email, username, displayName }),
      clearSession: () => set({ token: null, role: null, email: null, username: null, displayName: null }),
    }),
    {
      name: "tinycloud-auth",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return undefined as unknown as Storage;
        return localStorage;
      }),
      partialize: (state) => ({
        token: state.token,
        role: state.role,
        email: state.email,
        username: state.username,
        displayName: state.displayName,
      }),
    }
  )
);
