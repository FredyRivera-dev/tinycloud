"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/auth-store";
import { useUsers } from "@/hooks/useUsers";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserCard } from "@/components/users/UserCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/api";
import { Search, RefreshDouble, Group } from "iconoir-react";

const CreateUserDialog = dynamic(
  () => import("@/components/users/CreateUserDialog").then((m) => m.CreateUserDialog),
  { ssr: false }
);
const DeleteUserDialog = dynamic(
  () => import("@/components/users/DeleteUserDialog").then((m) => m.DeleteUserDialog),
  { ssr: false }
);

export default function UsersPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const { users, setUsers, loading, fetchError } = useUsers(token, role);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (token === null) {
      const timer = setTimeout(() => {
        const current = useAuthStore.getState().token;
        const curRole = useAuthStore.getState().role;
        if (!current) router.replace("/login");
        else if (curRole !== "admin") router.replace("/home");
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!token) router.replace("/login");
    else if (role !== "admin") router.replace("/home");
  }, [token, role, router]);

  const filtered = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.display_name ?? "").toLowerCase().includes(s) ||
      u.role.toLowerCase().includes(s)
    );
  });

  const isAdmin = role === "admin";

  if (token === null && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar active="users" />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader title="Users" description="Manage platform users" showCreateUser onCreateUser={() => setCreateOpen(true)} />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-[320px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input placeholder="Search by name, username, email or role" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 bg-card" />
              </div>
              <div className="text-xs text-muted-foreground">{loading ? "Loading..." : `${filtered.length} user${filtered.length !== 1 ? "s" : ""}`}</div>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
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
                  <Group className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">No users found</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">{search ? `No results for "${search}"` : "No users yet."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((u) => (
                  <UserCard key={u.id} user={u} onDelete={setDeleteTarget} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(u) => setUsers((prev) => [...prev, u])} />
      <DeleteUserDialog target={deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onDeleted={(id) => setUsers((prev) => prev.filter((x) => x.id !== id))} />
    </div>
  );
}
