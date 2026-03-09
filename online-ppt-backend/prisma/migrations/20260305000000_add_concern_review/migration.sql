-- Add review fields to concerns
ALTER TABLE `concerns` ADD COLUMN `review_status` VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `concerns` ADD COLUMN `reviewed_at` DATETIME(3) NULL;
ALTER TABLE `concerns` ADD COLUMN `reviewer_id` VARCHAR(50) NULL;
CREATE INDEX `idx_review_status` ON `concerns`(`review_status`);

-- Create concern_review_records table
CREATE TABLE `concern_review_records` (
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
