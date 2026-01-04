-- CreateTable
CREATE TABLE `content_categories_ppt` (
    `id` VARCHAR(50) NOT NULL,
    `parent_id` VARCHAR(50) NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `content_categories_ppt_code_key`(`code`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_level`(`level`),
    INDEX `idx_sort_order`(`sort_order`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `content_categories_ppt` ADD CONSTRAINT `content_categories_ppt_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `content_categories_ppt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

