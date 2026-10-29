-- Recurring UNICO webinars: same local time on selected weekdays.
ALTER TABLE "webinar" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "webinar" ADD COLUMN "recurringDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
