-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `cover` VARCHAR(500) NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'uncategorized',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `tag` VARCHAR(20) NOT NULL DEFAULT 'public',
    `content_file_path` VARCHAR(500) NOT NULL,
    `slide_count` INTEGER NOT NULL DEFAULT 0,
    `file_size` BIGINT NOT NULL DEFAULT 0,
    `customer_name` VARCHAR(255) NULL,
    `product` JSON NULL,
    `industry` JSON NULL,
    `audience` JSON NULL,
    `language` VARCHAR(50) NULL,
    `source_document_id` VARCHAR(50) NULL,
    `source_document_name` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_opened_at` DATETIME(3) NULL,

    INDEX `idx_status`(`status`),
    INDEX `idx_category`(`category`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_customer`(`customer_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thumbnails` (
    `id` VARCHAR(100) NOT NULL,
    `document_id` VARCHAR(50) NOT NULL,
    `slide_id` VARCHAR(50) NOT NULL,
    `slide_index` INTEGER NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `width` INTEGER NOT NULL DEFAULT 800,
    `height` INTEGER NOT NULL DEFAULT 450,
    `size` INTEGER NULL,
    `format` VARCHAR(20) NOT NULL DEFAULT 'jpeg',
    `has_text` BOOLEAN NOT NULL DEFAULT false,
    `has_image` BOOLEAN NOT NULL DEFAULT false,
    `element_count` INTEGER NOT NULL DEFAULT 0,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_document_id`(`document_id`),
    INDEX `idx_slide_id`(`slide_id`),
    INDEX `idx_slide_index`(`slide_index`),
    UNIQUE INDEX `uk_document_slide`(`document_id`, `slide_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thumbnails` ADD CONSTRAINT `thumbnails_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

