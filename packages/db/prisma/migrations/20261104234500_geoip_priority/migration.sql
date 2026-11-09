ALTER TABLE "geo_ip_lookup" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "geo_ip_lookup_status_nextAttemptAt_idx";
CREATE INDEX "geo_ip_lookup_status_priority_nextAttemptAt_idx" ON "geo_ip_lookup"("status", "priority", "nextAttemptAt");
