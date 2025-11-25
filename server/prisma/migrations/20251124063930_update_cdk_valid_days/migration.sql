/*
  Warnings:

  - You are about to drop the column `validDays` on the `Cdk` table. All the data in the column will be lost.
  - Added the required column `memberValidDays` to the `Cdk` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cdk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "cdkValidDays" INTEGER NOT NULL DEFAULT 365,
    "memberValidDays" INTEGER NOT NULL,
    "templateId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "usedById" INTEGER,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cdk_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cdk_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cdk" ("code", "createdAt", "createdById", "id", "status", "templateId", "usedAt", "usedById") SELECT "code", "createdAt", "createdById", "id", "status", "templateId", "usedAt", "usedById" FROM "Cdk";
DROP TABLE "Cdk";
ALTER TABLE "new_Cdk" RENAME TO "Cdk";
CREATE UNIQUE INDEX "Cdk_code_key" ON "Cdk"("code");
CREATE UNIQUE INDEX "Cdk_usedById_key" ON "Cdk"("usedById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
