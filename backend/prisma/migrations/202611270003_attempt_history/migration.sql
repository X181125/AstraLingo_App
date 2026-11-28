ALTER TABLE "StudyAttempt" ADD COLUMN "publicId" SERIAL NOT NULL, ADD COLUMN "submittedAt" TIMESTAMP(3), ADD COLUMN "completedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "StudyAttempt_publicId_key" ON "StudyAttempt"("publicId");
UPDATE "StudyAttempt" SET "submittedAt" = "updatedAt" WHERE state IN ('SUBMITTED', 'COMPLETED');
UPDATE "StudyAttempt" SET "completedAt" = "updatedAt" WHERE state = 'COMPLETED';
