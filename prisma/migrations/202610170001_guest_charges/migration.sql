ALTER TABLE "House" ADD COLUMN "includedGuests" INTEGER;
ALTER TABLE "House" ADD COLUMN "extraGuestPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "House" ADD COLUMN "serviceFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "House" ADD CONSTRAINT "House_guest_charges_valid" CHECK (
  ("includedGuests" IS NULL OR "includedGuests" BETWEEN 1 AND "maxGuests")
  AND "extraGuestPrice" >= 0 AND "serviceFee" >= 0
  AND ("extraGuestPrice" = 0 OR "includedGuests" IS NOT NULL)
);
