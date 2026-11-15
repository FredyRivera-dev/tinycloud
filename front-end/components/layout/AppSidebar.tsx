"use client";

import Image from "next/image";
import Link from "next/link";
import { GraphUp, Cloud, Group, User } from "iconoir-react";
import { useAuthStore } from "@/lib/auth-store";

type Props = {
  active: "projects" | "users" | "stats" | "profile" | "none";
};

export function AppSidebar({ active }: Props) {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "admin";

  return (
    <aside className="group/sidebar hidden shrink-0 flex-col rounded-xl bg-sidebar lg:flex w-[56px] hover:w-[220px] transition-all duration-200 overflow-hidden sticky top-3 h-[calc(100vh-1.5rem)] self-start m-3 mr-0">
      <nav className="flex flex-1 flex-col gap-1 p-2 pt-3">
        <div className="mb-2 flex items-center justify-center gap-0 py-1 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-2.5">
          <Image src="/logo.svg" alt="TinyCloud" width={32} height={32} className="h-8 w-8 shrink-0" />
          <span className="hidden whitespace-nowrap text-sm font-semibold tracking-tight group-hover/sidebar:block">TinyCloud</span>
        </div>
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground opacity-0 group-hover/sidebar:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">
          Overview
        </div>
        <Link
          href="/home"
          className={
            active === "projects"
              ? "flex items-center gap-3 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground"
              : "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          <Cloud className="h-[18px] w-[18px] shrink-0" />
          <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">Projects</span>
        </Link>
        {isAdmin && (
          <Link
            href="/users"
            className={
              active === "users"
                ? "flex items-center gap-3 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground"
                : "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          >
            <Group className="h-[18px] w-[18px] shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">Users</span>
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/stats"
            className={
              active === "stats"
                ? "flex items-center gap-3 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground"
                : "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          >
            <GraphUp className="h-[18px] w-[18px] shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">Stats</span>
          </Link>
        )}
        <Link
          href="/profile"
          className={
            active === "profile"
              ? "flex items-center gap-3 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground"
              : "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          <User className="h-[18px] w-[18px] shrink-0" />
          <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">Profile</span>
        </Link>
      </nav>
    </aside>
  );
}
