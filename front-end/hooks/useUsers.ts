"use client";

import { useState, useEffect } from "react";
import { getAdminUsers, type User } from "@/lib/api";

export function useUsers(token: string | null, role: string | null) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || role !== "admin") return;
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await getAdminUsers({ limit: 100 });
        if (!cancelled) setUsers(data);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load users";
          if (msg.includes("Invalid or expired token")) return;
          setFetchError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [token, role]);

  return { users, setUsers, loading, fetchError };
}
