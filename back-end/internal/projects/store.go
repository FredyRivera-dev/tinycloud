package projects

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound       = errors.New("project not found")
	ErrNameTaken      = errors.New("project name already exists")
	ErrSlugTaken      = errors.New("project slug already exists")
	ErrAlreadyMember  = errors.New("user is already a member of this project")
	ErrUserNotFound   = errors.New("user not found")
	ErrMemberNotFound = errors.New("member not found")
)

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	CreatedBy   *string   `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	MemberCount int       `json:"member_count"`
	MyRole      *string   `json:"my_role"`
}

type Member struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	Role        string    `json:"role"`
	ProjectRole string    `json:"project_role"`
	AddedAt     time.Time `json:"added_at"`
}

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

type scanner interface {
	Scan(dest ...any) error
}

func scanProject(row scanner) (Project, error) {
	var p Project
	err := row.Scan(
		&p.ID, &p.Name, &p.Slug, &p.Description, &p.CreatedBy,
		&p.CreatedAt, &p.UpdatedAt, &p.MemberCount, &p.MyRole,
	)
	return p, err
}

const projectSelect = `
	SELECT p.id, p.name, p.slug, p.description, p.created_by, p.created_at, p.updated_at,
	       (SELECT count(*)::int FROM project_members pmc WHERE pmc.project_id = p.id) AS member_count,
	       pm.role
	FROM projects p
	LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1`

func (s *Store) ListForUser(ctx context.Context, userID, globalRole string) ([]Project, error) {
	rows, err := s.db.Query(ctx, projectSelect+`
		WHERE p.deleted_at IS NULL AND ($2 = 'admin' OR pm.user_id IS NOT NULL)
		ORDER BY p.created_at DESC`, userID, globalRole)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Project, 0)
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetForUser(ctx context.Context, projectID, userID, globalRole string) (Project, error) {
	p, err := scanProject(s.db.QueryRow(ctx, projectSelect+`
		WHERE p.id = $2 AND p.deleted_at IS NULL`, userID, projectID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Project{}, ErrNotFound
	}
	if err != nil {
		return Project{}, err
	}
	if globalRole != "admin" && p.MyRole == nil {
		return Project{}, ErrNotFound
	}
	return p, nil
}

func (s *Store) MemberRole(ctx context.Context, projectID, userID string) (string, error) {
	var role string
	err := s.db.QueryRow(ctx, `
		SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, userID,
	).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrMemberNotFound
	}
	return role, err
}

func (s *Store) Create(ctx context.Context, name, slug, description, createdBy string) (Project, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Project{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var p Project
	err = tx.QueryRow(ctx, `
		INSERT INTO projects (id, name, slug, description, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, slug, description, created_by, created_at, updated_at`,
		uuid.NewString(), name, slug, description, createdBy,
	).Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return Project{}, mapProjectError(err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO project_members (project_id, user_id, role)
		VALUES ($1, $2, 'owner')`, p.ID, createdBy,
	); err != nil {
		return Project{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Project{}, err
	}

	p.MemberCount = 1
	role := "owner"
	p.MyRole = &role
	return p, nil
}

func (s *Store) Update(ctx context.Context, id string, name, slug, description *string) error {
	var returned string
	err := s.db.QueryRow(ctx, `
		UPDATE projects SET
			name = COALESCE($2, name),
			slug = COALESCE($3, slug),
			description = COALESCE($4, description),
			updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id`, id, name, slug, description,
	).Scan(&returned)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return mapProjectError(err)
}

func (s *Store) SoftDelete(ctx context.Context, id string) error {
	var returned string
	err := s.db.QueryRow(ctx, `
		UPDATE projects SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id`, id,
	).Scan(&returned)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Store) ListMembers(ctx context.Context, projectID string) ([]Member, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.role, m.role, m.created_at
		FROM project_members m
		JOIN users u ON u.id = m.user_id
		WHERE m.project_id = $1
		ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Member, 0)
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.Role, &m.ProjectRole, &m.AddedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) Member(ctx context.Context, projectID, userID string) (Member, error) {
	var m Member
	err := s.db.QueryRow(ctx, `
		SELECT u.id, u.username, u.display_name, u.role, m.role, m.created_at
		FROM project_members m
		JOIN users u ON u.id = m.user_id
		WHERE m.project_id = $1 AND m.user_id = $2`,
		projectID, userID,
	).Scan(&m.ID, &m.Username, &m.DisplayName, &m.Role, &m.ProjectRole, &m.AddedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, ErrMemberNotFound
	}
	return m, err
}

func (s *Store) AddMember(ctx context.Context, projectID, userID, role string) (Member, error) {
	var exists bool
	if err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, userID,
	).Scan(&exists); err != nil {
		return Member{}, err
	}
	if !exists {
		return Member{}, ErrUserNotFound
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO project_members (project_id, user_id, role)
		VALUES ($1, $2, $3)`, projectID, userID, role)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case "23505":
				return Member{}, ErrAlreadyMember
			case "23503":
				if pgErr.ConstraintName == "project_members_user_id_fkey" {
					return Member{}, ErrUserNotFound
				}
				return Member{}, ErrNotFound
			}
		}
		return Member{}, err
	}
	return s.Member(ctx, projectID, userID)
}

func (s *Store) UpdateMemberRole(ctx context.Context, projectID, userID, role string) (Member, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE project_members SET role = $3
		WHERE project_id = $1 AND user_id = $2`, projectID, userID, role)
	if err != nil {
		return Member{}, err
	}
	if tag.RowsAffected() == 0 {
		return Member{}, ErrMemberNotFound
	}
	return s.Member(ctx, projectID, userID)
}

func (s *Store) RemoveMember(ctx context.Context, projectID, userID string) error {
	tag, err := s.db.Exec(ctx, `
		DELETE FROM project_members
		WHERE project_id = $1 AND user_id = $2`, projectID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrMemberNotFound
	}
	return nil
}

func mapProjectError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "projects_name_uq":
			return ErrNameTaken
		case "projects_slug_uq":
			return ErrSlugTaken
		}
	}
	return err
}
