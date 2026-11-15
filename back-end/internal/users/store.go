package users

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("user not found")
	ErrEmailTaken    = errors.New("email already exists")
	ErrUsernameTaken = errors.New("username already exists")
	ErrLastAdmin     = errors.New("cannot delete the last admin")
	ErrSetupComplete = errors.New("setup already completed")
)

// setupLockID serializes concurrent first-run setup attempts so two requests
// cannot both create an administrator.
const setupLockID int64 = 727274849

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email,omitempty"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"created_at"`
}

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) ByID(ctx context.Context, id string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
		SELECT id, email, username, display_name, role, created_at
		FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) ByUsername(ctx context.Context, username string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
		SELECT id, email, username, display_name, role, created_at
		FROM users WHERE username = lower($1) LIMIT 1`, username,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

// FindForLogin returns the public user plus the stored password hash.
func (s *Store) FindForLogin(ctx context.Context, identifier string) (User, string, error) {
	var u User
	var hash string
	err := s.db.QueryRow(ctx, `
		SELECT id, email, username, display_name, role, created_at, password_hash
		FROM users
		WHERE email = lower($1) OR username = lower($1)
		LIMIT 1`, identifier,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrNotFound
	}
	return u, hash, err
}

// List is the admin listing: it includes emails.
func (s *Store) List(ctx context.Context, q string, limit, offset int) ([]User, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, email, username, display_name, role, created_at
		FROM users
		WHERE $1 = '' OR email ILIKE '%' || $1 || '%'
		   OR username ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%'
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]User, 0, limit)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// Search is the authenticated, privacy-safe user search used to add project
// members. It never returns emails.
func (s *Store) Search(ctx context.Context, q string, limit int) ([]User, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, username, display_name, role, created_at
		FROM users
		WHERE $1 = '' OR username ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%'
		ORDER BY username ASC
		LIMIT $2`, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]User, 0, limit)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) Create(ctx context.Context, email, username, displayName, passwordHash, role string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
		INSERT INTO users (id, email, username, display_name, password_hash, role)
		VALUES ($1, lower($2), lower($3), $4, $5, $6)
		RETURNING id, email, username, display_name, role, created_at`,
		uuid.NewString(), email, username, displayName, passwordHash, role,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt)
	if err != nil {
		return User{}, mapUserError(err)
	}
	return u, nil
}

func (s *Store) UpdateProfile(ctx context.Context, id string, username, displayName *string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
		UPDATE users SET
			username = COALESCE($2, username),
			display_name = COALESCE($3, display_name),
			updated_at = now()
		WHERE id = $1
		RETURNING id, email, username, display_name, role, created_at`,
		id, username, displayName,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, mapUserError(err)
	}
	return u, nil
}

// Delete refuses to remove the final admin inside a transaction, so two
// concurrent deletes cannot leave the platform without an administrator.
func (s *Store) Delete(ctx context.Context, id string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var role string
	err = tx.QueryRow(ctx, `SELECT role FROM users WHERE id = $1 FOR UPDATE`, id).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if role == "admin" {
		var admins int
		if err := tx.QueryRow(ctx, `SELECT count(*)::int FROM users WHERE role = 'admin'`).Scan(&admins); err != nil {
			return err
		}
		if admins <= 1 {
			return ErrLastAdmin
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Count(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `SELECT count(*)::int FROM users`).Scan(&n)
	return n, err
}

// SetupNeeded reports whether the instance has no users yet. The first-run
// screen uses it to offer creating the initial administrator.
func (s *Store) SetupNeeded(ctx context.Context) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users)`).Scan(&exists)
	return !exists, err
}

// CreateFirstAdmin creates the initial administrator only when the users table
// is empty. A transaction-scoped advisory lock serializes concurrent attempts,
// so exactly one caller can win even if two setup requests arrive together.
func (s *Store) CreateFirstAdmin(ctx context.Context, email, username, displayName, passwordHash string) (User, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, setupLockID); err != nil {
		return User{}, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users)`).Scan(&exists); err != nil {
		return User{}, err
	}
	if exists {
		return User{}, ErrSetupComplete
	}

	var u User
	err = tx.QueryRow(ctx, `
		INSERT INTO users (id, email, username, display_name, password_hash, role)
		VALUES ($1, lower($2), lower($3), $4, $5, 'admin')
		RETURNING id, email, username, display_name, role, created_at`,
		uuid.NewString(), email, username, displayName, passwordHash,
	).Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.CreatedAt)
	if err != nil {
		return User{}, mapUserError(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}
	return u, nil
}

// EnsureAdmin creates the bootstrap administrator only when the email does not
// exist yet. It never overwrites an existing account or password.
func (s *Store) EnsureAdmin(ctx context.Context, email, username, displayName, passwordHash string) (bool, error) {
	var id string
	err := s.db.QueryRow(ctx, `SELECT id FROM users WHERE email = lower($1) LIMIT 1`, email).Scan(&id)
	if err == nil {
		return false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}

	_, err = s.Create(ctx, email, username, displayName, passwordHash, "admin")
	if errors.Is(err, ErrEmailTaken) {
		return false, nil
	}
	if errors.Is(err, ErrUsernameTaken) {
		return false, fmt.Errorf("admin username %q is already used by another account", username)
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func mapUserError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "users_email_lower_uq":
			return ErrEmailTaken
		case "users_username_lower_uq":
			return ErrUsernameTaken
		}
	}
	return err
}
