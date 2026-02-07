-- AlterTable: transcriptions 表增加左侧筛选用字段（中文 code）
ALTER TABLE `transcriptions` ADD COLUMN `industry` VARCHAR(50) NULL;
ALTER TABLE `transcriptions` ADD COLUMN `meeting_type` VARCHAR(50) NULL;
ALTER TABLE `transcriptions` ADD COLUMN `customer_type` VARCHAR(50) NULL;
ALTER TABLE `transcriptions` ADD COLUMN `audience` VARCHAR(50) NULL;
ALTER TABLE `transcriptions` ADD COLUMN `language` VARCHAR(20) NULL;

-- CreateIndex
CREATE INDEX `idx_industry` ON `transcriptions`(`industry`);
CREATE INDEX `idx_meeting_type` ON `transcriptions`(`meeting_type`);
CREATE INDEX `idx_customer_type` ON `transcriptions`(`customer_type`);
CREATE INDEX `idx_audience` ON `transcriptions`(`audience`);
CREATE INDEX `idx_language` ON `transcriptions`(`language`);
