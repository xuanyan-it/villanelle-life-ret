ALTER TABLE "record" ADD COLUMN "upload_id" uuid;
ALTER TABLE "record" ADD COLUMN "slide_file_name" text;
ALTER TABLE "record" ADD COLUMN "slide_id" text;

UPDATE "record"
SET
  "upload_id" = "uuid",
  "slide_file_name" = "uuid"::text || '.svs',
  "slide_id" = "uuid"::text
WHERE "upload_id" IS NULL OR "slide_file_name" IS NULL OR "slide_id" IS NULL;

ALTER TABLE "record" ALTER COLUMN "upload_id" SET NOT NULL;
ALTER TABLE "record" ALTER COLUMN "slide_file_name" SET NOT NULL;
ALTER TABLE "record" ALTER COLUMN "slide_id" SET NOT NULL;

ALTER TABLE "record" DROP COLUMN "sample_id";
ALTER TABLE "record" DROP COLUMN "sample_type";
