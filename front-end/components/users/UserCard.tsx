"use client";

import { Button } from "@/components/ui/button";
import type { User } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { UserAvatar } from "@/components/users/UserAvatar";
import Link from "next/link";
import { Trash } from "iconoir-react";

type Props = {
  user: User;
  onDelete: (u: User) => void;
};

export function UserCard({ user, onDelete }: Props) {
  const currentUsername = useAuthStore((s) => s.username);
  const isSelf = user.username === currentUsername;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
        <UserAvatar seed={user.username} size={32} />
      </div>
      <Link href={`/profile/${user.username}`} className="min-w-0 flex-1 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{user.display_name || user.username}</span>
          {isSelf && (
            <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              You
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          @{user.username}
          {user.email ? ` · ${user.email}` : ""}
        </div>
      </Link>
      <span className="shrink-0 text-xs capitalize text-muted-foreground sm:hidden">{user.role}</span>
      <span className="hidden sm:inline-flex rounded-md bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">{user.role}</span>
      <div className="flex shrink-0 items-center gap-1">
        {!isSelf && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(user)}
            className="hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete @${user.username}`}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
