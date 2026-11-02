-- Publish the approved 50-slot simulation for this webinar only.
-- The local validation webinar and its test lead are not part of the rollout.
BEGIN;

DELETE FROM "sale_notification"
WHERE "webinarId" = 'cmst8535y00031287q93py989';

INSERT INTO "sale_notification"
  ("id", "webinarId", "showAtSec", "buyerName", "productName", "price", "createdAt")
SELECT
  'sale-simulation-' || w."id" || '-' || slot,
  w."id",
  COALESCE(w."offerShowAtSec", w."pitchAtSec", 0) + 3 + (slot - 1) * 22,
  CASE slot % 3
    WHEN 1 THEN '{comprador}{origem} comprou o curso.'
    WHEN 2 THEN '{comprador}{origem} também garantiu sua vaga.'
    ELSE '{comprador}{origem} entrou para a turma.'
  END,
  '',
  NULL,
  CURRENT_TIMESTAMP
FROM "webinar" w
CROSS JOIN generate_series(1, 50) AS slot
WHERE w."id" = 'cmst8535y00031287q93py989';

COMMIT;
