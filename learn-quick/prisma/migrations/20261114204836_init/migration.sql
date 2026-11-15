-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'fr');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'FRENCH');

-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationSection" AS ENUM ('ABOUT', 'PHOTO', 'CERTIFICATION', 'EDUCATION', 'DESCRIPTION', 'VIDEO', 'AVAILABILITY', 'PRICING', 'IDENTITY', 'AGREEMENT');

-- CreateEnum
CREATE TYPE "SectionDecision" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_CHANGES', 'REJECTED');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('VERIFIED_ID', 'CERTIFIED', 'PROFESSIONAL', 'TOP_RATED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('PROFILE_PHOTO', 'INTRO_VIDEO', 'CERTIFICATE', 'DEGREE', 'ID_FRONT', 'ID_BACK', 'ID_SELFIE', 'LESSON_FILE', 'RECORDING');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('TRIAL', 'SINGLE', 'PACKAGE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('HELD', 'CONFIRMED', 'COMPLETED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_TEACHER', 'NO_SHOW_STUDENT', 'NO_SHOW_TEACHER', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProviderName" AS ENUM ('MTN_MOMO', 'ORANGE_MONEY', 'AGGREGATOR', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('STUDENT_WALLET', 'TEACHER_PENDING', 'TEACHER_AVAILABLE', 'PLATFORM_REVENUE', 'PLATFORM_CLEARING');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED_REFUND', 'RESOLVED_NO_REFUND');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('SENTENCE', 'PARAGRAPH', 'FILL_GAP', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "TranslationDirection" AS ENUM ('EN_FR', 'FR_EN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'PENDING_REVIEW', 'REVIEWED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "phone" TEXT,
    "phoneVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "country" TEXT NOT NULL DEFAULT 'CM',
    "city" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Douala',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learningLanguages" "Language"[],
    "englishLevel" "CefrLevel",
    "frenchLevel" "CefrLevel",
    "goals" TEXT[],
    "availabilityNote" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteTeacher" (
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteTeacher_pkey" PRIMARY KEY ("studentId","teacherId")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjects" "Language"[],
    "nativeLanguages" "Language"[],
    "spokenLanguages" JSONB NOT NULL,
    "countryOfBirth" TEXT,
    "headlineEn" TEXT,
    "headlineFr" TEXT,
    "bioEn" TEXT,
    "bioFr" TEXT,
    "experienceEn" TEXT,
    "experienceFr" TEXT,
    "specialties" TEXT[],
    "photoUrl" TEXT,
    "videoUrl" TEXT,
    "hourlyRateXaf" INTEGER,
    "trialRateXaf" INTEGER,
    "package5Discount" INTEGER NOT NULL DEFAULT 0,
    "package10Discount" INTEGER NOT NULL DEFAULT 0,
    "package20Discount" INTEGER NOT NULL DEFAULT 0,
    "payoutPhone" TEXT,
    "payoutProvider" "PaymentProviderName",
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherApplication" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" "ApplicationSection" NOT NULL DEFAULT 'ABOUT',
    "completedSteps" "ApplicationSection"[],
    "noCertificate" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "interviewAt" TIMESTAMP(3),
    "interviewRoom" TEXT,
    "identityPurgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "section" "ApplicationSection" NOT NULL,
    "decision" "SectionDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherBadge" (
    "teacherId" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherBadge_pkey" PRIMARY KEY ("teacherId","type")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "documentId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "documentId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEdit" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "section" "ApplicationSection" NOT NULL,
    "payload" JSONB NOT NULL,
    "decision" "SectionDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPackage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "totalLessons" INTEGER NOT NULL,
    "usedLessons" INTEGER NOT NULL DEFAULT 0,
    "priceXaf" INTEGER NOT NULL,
    "unitPriceXaf" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "paymentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "LessonType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'HELD',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "priceXaf" INTEGER NOT NULL,
    "commissionPct" INTEGER NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "packageId" TEXT,
    "paymentId" TEXT,
    "rescheduledFrom" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "releaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "recordingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "recordingUrl" TEXT,
    "recordingPurgeAt" TIMESTAMP(3),
    "teacherNotes" TEXT,
    "homework" TEXT,
    "sharedNotes" TEXT,
    "whiteboardState" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAttendance" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "LessonAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonChatMessage" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProviderName" NOT NULL,
    "phone" TEXT,
    "amountXaf" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "providerRef" TEXT,
    "providerPayload" JSONB,
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderName" NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "signatureOk" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "LedgerAccountType" NOT NULL,
    "balanceXaf" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "referenceId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerLine" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountXaf" INTEGER NOT NULL,

    CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amountXaf" INTEGER NOT NULL,
    "provider" "PaymentProviderName" NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerRef" TEXT,
    "approvedBy" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "direction" "TranslationDirection" NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "topic" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "references" TEXT[],
    "gapTemplate" TEXT,
    "options" JSONB,
    "keyVocabulary" JSONB,
    "commonMistakes" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "direction" "TranslationDirection",
    "level" "CefrLevel" NOT NULL,
    "timeLimitMin" INTEGER,
    "passMark" INTEGER NOT NULL DEFAULT 70,
    "isTimedExam" BOOLEAN NOT NULL DEFAULT false,
    "isRandom" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestItem" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "TestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "scorePct" INTEGER,
    "estimatedLevel" "CefrLevel",
    "passed" BOOLEAN,
    "certificateNo" TEXT,
    "teacherReviewerId" TEXT,
    "teacherComment" TEXT,

    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "answerText" TEXT,
    "choiceIndex" INTEGER,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "autosavedAt" TIMESTAMP(3),
    "scorePct" INTEGER,
    "accuracy" INTEGER,
    "grammar" INTEGER,
    "vocabulary" INTEGER,
    "style" INTEGER,
    "errors" JSONB,
    "correctedText" TEXT,
    "feedback" TEXT,
    "gradedBy" TEXT,
    "gradeAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "contactUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","type","channel")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE INDEX "TeacherProfile_isPublished_ratingAvg_idx" ON "TeacherProfile"("isPublished", "ratingAvg");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherApplication_teacherId_key" ON "TeacherApplication"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherApplication_status_submittedAt_idx" ON "TeacherApplication"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationReview_applicationId_round_section_key" ON "ApplicationReview"("applicationId", "round", "section");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_documentId_key" ON "Certificate"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Education_documentId_key" ON "Education"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "AvailabilityRule_teacherId_weekday_idx" ON "AvailabilityRule"("teacherId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPackage_paymentId_key" ON "LessonPackage"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paymentId_key" ON "Booking"("paymentId");

-- CreateIndex
CREATE INDEX "Booking_teacherId_startsAt_idx" ON "Booking"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_studentId_startsAt_idx" ON "Booking"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_bookingId_key" ON "Lesson"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_roomName_key" ON "Lesson"("roomName");

-- CreateIndex
CREATE INDEX "LessonAttendance_lessonId_userId_idx" ON "LessonAttendance"("lessonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_teacherId_createdAt_idx" ON "Review"("teacherId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_bookingId_key" ON "Dispute"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_userId_type_key" ON "LedgerAccount"("userId", "type");

-- CreateIndex
CREATE INDEX "LedgerTransaction_referenceId_idx" ON "LedgerTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "LedgerLine_accountId_idx" ON "LedgerLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_providerRef_key" ON "Payout"("providerRef");

-- CreateIndex
CREATE INDEX "Exercise_status_direction_level_topic_idx" ON "Exercise"("status", "direction", "level", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "TestItem_testId_position_key" ON "TestItem"("testId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_certificateNo_key" ON "TestAttempt"("certificateNo");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_submittedAt_idx" ON "TestAttempt"("userId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestAnswer_attemptId_itemId_key" ON "TestAnswer"("attemptId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_studentId_teacherId_key" ON "Conversation"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteTeacher" ADD CONSTRAINT "FavoriteTeacher_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteTeacher" ADD CONSTRAINT "FavoriteTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherApplication" ADD CONSTRAINT "TeacherApplication_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherBadge" ADD CONSTRAINT "TeacherBadge_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEdit" ADD CONSTRAINT "ProfileEdit_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackage" ADD CONSTRAINT "LessonPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackage" ADD CONSTRAINT "LessonPackage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackage" ADD CONSTRAINT "LessonPackage_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "LessonPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonChatMessage" ADD CONSTRAINT "LessonChatMessage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
