-- CreateTable
CREATE TABLE `transcriptions` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `original_file_name` VARCHAR(255) NOT NULL,
    `audio_file_path` VARCHAR(500) NOT NULL,
    `audio_file_size` BIGINT NOT NULL DEFAULT 0,
    `audio_format` VARCHAR(20) NOT NULL,
    `audio_duration` INTEGER NULL,
    `result_file_path` VARCHAR(500) NULL,
    `dialogues` TEXT NULL,
    `full_text` TEXT NULL,
    `xfyun_order_id` VARCHAR(100) NULL,
    `speaker_count` INTEGER NOT NULL DEFAULT 0,
    `has_role_separation` BOOLEAN NOT NULL DEFAULT true,
    `session_id` VARCHAR(50) NULL,
    `product_id` VARCHAR(50) NULL,
    `customer_name` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    INDEX `idx_status`(`status`),
    INDEX `idx_session_id`(`session_id`),
    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_customer_name`(`customer_name`),
    INDEX `idx_created_at`(`created_at`),
    FULLTEXT INDEX `ft_full_text`(`full_text`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transcriptions` ADD CONSTRAINT `transcriptions_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transcriptions` ADD CONSTRAINT `transcriptions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

