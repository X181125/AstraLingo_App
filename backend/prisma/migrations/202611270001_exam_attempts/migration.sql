CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "examId" TEXT NOT NULL,
    "openKey" TEXT,
    "snapshot" JSONB NOT NULL,
    "answers" INTEGER[],
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "correct" INTEGER
);
CREATE UNIQUE INDEX "ExamAttempt_openKey_key" ON "ExamAttempt"("openKey");
CREATE INDEX "ExamAttempt_userId_startedAt_idx" ON "ExamAttempt"("userId", "startedAt");
