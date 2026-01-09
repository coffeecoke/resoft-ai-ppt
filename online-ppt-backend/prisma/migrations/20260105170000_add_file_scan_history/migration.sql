-- CreateTable (幂等性处理：如果表已存在则跳过)
CREATE TABLE IF NOT EXISTS `file_scan_history` (
    `id` VARCHAR(50) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` BIGINT NOT NULL DEFAULT 0,
    `file_type` VARCHAR(20) NOT NULL,
    `modified_time` DATETIME(3) NOT NULL,
    `processed_time` DATETIME(3) NULL,
    `document_id` VARCHAR(50) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `scan_time` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_scan_history_file_path_key`(`file_path`),
    INDEX `idx_status`(`status`),
    INDEX `idx_processed_time`(`processed_time`),
    INDEX `idx_scan_time`(`scan_time`),
    INDEX `idx_file_type`(`file_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

