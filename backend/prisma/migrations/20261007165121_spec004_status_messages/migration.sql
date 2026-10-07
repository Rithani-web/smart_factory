-- CreateTable
CREATE TABLE "StatusMessage" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusMessage_teamId_key" ON "StatusMessage"("teamId");

-- AddForeignKey
ALTER TABLE "StatusMessage" ADD CONSTRAINT "StatusMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusMessage" ADD CONSTRAINT "StatusMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

