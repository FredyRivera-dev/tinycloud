"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/auth-store";
import { completeSetup } from "@/lib/api";

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export function SetupForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupTaken, setSetupTaken] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedUsername = username.trim().toLowerCase();
    if (!displayName.trim()) {
      setError("Please enter a display name");
      return;
    }
    if (!USERNAME_RE.test(normalizedUsername)) {
      setError("Username must be 3-30 characters: lowercase letters, numbers, dot, underscore or hyphen");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await completeSetup({
        email: email.trim(),
        username: normalizedUsername,
        display_name: displayName.trim(),
        password,
      });
      setSession({
        token,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
      });
      router.replace("/home");
    } catch (err) {
      const status = (err as unknown as { status?: number }).status;
      if (status === 409) {
        setSetupTaken(true);
        setError("This instance already has an administrator. Sign in instead.");
      } else {
        setError(err instanceof Error ? err.message : "Could not create the administrator");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={loading || setupTaken}
          className="bg-card"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          placeholder="ada"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading || setupTaken}
          className="bg-card"
        />
        <p className="text-xs text-muted-foreground">
          3-30 characters: lowercase letters, numbers, dot, underscore or hyphen.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || setupTaken}
          className="bg-card"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading || setupTaken}
          className="bg-card"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading || setupTaken}
          className="bg-card"
        />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          {setupTaken && (
            <>
              {" "}
              <Link href="/login" className="font-medium underline underline-offset-4">
                Go to sign in
              </Link>
            </>
          )}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading || setupTaken}>
        {loading ? "Creating administrator..." : "Create administrator"}
      </Button>
    </form>
  );
}
