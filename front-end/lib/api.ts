import { useAuthStore } from "@/lib/auth-store";

const rawUrl =
  (process.env.NEXT_PUBLIC_API_URL as string) ||
  (process.env.API_URL as string) ||
  "";
export const API_URL =
  rawUrl.replace(/^["']|["']$/g, "").replace(/\/$/, "") || "/api";

export type GlobalRole = "admin" | "user";
export type ProjectRole = "owner" | "member";

export type User = {
  id: string;
  /** Only present for yourself and for admins. */
  email?: string;
  username: string;
  display_name: string;
  role: GlobalRole;
  created_at?: string;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  /** Null only for global admins who are not members of the project. */
  my_role: ProjectRole | null;
};

export type Member = {
  id: string;
  username: string;
  display_name: string;
  role: GlobalRole;
  project_role: ProjectRole;
  added_at: string;
};

export type HostSample = {
  sampled_at: string;
  hostname: string;
  cpu_usage_pct: number;
  cpu_load_1: number;
  cpu_load_5: number;
  cpu_load_15: number;
  ncpu: number;
  mem_total_mb: number;
  mem_used_mb: number;
  mem_available_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  uptime_seconds: number;
};

export type StatsCounts = {
  users: number;
  projects: number;
  members: number;
};

export type StatsOverview = {
  host: HostSample;
  counts: StatsCounts;
};

export type DailyHostSample = {
  day: string;
  avg_cpu_pct: number;
  max_cpu_pct: number;
  avg_mem_used_mb: number;
  max_mem_used_mb: number;
  avg_disk_used_gb: number;
  max_disk_used_gb: number;
  samples: number;
};

export type StatsHistory = {
  days: number;
  tz: string;
  host: DailyHostSample[];
};

type ApiError = {
  error: string;
  message: string;
};

function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function handleUnauthorized(res: Response) {
  if (res.status === 401) {
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  let msg = fallback;
  try {
    const j = (await res.json()) as ApiError;
    msg = j.message || msg;
  } catch {}
  const err = new Error(msg);
  (err as unknown as { status: number }).status = res.status;
  return err;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  fallback = "Request failed",
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 401) {
    await handleUnauthorized(res);
    throw new Error("Invalid or expired token");
  }
  if (!res.ok) throw await parseError(res, fallback);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function authHeaders(json = false): Record<string, string> {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeader(),
  };
}

// --- Validation (mirrors the API rules) ---

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address";
  return null;
}

export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(value)) {
    return "Username must be 3-30 chars: lowercase letters, numbers, . _ -";
  }
  return null;
}

export function validateProjectSlug(slug: string): string | null {
  const value = slug.trim();
  if (!value) return null;
  if (!/^[a-z0-9-]{3,40}$/.test(value)) {
    return "Slug must be 3-40 chars: lowercase letters, numbers and hyphens";
  }
  return null;
}

export function validateDescription(description: string): string | null {
  if (description.trim().length > 1000) return "Description must be 1000 characters or less";
  return null;
}

// --- Setup and auth ---

export type SetupPayload = {
  email: string;
  username: string;
  display_name: string;
  password: string;
};

/** Public: true while the instance has no users and needs its first admin. */
export async function getSetupStatus(): Promise<{ needs_setup: boolean }> {
  const res = await fetch(`${API_URL}/setup/status`, { cache: "no-store" });
  if (!res.ok) throw await parseError(res, "Failed to check setup status");
  return (await res.json()) as { needs_setup: boolean };
}

/** Creates the initial administrator and returns an authenticated session. */
export async function completeSetup(
  params: SetupPayload,
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw await parseError(res, "Failed to create the administrator");
  return (await res.json()) as { token: string; user: User };
}

export async function login(
  identifier: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw await parseError(res, "Invalid credentials");
  return (await res.json()) as { token: string; user: User };
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me", { headers: authHeaders() }, "Failed to fetch profile");
}

export async function updateMe(params: {
  username?: string;
  display_name?: string;
}): Promise<User> {
  return apiFetch<User>(
    "/auth/me",
    {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify(params),
    },
    "Failed to update profile",
  );
}

// --- Users ---

/** Authenticated, privacy-safe search used to add project members. */
export async function searchUsers(q: string, limit = 20): Promise<User[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiFetch<User[]>(
    `/users?${params.toString()}`,
    { headers: authHeaders() },
    "Failed to search users",
  );
}

export async function getUserByUsername(username: string): Promise<User> {
  return apiFetch<User>(
    `/users/${encodeURIComponent(username)}`,
    { headers: authHeaders() },
    "Failed to fetch user",
  );
}

export async function getAdminUsers(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<User[]> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  query.set("limit", String(params?.limit ?? 100));
  if (params?.offset) query.set("offset", String(params.offset));
  return apiFetch<User[]>(
    `/admin/users?${query.toString()}`,
    { headers: authHeaders() },
    "Failed to fetch users",
  );
}

export type CreateUserPayload = {
  email: string;
  username: string;
  display_name: string;
  password: string;
  role: GlobalRole;
};

export async function createUser(params: CreateUserPayload): Promise<User> {
  return apiFetch<User>(
    "/admin/users",
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(params),
    },
    "Failed to create user",
  );
}

export async function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(
    `/admin/users/${id}`,
    { method: "DELETE", headers: authHeaders() },
    "Failed to delete user",
  );
}

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects", { headers: authHeaders() }, "Failed to fetch projects");
}

export async function getProjectById(id: string): Promise<Project> {
  return apiFetch<Project>(
    `/projects/${id}`,
    { headers: authHeaders() },
    "Failed to fetch project",
  );
}

export type CreateProjectPayload = {
  name: string;
  slug?: string;
  description: string;
};

export async function createProject(params: CreateProjectPayload): Promise<Project> {
  return apiFetch<Project>(
    "/projects",
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(params),
    },
    "Failed to create project",
  );
}

export type UpdateProjectPayload = {
  name?: string;
  slug?: string;
  description?: string;
};

export async function updateProject(
  id: string,
  params: UpdateProjectPayload,
): Promise<Project> {
  return apiFetch<Project>(
    `/projects/${id}`,
    {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify(params),
    },
    "Failed to update project",
  );
}

export async function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(
    `/projects/${id}`,
    { method: "DELETE", headers: authHeaders() },
    "Failed to delete project",
  );
}

// --- Project members ---

export async function getProjectMembers(projectId: string): Promise<Member[]> {
  return apiFetch<Member[]>(
    `/projects/${projectId}/members`,
    { headers: authHeaders() },
    "Failed to fetch members",
  );
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole = "member",
): Promise<Member> {
  return apiFetch<Member>(
    `/projects/${projectId}/members`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ user_id: userId, role }),
    },
    "Failed to add member",
  );
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<Member> {
  return apiFetch<Member>(
    `/projects/${projectId}/members/${userId}`,
    {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ role }),
    },
    "Failed to update member role",
  );
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${projectId}/members/${userId}`,
    { method: "DELETE", headers: authHeaders() },
    "Failed to remove member",
  );
}

// --- Stats (admin) ---

export async function getStatsOverview(): Promise<StatsOverview> {
  return apiFetch<StatsOverview>(
    "/admin/stats/overview",
    { headers: authHeaders() },
    "Failed to fetch host stats",
  );
}

export async function getStatsHistory(params: {
  days: number;
  tz?: string;
}): Promise<StatsHistory> {
  const query = new URLSearchParams({ days: String(params.days) });
  if (params.tz) query.set("tz", params.tz);
  return apiFetch<StatsHistory>(
    `/admin/stats/history?${query.toString()}`,
    { headers: authHeaders() },
    "Failed to fetch host history",
  );
}
