"use client";

import { useState, useEffect } from "react";
import { getProjects, type Project } from "@/lib/api";

export function useProjects(token: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await getProjects();
        if (!cancelled) setProjects(data);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load projects";
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
  }, [token]);

  return { projects, setProjects, loading, fetchError };
}
