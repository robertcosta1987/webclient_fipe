-- 0004_auth.sql — application authentication: users + single-use invite codes.
-- Idempotent. Access is closed: registration requires a valid invite code, and
-- the session is a signed httpOnly cookie (see src/lib/auth/*).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'users')
BEGIN
  CREATE TABLE users (
    id             UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    email          NVARCHAR(254)    NOT NULL,
    name           NVARCHAR(120)    NULL,
    password_hash  NVARCHAR(256)    NOT NULL,
    password_salt  NVARCHAR(64)     NOT NULL,
    role           NVARCHAR(20)     NOT NULL DEFAULT 'user',     -- 'admin' | 'user'
    status         NVARCHAR(20)     NOT NULL DEFAULT 'active',   -- 'active' | 'disabled'
    created_at     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    last_login_at  DATETIME2        NULL
  );
END;
GO

-- Email is the login identifier — unique (SQL Server default collation is
-- case-insensitive; we also lowercase on write).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_users_email' AND object_id = OBJECT_ID('users'))
  CREATE UNIQUE INDEX ux_users_email ON users(email);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'invite_codes')
BEGIN
  CREATE TABLE invite_codes (
    code        NVARCHAR(40)     NOT NULL PRIMARY KEY,
    created_by  UNIQUEIDENTIFIER NULL,
    used_by     UNIQUEIDENTIFIER NULL,
    used_at     DATETIME2        NULL,
    expires_at  DATETIME2        NULL,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO
