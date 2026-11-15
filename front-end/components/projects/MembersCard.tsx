"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddMemberDialog } from "@/components/projects/AddMemberDialog";
import { useAuthStore } from "@/lib/auth-store";
import {
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
  type Member,
  type Project,
  type ProjectRole,
} from "@/lib/api";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ArrowDown, ArrowUp, Crown, Group, MoreVert, Plus, RefreshDouble, Trash } from "iconoir-react";

type Props = {
  project: Project;
  /** Admins and project owners can manage members. */
  canManage: boolean;
};

const PROJECT_ROLE_STYLES: Record<ProjectRole, string> = {
  owner: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  member: "bg-muted text-muted-foreground",
};

export function MembersCard({ project, canManage }: Props) {
  const globalRole = useAuthStore((s) => s.role);
  const currentUsername = useAuthStore((s) => s.username);
  const isAdmin = globalRole === "admin";

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectMembers(project.id);
      setMembers(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load members";
      if (msg.includes("Invalid or expired token")) return;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getProjectMembers(project.id);
        if (!cancelled) setMembers(data);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load members";
        if (msg.includes("Invalid or expired token")) return;
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  async function handleRoleChange(member: Member, role: ProjectRole) {
    if (member.project_role === role || updatingId) return;
    setUpdatingId(member.id);
    setError(null);
    try {
      const updated = await updateProjectMemberRole(project.id, member.id, role);
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update member role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeProjectMember(project.id, removeTarget.id);
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  function canRemove(member: Member) {
    if (isAdmin) return true;
    // Owners can only remove regular members, never other owners or themselves.
    return canManage && member.project_role === "member";
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              Members
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{members.length}</span>
            </h2>
            <p className="text-xs text-muted-foreground">Users with access to this project.</p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          )}
        </div>
        <div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error && members.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <span className="min-w-0 break-words">{error}</span>
              <Button variant="outline" size="xs" className="shrink-0" onClick={fetchMembers}>
                Retry
              </Button>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
              <Group className="h-5 w-5" />
              <p className="mt-2 text-sm font-medium">No members yet</p>
              <p className="text-xs text-muted-foreground">Add users to grant them access to this project.</p>
              {canManage && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add member
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <span className="min-w-0 break-words">{error}</span>
                  <Button variant="outline" size="xs" className="shrink-0" onClick={fetchMembers}>
                    Retry
                  </Button>
                </div>
              )}
              <div className="space-y-2">
              {members.map((m) => {
                const isSelf = m.username === currentUsername;
                const busy = updatingId === m.id;
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                      <UserAvatar seed={m.username} size={32} />
                    </div>
                    <Link href={`/profile/${m.username}`} className="min-w-0 flex-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{m.display_name || m.username}</span>
                        {isSelf && (
                          <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            You
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">@{m.username}</div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {m.role === "admin" && (
                        <span className="hidden rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 sm:inline-flex">
                          admin
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium capitalize ${PROJECT_ROLE_STYLES[m.project_role]}`}
                      >
                        {m.project_role === "owner" && <Crown className="h-3 w-3" />}
                        {m.project_role}
                      </span>
                    </div>
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={busy}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          aria-label={`Manage ${m.username}`}
                        >
                          {busy ? <RefreshDouble className="h-4 w-4 animate-spin" /> : <MoreVert className="h-4 w-4" />}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {m.project_role === "member" ? (
                            <DropdownMenuItem className="gap-2" onClick={() => void handleRoleChange(m, "owner")}>
                              <ArrowUp className="h-4 w-4" />
                              Make owner
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="gap-2" onClick={() => void handleRoleChange(m, "member")}>
                              <ArrowDown className="h-4 w-4" />
                              Make member
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            className="gap-2"
                            onClick={() => setRemoveTarget(m)}
                          >
                            <Trash className="h-4 w-4" />
                            Remove from project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : canRemove(m) ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setRemoveTarget(m)}
                        className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove @${m.username}`}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="h-8 w-8 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium text-foreground">{removeTarget?.display_name || removeTarget?.username}</span> from{" "}
              <span className="font-medium text-foreground">{project.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing} className="gap-1.5">
              {removing ? <RefreshDouble className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMemberDialog project={project} open={addOpen} onOpenChange={setAddOpen} onAdded={fetchMembers} />
    </>
  );
}
