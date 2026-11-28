ALTER TABLE "Annotation" ADD COLUMN "publicId" SERIAL NOT NULL, ADD COLUMN "rangeStart" INTEGER, ADD COLUMN "rangeEnd" INTEGER, ADD COLUMN "sentenceId" TEXT, ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT false, ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Annotation_publicId_key" ON "Annotation"("publicId");
