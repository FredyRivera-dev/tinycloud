-- Search and hot-path indexes. pg_trgm lets the authenticated user search
-- (ILIKE '%term%') use a GIN index instead of scanning the users table.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS users_email_trgm_idx
  ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_username_trgm_idx
  ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_display_name_trgm_idx
  ON users USING gin (display_name gin_trgm_ops);

-- Listing live projects ordered by creation date.
CREATE INDEX IF NOT EXISTS projects_live_created_idx
  ON projects (created_at DESC)
  WHERE deleted_at IS NULL;

-- Owner/member filtering inside a project.
CREATE INDEX IF NOT EXISTS project_members_project_role_idx
  ON project_members (project_id, role);
