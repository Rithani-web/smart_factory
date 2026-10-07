-- CreateEnum
CREATE TYPE "RotationCadence" AS ENUM ('WEEKLY', 'DAILY');

-- AlterEnum
ALTER TYPE "HistoryAction" ADD VALUE 'ESCALATED';

-- DropForeignKey
ALTER TABLE "DutyRosterEntry" DROP CONSTRAINT "DutyRosterEntry_technicianId_fkey";

-- AlterTable
ALTER TABLE "ProductionEvent" ADD COLUMN     "ackDeadline" TIMESTAMP(3),
ADD COLUMN     "escalationStep" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "DutyRosterEntry";

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" "RotationCadence" NOT NULL,
    "anchorAt" TIMESTAMP(3) NOT NULL,
    "escalationAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationPolicy" (
    "severity" "Severity" NOT NULL,
    "windowMinutes" INTEGER,

    CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("severity")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_createdAt_idx" ON "Team"("createdAt");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_position_idx" ON "TeamMembership"("teamId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_technicianId_key" ON "TeamMembership"("teamId", "technicianId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_escalationAdminId_fkey" FOREIGN KEY ("escalationAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

