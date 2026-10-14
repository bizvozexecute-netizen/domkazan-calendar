ALTER TABLE "House" DROP COLUMN "description";
ALTER TABLE "House" ADD COLUMN "district" TEXT;
ALTER TABLE "House" ADD COLUMN "bedrooms" INTEGER;
ALTER TABLE "House" ADD COLUMN "bathrooms" INTEGER;
ALTER TABLE "House" ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "House" ADD COLUMN "petsAllowed" BOOLEAN;
ALTER TABLE "House" ADD CONSTRAINT "House_bedrooms_nonnegative" CHECK ("bedrooms" IS NULL OR "bedrooms" >= 0);
ALTER TABLE "House" ADD CONSTRAINT "House_bathrooms_nonnegative" CHECK ("bathrooms" IS NULL OR "bathrooms" >= 0);

ALTER TABLE "BaseRate" ADD COLUMN "weekdayPrice" DECIMAL(10,2);
ALTER TABLE "BaseRate" ADD COLUMN "fridayPrice" DECIMAL(10,2);
ALTER TABLE "BaseRate" ADD COLUMN "saturdayPrice" DECIMAL(10,2);
ALTER TABLE "BaseRate" ADD COLUMN "sundayPrice" DECIMAL(10,2);
UPDATE "BaseRate" SET
  "weekdayPrice" = "pricePerNight",
  "fridayPrice" = "pricePerNight",
  "saturdayPrice" = "pricePerNight",
  "sundayPrice" = "pricePerNight";
ALTER TABLE "BaseRate" ALTER COLUMN "weekdayPrice" SET NOT NULL;
ALTER TABLE "BaseRate" ALTER COLUMN "fridayPrice" SET NOT NULL;
ALTER TABLE "BaseRate" ALTER COLUMN "saturdayPrice" SET NOT NULL;
ALTER TABLE "BaseRate" ALTER COLUMN "sundayPrice" SET NOT NULL;
ALTER TABLE "BaseRate" DROP CONSTRAINT "BaseRate_valid";
ALTER TABLE "BaseRate" DROP COLUMN "pricePerNight";
ALTER TABLE "BaseRate" ADD CONSTRAINT "BaseRate_valid" CHECK (
  "startsOn" < "endsOn" AND "minNights" > 0 AND
  "weekdayPrice" >= 0 AND "fridayPrice" >= 0 AND
  "saturdayPrice" >= 0 AND "sundayPrice" >= 0
);

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "BaseRate" ADD CONSTRAINT "BaseRate_no_overlap"
  EXCLUDE USING GIST ("houseId" WITH =, daterange("startsOn", "endsOn", '[)') WITH &&);

CREATE TABLE "AdminSession" (
  "tokenHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "credentialTag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

CREATE TABLE "LoginThrottle" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);
