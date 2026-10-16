ALTER TABLE "BookingRequest" ADD COLUMN "messenger" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "messengerContact" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "consentAt" TIMESTAMP(3);
ALTER TABLE "BookingRequest" ADD COLUMN "quotedTotal" DECIMAL(10,2);
ALTER TABLE "BookingRequest" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "payloadHash" TEXT;
CREATE UNIQUE INDEX "BookingRequest_idempotencyKey_key" ON "BookingRequest"("idempotencyKey");
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_quotedTotal_nonnegative" CHECK ("quotedTotal" IS NULL OR "quotedTotal" >= 0);
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_confirmed_no_overlap"
  EXCLUDE USING GIST ("houseId" WITH =, daterange("checkIn", "checkOut", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');

CREATE TABLE "TelegramNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingRequestId" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramNotification_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "TelegramNotification_status_valid" CHECK ("status" IN ('PENDING', 'SENT'))
);
CREATE INDEX "TelegramNotification_status_nextAttemptAt_idx" ON "TelegramNotification"("status", "nextAttemptAt");
CREATE TABLE "RequestThrottle" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL
);
