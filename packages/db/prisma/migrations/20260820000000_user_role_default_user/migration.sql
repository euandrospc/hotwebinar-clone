-- Security hardening: change the default role for new users from 'admin' to 'user'.
-- New accounts must be explicitly promoted to admin (the seed does this); a stray
-- INSERT that omits role no longer creates an admin by default.
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';
