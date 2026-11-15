-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerAccountType" ADD VALUE 'EXTERNAL';
ALTER TYPE "LedgerAccountType" ADD VALUE 'PAYOUT_IN_FLIGHT';

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_teacherId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "operator" TEXT,
ADD COLUMN     "ussdCode" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "source" "LedgerAccountType" NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_kind_referenceId_key" ON "LedgerTransaction"("kind", "referenceId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

