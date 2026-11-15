-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "reminder1SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder24SentAt" TIMESTAMP(3);

-- A teacher can never have two active bookings that overlap in time.
-- Enforced by the database itself, so two students clicking the same slot
-- at the same moment cannot both get it.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist ("teacherId" WITH =, tsrange("startsAt", "endsAt") WITH &&)
  WHERE (status IN ('HELD', 'CONFIRMED'));
