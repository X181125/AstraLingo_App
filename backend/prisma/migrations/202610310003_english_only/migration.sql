-- Remove only the discontinued Japanese demo course and its enrollments.
-- All accounts and English course enrollments are retained.
DELETE FROM "Enrollment" WHERE "courseId" = 'japanese-hello';
DELETE FROM "ContentItem" WHERE "courseId" = 'japanese-hello';
DELETE FROM "Course" WHERE "id" = 'japanese-hello';
