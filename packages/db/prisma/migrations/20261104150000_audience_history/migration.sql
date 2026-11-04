CREATE TABLE "audience_sample" (
  "webinarId" TEXT NOT NULL,
  "sampledAt" TIMESTAMP(3) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "online" INTEGER NOT NULL CHECK ("online" >= 0),
  CONSTRAINT "audience_sample_pkey" PRIMARY KEY ("webinarId", "sampledAt"),
  CONSTRAINT "audience_sample_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "audience_sample_webinarId_observedAt_idx" ON "audience_sample"("webinarId", "observedAt");
