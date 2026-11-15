"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/users/UserAvatar";
import { useAuthStore } from "@/lib/auth-store";
import {
  addProjectMember,
  searchUsers,
  type Project,
  type ProjectRole,
  type User,
} from "@/lib/api";
import { RefreshDouble, Search } from "iconoir-react";

type Props = {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
};

export function AddMemberDialog({ project, open, onOpenChange, onAdded }: Props) {
  const role = useAuthStore((s) => s.role);
  const currentUsername = useAuthStore((s) => s.username);
  const isAdmin = role === "admin";

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setQuery("");
      setSelected(null);
      setProjectRole("member");
      setError(null);
      setSuccess(null);
      setSearchResults([]);
      setShowResults(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(q, 10);
        setSearchResults(users.filter((u) => u.username !== currentUsername));
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open, currentUsername]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!selected) {
      setError("Search and select a user first");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await addProjectMember(project.id, selected.id, projectRole);
      setSuccess(`@${selected.username} added to ${project.name}`);
      onAdded?.();
      setQuery("");
      setSelected(null);
      setSearchResults([]);
      setShowResults(false);
      setTimeout(() => handleOpenChange(false), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add member";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function selectUser(u: User) {
    setSelected(u);
    setQuery(u.username);
    setShowResults(false);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add user to {project?.name}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Search a user and choose whether they join as owner or member."
              : "Search and select a user to add as a member."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-search">User</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                id="member-search"
                placeholder="Search by username or name"
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  setSelected(null);
                  if (value.trim()) {
                    setShowResults(true);
                  } else {
                    setSearchResults([]);
                    setShowResults(false);
                  }
                }}
                onFocus={() => setShowResults(true)}
                autoComplete="off"
                className="pl-8"
              />
              {showResults && (searching || searchResults.length > 0) && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {searching ? (
                    <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                      <RefreshDouble className="mr-2 h-3 w-3 animate-spin" /> Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No users found</div>
                  ) : (
                    searchResults.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectUser(u)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                      >
                        <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md">
                          <UserAvatar seed={u.username} size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{u.display_name || u.username}</div>
                          <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                        </div>
                        <span className="text-[11px] capitalize text-muted-foreground">{u.role}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Type to search, click to select</p>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="member-role">Project role</Label>
              <Select value={projectRole} onValueChange={(v) => setProjectRole((v as ProjectRole) ?? "member")}>
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {success && <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{success}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <RefreshDouble className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
