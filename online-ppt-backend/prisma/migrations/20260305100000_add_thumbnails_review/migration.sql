-- Add review fields to thumbnails for PPT analysis review workflow
ALTER TABLE `thumbnails` ADD COLUMN `review_status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending=待审核, approved=已通过, rejected=已拒绝';
ALTER TABLE `thumbnails` ADD COLUMN `reviewed_at` DATETIME(3) NULL COMMENT '审核时间';
ALTER TABLE `thumbnails` ADD COLUMN `reviewer_id` VARCHAR(50) NULL COMMENT '审核人ID';
CREATE INDEX `idx_thumbnails_review_status` ON `thumbnails`(`review_status`);

-- CreateTable: PPT analysis review history (modify_approve etc.)
CREATE TABLE `slide_analysis_review_records` (
    `id` VARCHAR(50) NOT NULL,
    `thumbnail_id` VARCHAR(100) NOT NULL,
    `action` VARCHAR(20) NOT NULL COMMENT 'approve, reject, modify_approve',
    `content_before` JSON NULL,
    `content_after` JSON NULL,
    `reviewer_id` VARCHAR(50) NULL,
    `review_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remark` TEXT NULL,

    INDEX `idx_sar_thumbnail_id`(`thumbnail_id`),
    INDEX `idx_sar_review_time`(`review_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `slide_analysis_review_records` ADD CONSTRAINT `slide_analysis_review_records_thumbnail_id_fkey` FOREIGN KEY (`thumbnail_id`) REFERENCES `thumbnails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
