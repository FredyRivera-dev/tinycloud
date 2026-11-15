"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { GraphUp, Cloud, Group, ArrowLeft, ViewGrid, User } from "iconoir-react";

function linkClass(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
    active
      ? "bg-muted font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}

export function MobileNav({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "admin";

  useEffect(() => {
    onNavigate();
  }, [pathname, onNavigate]);

  const segments = pathname.split("/");
  const projectId = segments[1] === "projects" && segments[2] ? segments[2] : null;
  const sub = projectId ? segments[3] ?? "" : "";

  return (
    <div
      className={cn(
        "grid bg-background transition-all duration-200 lg:hidden",
        open ? "grid-rows-[1fr] border-b border-border opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
      <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Mobile">
          {projectId ? (
            <>
              <Link href="/home" className={linkClass(false)}>
                <ArrowLeft className="h-4 w-4" />
                Projects
              </Link>
              <Link href={`/projects/${projectId}`} className={linkClass(sub === "")}>
                <ViewGrid className="h-4 w-4" />
                Overview
              </Link>
              <Link href={`/projects/${projectId}/members`} className={linkClass(sub === "members")}>
                <Group className="h-4 w-4" />
                Members
              </Link>
            </>
          ) : (
            <>
              <Link href="/home" className={linkClass(pathname === "/home")}>
                <Cloud className="h-4 w-4" />
                Projects
              </Link>
              {isAdmin && (
                <Link href="/users" className={linkClass(pathname === "/users")}>
                  <Group className="h-4 w-4" />
                  Users
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin/stats" className={linkClass(pathname === "/admin/stats")}>
                  <GraphUp className="h-4 w-4" />
                  Stats
                </Link>
              )}
              <Link href="/profile" className={linkClass(pathname === "/profile")}>
                <User className="h-4 w-4" />
                Profile
              </Link>
            </>
          )}
      </nav>
      </div>
    </div>
  );
}
