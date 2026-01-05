-- AlterTable
ALTER TABLE `documents` ADD COLUMN `view_count` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `idx_view_count` ON `documents`(`view_count`);

