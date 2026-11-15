"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { getMe, updateMe, validateUsername } from "@/lib/api";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RefreshDouble } from "iconoir-react";

function FloatingField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  maxLength,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string | null;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          placeholder=" "
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className="peer h-12 bg-black px-3.5 pt-5 text-sm"
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-150",
            "peer-focus:top-3 peer-focus:text-[11px] peer-focus:text-muted-foreground",
            value && "top-3 text-[11px]"
          )}
        >
          {label}
        </label>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
    getMe()
      .then((me) => {
        setEmail(me.email ?? "");
        setUsername(me.username);
        setDisplayName(me.display_name);
        setEditName(me.display_name);
        setEditUsername(me.username);
        setProfile({ email: me.email ?? "", username: me.username, displayName: me.display_name });
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [token, router, setProfile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uErr = validateUsername(editUsername.trim().toLowerCase());
    if (uErr) {
      setUsernameError(uErr);
      return;
    }
    setUsernameError(null);
    if (!editName.trim()) {
      setFormError("Display name is required");
      return;
    }
    setFormError(null);
    setSaved(false);
    setSaving(true);
    try {
      const me = await updateMe({ username: editUsername.trim().toLowerCase(), display_name: editName.trim() });
      setUsername(me.username);
      setDisplayName(me.display_name);
      setEditUsername(me.username);
      setEditName(me.display_name);
      setProfile({ email: me.email ?? "", username: me.username, displayName: me.display_name });
      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      if (msg.toLowerCase().includes("username")) setUsernameError(msg);
      else setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (token === null && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshDouble className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar active="profile" />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader title="Profile" description="Your account identity" />
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
            {loading ? (
              <div className="flex flex-col items-center space-y-3 pt-6">
                <Skeleton className="h-24 w-24 rounded-xl" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="space-y-10">
                <div className="flex items-center justify-center gap-6 pt-6">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl">
                    <UserAvatar seed={username} size={112} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold tracking-tight">{displayName}</h2>
                      {role && (
                        <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                          {role}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      @{username}
                      {email ? ` · ${email}` : ""}
                    </p>
                  </div>
                </div>

                <section className="mx-auto w-full max-w-md space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold tracking-tight">Edit profile</h3>
                    <p className="text-xs text-muted-foreground">
                      Your display name and username. The username is also used to sign in, and only you and admins can see your email.
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <FloatingField
                      id="profile-name"
                      label="Display name"
                      value={editName}
                      onChange={setEditName}
                      maxLength={100}
                      disabled={saving}
                    />
                    <FloatingField
                      id="profile-username"
                      label="Username"
                      value={editUsername}
                      onChange={(v) => {
                        setEditUsername(v);
                        if (usernameError) setUsernameError(null);
                      }}
                      hint="3-30 chars: lowercase letters, numbers, . _ -"
                      error={usernameError}
                      disabled={saving}
                    />
                    {formError && <p className="text-xs text-destructive">{formError}</p>}
                    {saved && <p className="text-xs text-emerald-500">Profile updated</p>}
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                  </form>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
