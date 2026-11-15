"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { getMe, getUserByUsername, type User } from "@/lib/api";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshDouble } from "iconoir-react";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [user, setUser] = useState<User | null>(null);
  const [isOwn, setIsOwn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (token === null) {
      const timer = setTimeout(() => {
        if (!useAuthStore.getState().token) router.replace("/login");
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([getUserByUsername(params.username), getMe()])
      .then(([viewed, me]) => {
        setUser(viewed);
        setIsOwn(viewed.id === me.id);
      })
      .catch((e) => {
        if (e instanceof Error && e.message === "User not found") setNotFound(true);
        else router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [token, params.username, router]);

  if (token === null && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar active={isOwn ? "profile" : "none"} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader title="Profile" description="Member identity" />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
            {loading ? (
              <div className="flex items-center justify-center gap-6 pt-6">
                <Skeleton className="h-28 w-28 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ) : notFound || !user ? (
              <div className="flex flex-col items-center pt-16 text-center">
                <p className="text-sm font-medium">User not found</p>
                <p className="mt-1 text-xs text-muted-foreground">No member exists with username @{params.username}.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/home")}>
                  Go home
                </Button>
              </div>
            ) : isOwn ? (
              <div className="flex items-center justify-center gap-6 pt-6">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl">
                  <UserAvatar seed={user.username} size={112} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-semibold tracking-tight">{user.display_name}</h2>
                    <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                      {user.role}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    @{user.username}
                    {user.email ? ` · ${user.email}` : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center pt-6 text-center">
                <div className="h-36 w-36 overflow-hidden rounded-2xl">
                  <UserAvatar seed={user.username} size={144} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <h2 className="truncate text-2xl font-semibold tracking-tight">{user.display_name}</h2>
                  <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {user.role}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  @{user.username}
                  {user.email ? ` · ${user.email}` : ""}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
