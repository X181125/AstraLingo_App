CREATE TABLE "LessonAssessment" (
  id SERIAL PRIMARY KEY, "lessonId" TEXT NOT NULL REFERENCES "ContentItem"(id) ON DELETE CASCADE,
  title TEXT NOT NULL, questions JSONB NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LessonAssessment_lessonId_idx" ON "LessonAssessment"("lessonId");
CREATE UNIQUE INDEX "LessonAssessment_one_active" ON "LessonAssessment"("lessonId") WHERE "isActive";
CREATE TABLE "AssessmentRun" (
  id SERIAL PRIMARY KEY, "assessmentId" INTEGER NOT NULL REFERENCES "LessonAssessment"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, snapshot JSONB NOT NULL,
  answers JSONB, result JSONB, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "AssessmentRun_userId_assessmentId_idx" ON "AssessmentRun"("userId","assessmentId");
