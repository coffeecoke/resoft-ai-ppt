-- 若 prisma migrate deploy 未执行，可手动执行本文件以添加审核字段与表
-- 在项目根目录执行: mysql -u 用户名 -p 数据库名 < online-ppt-backend/prisma/migrations/20260305000000_add_concern_review/run_manual.sql

-- 1. 给 concerns 表添加审核字段（若已存在会报错，可逐条执行并忽略已存在的）
ALTER TABLE `concerns` ADD COLUMN `review_status` VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `concerns` ADD COLUMN `reviewed_at` DATETIME(3) NULL;
ALTER TABLE `concerns` ADD COLUMN `reviewer_id` VARCHAR(50) NULL;
CREATE INDEX `idx_review_status` ON `concerns`(`review_status`);

-- 2. 创建审核记录表（若表已存在则跳过）
CREATE TABLE IF NOT EXISTS `concern_review_records` (
    `id` VARCHAR(50) NOT NULL,
    `concern_id` VARCHAR(50) NOT NULL,
    `action` VARCHAR(30) NOT NULL,
    `reviewer_id` VARCHAR(50) NULL,
    `review_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remark` TEXT NULL,
    `content_before` JSON NULL,
    `content_after` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `idx_concern_review_concern_id`(`concern_id`),
    INDEX `idx_concern_review_time`(`review_time`),
    CONSTRAINT `concern_review_records_concern_id_fkey` FOREIGN KEY (`concern_id`) REFERENCES `concerns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
