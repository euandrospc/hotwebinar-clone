CREATE TABLE "sale_notification" (
  "id"          TEXT NOT NULL,
  "webinarId"   TEXT NOT NULL,
  "showAtSec"   INTEGER NOT NULL,
  "buyerName"   TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "price"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_notification_webinarId_showAtSec_idx"
  ON "sale_notification"("webinarId", "showAtSec");

ALTER TABLE "sale_notification"
  ADD CONSTRAINT "sale_notification_webinarId_fkey"
  FOREIGN KEY ("webinarId") REFERENCES "webinar"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
