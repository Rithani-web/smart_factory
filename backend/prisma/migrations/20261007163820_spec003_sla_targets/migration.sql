-- CreateTable
CREATE TABLE "SlaTarget" (
    "severity" "Severity" NOT NULL,
    "ackMinutes" INTEGER NOT NULL,
    "resolveMinutes" INTEGER NOT NULL,

    CONSTRAINT "SlaTarget_pkey" PRIMARY KEY ("severity")
);

