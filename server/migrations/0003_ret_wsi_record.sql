ALTER TABLE "record" ADD COLUMN "model_type" text;
ALTER TABLE "record" ADD COLUMN "generate_heatmap" boolean;

UPDATE "record"
SET "model_type" = '3class', "generate_heatmap" = false
WHERE "model_type" IS NULL OR "generate_heatmap" IS NULL;

ALTER TABLE "record" ALTER COLUMN "model_type" SET NOT NULL;
ALTER TABLE "record" ALTER COLUMN "generate_heatmap" SET NOT NULL;

ALTER TABLE "record" DROP COLUMN "rps4y1";
ALTER TABLE "record" DROP COLUMN "pkhd1l1";
ALTER TABLE "record" DROP COLUMN "crabp1";
ALTER TABLE "record" DROP COLUMN "gapdh";
