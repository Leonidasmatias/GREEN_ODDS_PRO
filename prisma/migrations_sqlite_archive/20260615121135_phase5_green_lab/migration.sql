-- CreateTable
CREATE TABLE "model_weights" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "form" REAL NOT NULL DEFAULT 20,
    "attack" REAL NOT NULL DEFAULT 20,
    "defense" REAL NOT NULL DEFAULT 20,
    "momentum" REAL NOT NULL DEFAULT 15,
    "ranking" REAL NOT NULL DEFAULT 10,
    "statistics" REAL NOT NULL DEFAULT 15,
    "updatedAt" DATETIME NOT NULL
);
