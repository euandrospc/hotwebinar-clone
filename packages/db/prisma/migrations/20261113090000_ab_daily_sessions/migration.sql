ALTER TABLE "ab_experiment"
  ADD COLUMN "observationUnit" TEXT NOT NULL DEFAULT 'LEAD';

ALTER TABLE "ab_experiment"
  ADD CONSTRAINT "ab_experiment_observation_unit_check"
  CHECK (
    "observationUnit" IN ('LEAD', 'DAILY_SESSION')
    AND ("observationUnit" = 'LEAD' OR "mode" = 'OBSERVATIONAL')
  );
