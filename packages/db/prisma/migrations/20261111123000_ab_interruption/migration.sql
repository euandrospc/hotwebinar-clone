-- Preserve an interruption even after the user resumes or completes the test.
-- This prevents optional stopping through pause from appearing as a full-horizon run.
ALTER TABLE "ab_experiment" ADD COLUMN "interruptedAt" TIMESTAMP(3);
