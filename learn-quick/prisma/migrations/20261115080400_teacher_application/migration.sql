-- AlterTable
ALTER TABLE "TeacherApplication" ADD COLUMN     "idBackDocId" TEXT,
ADD COLUMN     "idDocumentType" TEXT,
ADD COLUMN     "idFrontDocId" TEXT,
ADD COLUMN     "idSelfieDocId" TEXT,
ADD COLUMN     "noEducation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;
