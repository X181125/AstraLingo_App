ALTER TABLE "AssessmentRun" ADD COLUMN abandoned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LessonAssessment" ADD COLUMN settings JSONB;
CREATE TABLE "PassageWord" (
 id SERIAL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "lessonId" TEXT NOT NULL REFERENCES "ContentItem"(id) ON DELETE CASCADE,
 word TEXT NOT NULL, meaning TEXT, note TEXT, "wordId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PassageWord_userId_lessonId_word_key" ON "PassageWord"("userId","lessonId",word);
CREATE TABLE "SpeechClip" (
 id SERIAL PRIMARY KEY, "attemptId" TEXT NOT NULL REFERENCES "StudyAttempt"(id) ON DELETE CASCADE,
 "mediaId" TEXT REFERENCES "StudyMedia"(id) ON DELETE CASCADE, "mimeType" TEXT NOT NULL, source TEXT NOT NULL,
 "durationSec" DOUBLE PRECISION, waveform JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SpeechClip_attemptId_idx" ON "SpeechClip"("attemptId");
CREATE TABLE "SpeechSegment" (
 id SERIAL PRIMARY KEY, "attemptId" TEXT NOT NULL REFERENCES "StudyAttempt"(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, sequence INTEGER NOT NULL, data JSONB NOT NULL
);
CREATE INDEX "SpeechSegment_attemptId_kind_idx" ON "SpeechSegment"("attemptId",kind);
CREATE UNIQUE INDEX "SpeechClip_attemptId_mediaId_key" ON "SpeechClip"("attemptId","mediaId");
