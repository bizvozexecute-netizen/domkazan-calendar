ALTER TABLE "House" ADD COLUMN "calendarName" TEXT;
ALTER TABLE "House" ADD COLUMN "tildaProductUid" TEXT;
UPDATE "House" SET "tildaProductUid" = substring("slug" from 7) WHERE "slug" ~ '^tilda-[0-9]{12}$';
CREATE UNIQUE INDEX "House_tildaProductUid_key" ON "House"("tildaProductUid");
ALTER TABLE "House" ADD CONSTRAINT "House_calendarName_length" CHECK ("calendarName" IS NULL OR char_length("calendarName") BETWEEN 1 AND 40);
ALTER TABLE "House" ADD CONSTRAINT "House_tildaProductUid_format" CHECK ("tildaProductUid" IS NULL OR "tildaProductUid" ~ '^[0-9]{1,30}$');
