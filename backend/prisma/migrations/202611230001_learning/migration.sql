-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "preferences" JSONB;

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "practice" JSONB;

-- CreateTable
CREATE TABLE "StudyAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "feedback" JSONB,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedWord" (
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedWord_pkey" PRIMARY KEY ("userId","word")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardReview" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "box" INTEGER NOT NULL,
    "nextReview" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardReview_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "StudyDay" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "StudyDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "result" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyMedia" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "objectKey" TEXT,
    "bytes" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "digest" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "SocialIdentity" (
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SocialIdentity_pkey" PRIMARY KEY ("provider","subject")
);

-- CreateTable
CREATE TABLE "SocialFlow" (
    "id" TEXT NOT NULL,
    "proofHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "verifier" TEXT,
    "userId" TEXT,
    "version" INTEGER,
    "failure" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialFlow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyAttempt_userId_lessonId_updatedAt_idx" ON "StudyAttempt"("userId", "lessonId", "updatedAt");

-- CreateIndex
CREATE INDEX "Annotation_userId_lessonId_idx" ON "Annotation"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "Deck_ownerId_idx" ON "Deck"("ownerId");

-- CreateIndex
CREATE INDEX "Card_deckId_idx" ON "Card"("deckId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_createdAt_idx" ON "QuizAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyMedia_ownerId_idx" ON "StudyMedia"("ownerId");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE INDEX "SocialFlow_expiresAt_idx" ON "SocialFlow"("expiresAt");

-- CreateIndex
CREATE INDEX "ContentItem_ownerId_status_idx" ON "ContentItem"("ownerId", "status");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAttempt" ADD CONSTRAINT "StudyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAttempt" ADD CONSTRAINT "StudyAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedWord" ADD CONSTRAINT "SavedWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyDay" ADD CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMedia" ADD CONSTRAINT "StudyMedia_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialIdentity" ADD CONSTRAINT "SocialIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

