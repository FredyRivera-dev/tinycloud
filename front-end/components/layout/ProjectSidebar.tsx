"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ViewGrid, Group } from "iconoir-react";

type Props = {
  projectId: string;
  projectName: string;
  active: "overview" | "members";
};

export function ProjectSidebar({ projectId, projectName, active }: Props) {
  const pathname = usePathname();
  const isOverview = active === "overview" || pathname === `/projects/${projectId}`;

  return (
    <aside className="group/sidebar hidden shrink-0 flex-col rounded-xl bg-sidebar lg:flex w-[56px] hover:w-[220px] transition-all duration-200 overflow-hidden sticky top-3 h-[calc(100vh-1.5rem)] self-start m-3 mr-0">
      <nav className="flex flex-1 flex-col gap-1 p-2 pt-3">
        <div className="mb-2 flex items-center justify-center gap-0 py-1 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-2.5">
          <Image src="/logo.svg" alt="TinyCloud" width={32} height={32} className="h-8 w-8 shrink-0" />
          <span className="hidden whitespace-nowrap text-sm font-semibold tracking-tight group-hover/sidebar:block">TinyCloud</span>
        </div>

        <Link
          href="/home"
          className="mb-1 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
          <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">
            Back to projects
          </span>
        </Link>

        <div className="my-1 h-px bg-border opacity-0 group-hover/sidebar:opacity-100 transition-opacity" />

        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground opacity-0 group-hover/sidebar:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">
          {projectName}
        </div>

        <Link
          href={`/projects/${projectId}`}
          className={
            isOverview
              ? "flex items-center gap-3 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground"
              : "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          <ViewGrid className="h-[18px] w-[18px] shrink-0" />
          <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">Overview</span>
        </Link>

        <Link
          href={`/projects/${projectId}/members`}
          className={
            active === "members"
              ? "flex items-center gap-3 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground"
              : "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          <Group className="h-[18px] w-[18px] shrink-0" />
          <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 overflow-hidden">Members</span>
        </Link>
      </nav>
    </aside>
  );
}