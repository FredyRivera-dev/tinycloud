"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { MembersCard } from "@/components/projects/MembersCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getProjectById,
  updateProject,
  validateDescription,
  validateProjectSlug,
  type Project,
} from "@/lib/api";
import { Group, RefreshDouble, Trash } from "iconoir-react";

const DeleteProjectDialog = dynamic(
  () => import("@/components/projects/DeleteProjectDialog").then((m) => m.DeleteProjectDialog),
  { ssr: false }
);

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  member: "bg-muted text-muted-foreground",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const globalRole = useAuthStore((s) => s.role);
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAdmin = globalRole === "admin";

  const syncForm = useCallback((p: Project) => {
    setName(p.name);
    setSlug(p.slug);
    setDescription(p.description ?? "");
    setNameError(null);
    setSlugError(null);
    setFormError(null);
    setSaved(false);
  }, []);

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
        if (cancelled) return;
        setProject(p);
        syncForm(p);
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
  }, [projectId, token, syncForm]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError(null);
    if (isAdmin) {
      const sErr = validateProjectSlug(slug.trim());
      if (sErr) {
        setSlugError(sErr);
        return;
      }
      setSlugError(null);
    }
    const dErr = validateDescription(description.trim());
    if (dErr) {
      setFormError(dErr);
      return;
    }
    setFormError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim(),
        ...(isAdmin ? { slug: slug.trim() } : {}),
      });
      setProject(updated);
      syncForm(updated);
      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update project";
      if (msg.toLowerCase().includes("slug")) setSlugError(msg);
      else if (msg.toLowerCase().includes("name")) setNameError(msg);
      else setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading || token === null) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <ProjectSidebar projectId={projectId} projectName="…" active="overview" />
        <div className="flex flex-1 flex-col">
          <AppHeader title="Project" description="Loading project details" />
          <main className="flex-1 bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
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
        <ProjectSidebar projectId={projectId} projectName="Not found" active="overview" />
        <div className="flex flex-1 flex-col">
          <AppHeader title="Project" />
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

  const canManage = isAdmin || project.my_role === "owner";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ProjectSidebar projectId={project.id} projectName={project.name} active="overview" />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader title={project.name} description={project.slug} />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-6 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate text-lg font-semibold tracking-tight">{project.name}</CardTitle>
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                          project.my_role ? ROLE_STYLES[project.my_role] ?? ROLE_STYLES.member : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {project.my_role ?? "admin"}
                      </span>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">{project.slug}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Group className="h-3.5 w-3.5" />
                    {project.member_count} member{project.member_count !== 1 ? "s" : ""}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <p className="text-sm text-muted-foreground">
                  {project.description?.trim() || "No description yet."}
                </p>
                <p className="text-xs text-muted-foreground">Created {formatDate(project.created_at)}</p>
              </CardContent>
            </Card>

            {canManage && (
              <Card>
                <CardHeader>
                  <CardTitle>Project settings</CardTitle>
                  <CardDescription>
                    {isAdmin
                      ? "Edit the project name, slug and description."
                      : "Edit the project name and description. Only admins can change the slug."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Name</Label>
                      <Input
                        id="project-name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (nameError) setNameError(null);
                          setSaved(false);
                        }}
                        aria-invalid={!!nameError}
                        disabled={saving}
                      />
                      {nameError ? (
                        <p className="text-xs text-destructive">{nameError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">1-100 characters</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-slug">Slug</Label>
                      <Input
                        id="project-slug"
                        value={slug}
                        onChange={(e) => {
                          setSlug(e.target.value);
                          if (slugError) setSlugError(null);
                          setSaved(false);
                        }}
                        aria-invalid={!!slugError}
                        disabled={!isAdmin || saving}
                        className="font-mono"
                      />
                      {slugError ? (
                        <p className="text-xs text-destructive">{slugError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isAdmin ? "3-40 chars: lowercase letters, numbers and hyphens" : "Only admins can change the slug"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description</Label>
                      <Textarea
                        id="project-description"
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setSaved(false);
                        }}
                        maxLength={1000}
                        rows={3}
                        disabled={saving}
                      />
                      <p className="text-xs text-muted-foreground">{description.trim().length}/1000</p>
                    </div>
                    {formError && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {formError}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={saving} className="gap-1.5">
                        {saving ? (
                          <>
                            <RefreshDouble className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save changes"
                        )}
                      </Button>
                      {saved && <span className="text-xs text-emerald-500">Project updated</span>}
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <MembersCard project={project} canManage={canManage} />

            {isAdmin && (
              <section className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Danger zone</h2>
                  <p className="text-xs text-muted-foreground">Irreversible actions for this project.</p>
                </div>
                <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Delete this project</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently remove the project and all of its memberships. This cannot be undone.
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" className="shrink-0 gap-1.5" onClick={() => setDeleteOpen(true)}>
                    <Trash className="h-4 w-4" />
                    Delete project
                  </Button>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
      <DeleteProjectDialog
        target={deleteOpen ? project : null}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
        onDeleted={() => router.replace("/home")}
      />
    </div>
  );
}
