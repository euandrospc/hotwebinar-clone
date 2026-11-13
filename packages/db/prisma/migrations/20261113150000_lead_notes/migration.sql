-- CreateTable
CREATE TABLE "lead_note" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_note_leadId_createdAt_idx" ON "lead_note"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
