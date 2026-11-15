"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { UserAvatar } from "@/components/users/UserAvatar";
import { MobileNav } from "@/components/layout/MobileNav";
import { LogOut, Plus, User, Menu, Xmark } from "iconoir-react";

type Props = {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  showCreateProject?: boolean;
  onCreateProject?: () => void;
  showCreateUser?: boolean;
  onCreateUser?: () => void;
};

export function AppHeader({ title, description, action, showCreateProject, onCreateProject, showCreateUser, onCreateUser }: Props) {
  const router = useRouter();
  const username = useAuthStore((s) => s.username);
  const displayName = useAuthStore((s) => s.displayName);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMenuOpen(false), []);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const createAction = action ?? (showCreateProject && onCreateProject ? { label: "Create project", onClick: onCreateProject } : showCreateUser && onCreateUser ? { label: "Create user", onClick: onCreateUser } : undefined);

  return (
    <>
    <header className="flex h-14 items-center justify-between gap-3 bg-background px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          {description && <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {createAction && (
          <Button onClick={createAction.onClick} size="sm" className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{createAction.label}</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          {menuOpen ? <Xmark className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-muted outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="User menu"
          >
            <UserAvatar seed={username ?? "user"} size={32} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[260px] p-0">
            <div className="px-3 py-3">
              <div className="truncate text-sm font-bold">{displayName || username || "-"}</div>
              <div className="truncate text-xs text-muted-foreground">{username ? `@${username}` : ""}</div>
            </div>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-1">
              <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2">
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <MobileNav open={menuOpen} onNavigate={closeMobileNav} />
    </>
  );
}
