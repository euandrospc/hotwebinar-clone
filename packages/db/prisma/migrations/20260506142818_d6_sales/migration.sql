-- CreateTable
CREATE TABLE "sale" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT,
    "leadId" TEXT,
    "externalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "productName" TEXT,
    "buyerEmail" TEXT,
    "buyerName" TEXT,
    "source" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_externalId_key" ON "sale"("externalId");

-- CreateIndex
CREATE INDEX "sale_webinarId_createdAt_idx" ON "sale"("webinarId", "createdAt");

-- CreateIndex
CREATE INDEX "sale_leadId_idx" ON "sale"("leadId");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
