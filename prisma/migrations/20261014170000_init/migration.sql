CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED');

CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tildaUrl" TEXT,
    "maxGuests" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "House_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "House_maxGuests_positive" CHECK ("maxGuests" > 0)
);

CREATE TABLE "BaseRate" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "pricePerNight" DECIMAL(10,2) NOT NULL,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "BaseRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BaseRate_valid" CHECK ("startsOn" < "endsOn" AND "pricePerNight" >= 0 AND "minNights" > 0)
);

CREATE TABLE "DateOverride" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pricePerNight" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "DateOverride_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DateOverride_price_nonnegative" CHECK ("pricePerNight" >= 0)
);

CREATE TABLE "BlockedPeriod" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedPeriod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BlockedPeriod_valid" CHECK ("startsOn" < "endsOn")
);

CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "message" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingRequest_valid" CHECK ("checkIn" < "checkOut" AND "guestCount" > 0)
);

CREATE UNIQUE INDEX "House_slug_key" ON "House"("slug");
CREATE INDEX "BaseRate_houseId_startsOn_endsOn_idx" ON "BaseRate"("houseId", "startsOn", "endsOn");
CREATE UNIQUE INDEX "DateOverride_houseId_date_key" ON "DateOverride"("houseId", "date");
CREATE INDEX "BlockedPeriod_houseId_startsOn_endsOn_idx" ON "BlockedPeriod"("houseId", "startsOn", "endsOn");
CREATE INDEX "BookingRequest_houseId_status_checkIn_checkOut_idx" ON "BookingRequest"("houseId", "status", "checkIn", "checkOut");
CREATE INDEX "BookingRequest_createdAt_idx" ON "BookingRequest"("createdAt");

ALTER TABLE "BaseRate" ADD CONSTRAINT "BaseRate_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DateOverride" ADD CONSTRAINT "DateOverride_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedPeriod" ADD CONSTRAINT "BlockedPeriod_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
