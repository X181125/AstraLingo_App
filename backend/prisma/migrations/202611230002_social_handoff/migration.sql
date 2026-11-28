-- AlterTable
ALTER TABLE "SocialFlow" ADD COLUMN     "platform" TEXT NOT NULL DEFAULT 'native',
ADD COLUMN     "ticketHash" TEXT;


ALTER TABLE "SocialFlow" ALTER COLUMN "platform" DROP DEFAULT;
