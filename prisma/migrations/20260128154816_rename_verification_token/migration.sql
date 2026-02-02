/*
  Warnings:

  - You are about to drop the column `verficationToken` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[verificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "verficationToken",
ADD COLUMN     "verificationToken" TEXT,
ALTER COLUMN "workingStart" SET DEFAULT '09:00';

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");
