-- CreateTable
CREATE TABLE "MediaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "embyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "type" TEXT NOT NULL,
    "productionYear" INTEGER,
    "dateCreated" DATETIME NOT NULL,
    "backdropUrl" TEXT,
    "posterUrl" TEXT,
    "webUrl" TEXT,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_embyId_key" ON "MediaItem"("embyId");

-- CreateIndex
CREATE INDEX "MediaItem_dateCreated_idx" ON "MediaItem"("dateCreated");
