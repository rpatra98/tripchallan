-- CreateEnum
CREATE TYPE "CommentUrgency" AS ENUM ('NA', 'LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "urgency" "CommentUrgency" NOT NULL DEFAULT 'NA';
