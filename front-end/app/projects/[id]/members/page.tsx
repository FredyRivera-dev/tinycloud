"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { MembersCard } from "@/components/projects/MembersCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectById, type Project } from "@/lib/api";

export default function ProjectMembersPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const projectId = params.id;
  const isAdmin = role === "admin";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) {
      const t = setTimeout(() => {
        if (!useAuthStore.getState().token) router.replace("/login");
      }, 100);
      return () => clearTimeout(t);
    }
    if (!token) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const p = await getProjectById(projectId);
        if (!cancelled) setProject(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  if (loading || token === null) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <ProjectSidebar projectId={projectId} projectName="…" active="members" />
        <div className="flex flex-1 flex-col">
          <AppHeader title="Members" description="Loading project" />
          <main className="flex-1 bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-48 w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <ProjectSidebar projectId={projectId} projectName="Not found" active="members" />
        <div className="flex flex-1 flex-col">
          <AppHeader title="Members" />
          <main className="flex-1 bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-6">
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-destructive">{error ?? "Project not found"}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/home")}>
                    Go home
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ProjectSidebar projectId={project.id} projectName={project.name} active="members" />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader title="Members" description={project.name} />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-6">
            <MembersCard project={project} canManage={isAdmin || project.my_role === "owner"} />
          </div>
        </main>
      </div>
    </div>
  );
}