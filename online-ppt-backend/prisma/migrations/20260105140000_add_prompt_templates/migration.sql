-- CreateTable (幂等性处理：如果表已存在则跳过)
CREATE TABLE IF NOT EXISTS `prompt_templates` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `prompt` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `variables` JSON NULL,
    `version` VARCHAR(20) NOT NULL DEFAULT '1.0',
    `scene_type` VARCHAR(50) NULL,

    UNIQUE INDEX `prompt_templates_code_key`(`code`),
    INDEX `idx_type`(`type`),
    INDEX `idx_code`(`code`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_scene_type`(`scene_type`),
    INDEX `idx_version`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

