-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_code_key" ON "Exercise"("code");

