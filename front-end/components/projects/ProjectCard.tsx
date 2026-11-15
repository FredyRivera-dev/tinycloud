"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/lib/api";
import { Group, MoreVert, Trash, UserPlus } from "iconoir-react";

type Props = {
  project: Project;
  isAdmin: boolean;
  onAddMember: (p: Project) => void;
  onDelete: (p: Project) => void;
};

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  member: "bg-muted text-muted-foreground",
};

export function ProjectCard({ project, isAdmin, onAddMember, onDelete }: Props) {
  const router = useRouter();
  const description = (project.description ?? "").trim();
  const isOwner = project.my_role === "owner";
  const canManageMembers = isAdmin || isOwner;

  function handleCardClick() {
    router.push(`/projects/${project.id}`);
  }

  return (
    <Card
      onClick={handleCardClick}
      className="group relative cursor-pointer overflow-hidden border-border bg-card transition-colors hover:border-foreground/15"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate text-[14px] font-semibold leading-none">{project.name}</CardTitle>
              <span
                className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                  project.my_role
                    ? ROLE_STYLES[project.my_role] ?? ROLE_STYLES.member
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
              >
                {project.my_role ?? "admin"}
              </span>
            </div>
            <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">{project.slug}</p>
            {description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {canManageMembers && (
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground opacity-100 transition-opacity lg:h-7 lg:w-7 lg:opacity-0 lg:group-hover:opacity-100"
              >
                <MoreVert className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddMember(project);
                  }}
                  className="gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Add user
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(project);
                    }}
                    className="gap-2"
                  >
                    <Trash className="h-4 w-4" />
                    Delete project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Group className="h-3.5 w-3.5 shrink-0" />
          <span>
            {project.member_count} member{project.member_count !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
