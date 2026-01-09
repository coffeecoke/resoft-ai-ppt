-- CreateTable (幂等性处理：如果表已存在则跳过)
CREATE TABLE IF NOT EXISTS `slide_merged_contents` (
    `id` VARCHAR(50) NOT NULL,
    `document_id` VARCHAR(50) NOT NULL,
    `slide_id` VARCHAR(50) NOT NULL,
    `merged_content` TEXT NOT NULL,
    `content_length` INTEGER NOT NULL DEFAULT 0,
    `slide_order` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `extract_method` VARCHAR(20) NOT NULL DEFAULT 'auto',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_document_slide`(`document_id`, `slide_id`),
    INDEX `idx_document_id`(`document_id`),
    INDEX `idx_slide_id`(`slide_id`),
    INDEX `idx_slide_order`(`slide_order`),
    FULLTEXT INDEX `ft_merged_content`(`merged_content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

