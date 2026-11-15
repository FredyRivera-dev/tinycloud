-- TinyCloud core schema. Clean install: users, projects, project membership
-- and host samples. No instance/docker/GitHub tables.

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Names and slugs are unique among live projects. Soft-deleted projects free
-- their name/slug for reuse.
CREATE UNIQUE INDEX projects_name_uq ON projects (lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX projects_slug_uq ON projects (lower(slug)) WHERE deleted_at IS NULL;

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_members_user_idx ON project_members (user_id);

CREATE TABLE host_samples (
  sampled_at TIMESTAMPTZ PRIMARY KEY,
  hostname TEXT NOT NULL DEFAULT '',
  cpu_usage_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  cpu_load_1 DOUBLE PRECISION NOT NULL DEFAULT 0,
  cpu_load_5 DOUBLE PRECISION NOT NULL DEFAULT 0,
  cpu_load_15 DOUBLE PRECISION NOT NULL DEFAULT 0,
  ncpu INTEGER NOT NULL DEFAULT 0,
  mem_total_mb DOUBLE PRECISION NOT NULL DEFAULT 0,
  mem_used_mb DOUBLE PRECISION NOT NULL DEFAULT 0,
  mem_available_mb DOUBLE PRECISION NOT NULL DEFAULT 0,
  disk_total_gb DOUBLE PRECISION NOT NULL DEFAULT 0,
  disk_used_gb DOUBLE PRECISION NOT NULL DEFAULT 0,
  uptime_seconds BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX host_samples_sampled_at_idx ON host_samples (sampled_at DESC);
