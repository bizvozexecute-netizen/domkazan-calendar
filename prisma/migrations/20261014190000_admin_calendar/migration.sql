ALTER TABLE "House" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BlockedPeriod" ADD CONSTRAINT "BlockedPeriod_no_overlap"
  EXCLUDE USING GIST ("houseId" WITH =, daterange("startsOn", "endsOn", '[)') WITH &&);
