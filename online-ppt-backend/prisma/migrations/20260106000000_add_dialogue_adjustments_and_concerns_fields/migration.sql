-- AlterTable: 为 concerns 表添加问答对元数据字段
ALTER TABLE `concerns` ADD COLUMN `answer_speaker` VARCHAR(50) NULL;

ALTER TABLE `concerns` ADD COLUMN `question_speaker` VARCHAR(50) NULL;

ALTER TABLE `concerns` ADD COLUMN `time_range` VARCHAR(100) NULL;

ALTER TABLE `concerns` ADD COLUMN `time_range1` VARCHAR(100) NULL;

ALTER TABLE `concerns` ADD COLUMN `time_range2` VARCHAR(100) NULL;

ALTER TABLE `concerns` ADD COLUMN `transcription_id` VARCHAR(50) NULL;

-- CreateTable: 对话调整记录表
CREATE TABLE IF NOT EXISTS `dialogue_adjustments` (
    `id` VARCHAR(50) NOT NULL,
    `transcription_id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `original_file_name` VARCHAR(255) NOT NULL,
    `audio_file_path` VARCHAR(500) NOT NULL,
    `audio_file_size` BIGINT NOT NULL DEFAULT 0,
    `audio_format` VARCHAR(20) NOT NULL,
    `audio_duration` INTEGER NULL,
    `adjusted_dialogues` LONGTEXT NULL,
    `full_text` LONGTEXT NULL,
    `xfyun_order_id` VARCHAR(100) NULL,
    `speaker_count` INTEGER NOT NULL DEFAULT 0,
    `has_role_separation` BOOLEAN NOT NULL DEFAULT true,
    `speaker_roles` LONGTEXT NULL,
    `session_id` VARCHAR(50) NULL,
    `product_id` VARCHAR(50) NULL,
    `customer_name` VARCHAR(255) NULL,
    `note1` TEXT NULL,
    `note2` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `idx_adjustment_transcription_id`(`transcription_id`),
    INDEX `idx_adjustment_created_at`(`created_at`),
    FULLTEXT INDEX `ft_adjustment_full_text`(`full_text`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex: 为 concerns 表添加 transcription_id 索引
CREATE INDEX `idx_transcription_id` ON `concerns`(`transcription_id`);

-- AddForeignKey: dialogue_adjustments 表的外键约束
ALTER TABLE `dialogue_adjustments` ADD CONSTRAINT `dialogue_adjustments_transcription_id_fkey` FOREIGN KEY (`transcription_id`) REFERENCES `transcriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dialogue_adjustments` ADD CONSTRAINT `dialogue_adjustments_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dialogue_adjustments` ADD CONSTRAINT `dialogue_adjustments_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
