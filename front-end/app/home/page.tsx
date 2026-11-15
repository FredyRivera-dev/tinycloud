"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/auth-store";
import { useProjects } from "@/hooks/useProjects";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/lib/api";
import { Search, ViewGrid, List, RefreshDouble, Cloud, Plus } from "iconoir-react";

const CreateProjectDialog = dynamic(
  () => import("@/components/projects/CreateProjectDialog").then((m) => m.CreateProjectDialog),
  { ssr: false }
);
const AddMemberDialog = dynamic(
  () => import("@/components/projects/AddMemberDialog").then((m) => m.AddMemberDialog),
  { ssr: false }
);
const DeleteProjectDialog = dynamic(
  () => import("@/components/projects/DeleteProjectDialog").then((m) => m.DeleteProjectDialog),
  { ssr: false }
);

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const { projects, setProjects, loading, fetchError } = useProjects(token);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [addMemberTarget, setAddMemberTarget] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (token === null) {
      const timer = setTimeout(() => {
        const current = useAuthStore.getState().token;
        if (!current) router.replace("/login");
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!token) router.replace("/login");
  }, [token, router]);

  const isAdmin = role === "admin";
  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    if ((p.description ?? "").toLowerCase().includes(q)) return true;
    if (p.slug.toLowerCase().includes(q)) return true;
    return false;
  });

  if (token === null && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar active="projects" />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader
          title="Projects"
          description="A mini-cloud for deploying your projects."
          showCreateProject={isAdmin}
          onCreateProject={() => setCreateOpen(true)}
        />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-[320px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input placeholder="Search for a project" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 bg-card" />
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1 rounded-md border border-border bg-card p-1 sm:flex">
                  <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon-xs" onClick={() => setViewMode("grid")} aria-label="Grid view">
                    <ViewGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon-xs" onClick={() => setViewMode("list")} aria-label="List view">
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">{loading ? "Loading..." : `${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}</div>
              </div>
            </div>

            {loading ? (
              <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-border bg-card">
                    <CardHeader>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : fetchError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {fetchError}
                <Button variant="outline" size="sm" className="ml-3" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Cloud className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">No projects yet</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {search ? `No results for "${search}"` : isAdmin ? "Create your first project to get started." : "You are not a member of any project yet. Contact an admin."}
                </p>
                {isAdmin && !search && (
                  <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create project
                  </Button>
                )}
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} isAdmin={isAdmin} onAddMember={setAddMemberTarget} onDelete={setDeleteTarget} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(p) => setProjects((prev) => [...prev, p])} />
      <DeleteProjectDialog target={deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onDeleted={(id) => setProjects((prev) => prev.filter((p) => p.id !== id))} />
      <AddMemberDialog project={addMemberTarget} open={!!addMemberTarget} onOpenChange={(o) => !o && setAddMemberTarget(null)} />
    </div>
  );
}
