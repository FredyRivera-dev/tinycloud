"use client";

import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, validateEmail, validateUsername, type GlobalRole, type User } from "@/lib/api";
import { RefreshDouble } from "iconoir-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (u: User) => void;
};

export function CreateUserDialog({ open, onOpenChange, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<GlobalRole>("user");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function reset() {
    setEmail("");
    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("user");
    setEmailError(null);
    setUsernameError(null);
    setFormError(null);
  }

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email.trim());
    if (eErr) {
      setEmailError(eErr);
      return;
    }
    setEmailError(null);
    const uErr = validateUsername(username.trim().toLowerCase());
    if (uErr) {
      setUsernameError(uErr);
      return;
    }
    setUsernameError(null);
    if (!displayName.trim()) {
      setFormError("Display name is required");
      return;
    }
    if (!password || password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }
    if (!role) {
      setFormError("Role is required");
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      const user = await createUser({ email: email.trim(), username: username.trim().toLowerCase(), display_name: displayName.trim(), password, role });
      onCreated(user);
      handleOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      if (msg.toLowerCase().includes("email")) setEmailError(msg);
      else if (msg.toLowerCase().includes("username")) setUsernameError(msg);
      else setFormError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Create a platform user. Email and username must be unique, and email is only visible to the user and admins.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-display-name">Display name</Label>
            <Input
              id="user-display-name"
              type="text"
              placeholder="Ada Lovelace"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-username">Username</Label>
            <Input
              id="user-username"
              type="text"
              autoComplete="off"
              placeholder="ada"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError(null);
              }}
              aria-invalid={!!usernameError}
            />
            {usernameError ? (
              <p className="text-xs text-destructive">{usernameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">3-30 chars: lowercase letters, numbers, . _ -. Also used to sign in</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              aria-invalid={!!emailError}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">Password</Label>
            <Input id="user-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole((value as GlobalRole) ?? "user")}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <RefreshDouble className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
