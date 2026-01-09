-- CreateTable (幂等性处理：如果表已存在则跳过)
CREATE TABLE IF NOT EXISTS `dict_types` (
    `id` VARCHAR(50) NOT NULL,
    `dict_type` VARCHAR(100) NOT NULL,
    `dict_name` VARCHAR(255) NOT NULL,
    `status` VARCHAR(1) NOT NULL DEFAULT '0',
    `remark` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `dict_types_dict_type_key`(`dict_type`),
    INDEX `idx_dict_type`(`dict_type`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable (幂等性处理：如果表已存在则跳过)
CREATE TABLE IF NOT EXISTS `dict_data` (
    `id` VARCHAR(50) NOT NULL,
    `dict_type` VARCHAR(100) NOT NULL,
    `dict_label` VARCHAR(255) NOT NULL,
    `dict_value` VARCHAR(255) NOT NULL,
    `dict_sort` INTEGER NOT NULL DEFAULT 0,
    `css_class` VARCHAR(100) NULL,
    `list_class` VARCHAR(100) NULL,
    `is_default` VARCHAR(1) NOT NULL DEFAULT 'N',
    `status` VARCHAR(1) NOT NULL DEFAULT '0',
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `idx_dict_type`(`dict_type`),
    INDEX `idx_dict_value`(`dict_value`),
    INDEX `idx_status`(`status`),
    UNIQUE INDEX `uk_dict_type_value`(`dict_type`, `dict_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dict_data` ADD CONSTRAINT `dict_data_dict_type_fkey` FOREIGN KEY (`dict_type`) REFERENCES `dict_types`(`dict_type`) ON DELETE CASCADE ON UPDATE CASCADE;

