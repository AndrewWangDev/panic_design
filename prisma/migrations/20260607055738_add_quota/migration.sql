-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER,
    "username" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "jwtSalt" INTEGER NOT NULL DEFAULT 0,
    "dailyQuota" INTEGER NOT NULL DEFAULT 0,
    "hourlyQuota" INTEGER NOT NULL DEFAULT 0,
    "lastQuotaReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "email", "githubId", "id", "jwtSalt", "updatedAt", "username") SELECT "avatarUrl", "createdAt", "email", "githubId", "id", "jwtSalt", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
