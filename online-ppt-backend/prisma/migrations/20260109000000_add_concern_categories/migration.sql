-- 创建 concern_categories 表（如果不存在）
-- 注意：由于之前使用了 db push，表可能已存在，如果存在则跳过
SET @table_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'concern_categories'
);

SET @sql = IF(@table_exists = 0,
    'CREATE TABLE `concern_categories` (
        `id` VARCHAR(50) NOT NULL,
        `code` VARCHAR(50) NOT NULL,
        `name` VARCHAR(255) NOT NULL,
        `type` VARCHAR(20) NOT NULL,
        `parent_code` VARCHAR(50) NULL,
        `level` INTEGER NOT NULL DEFAULT 1,
        `description` TEXT NULL,
        `keywords` JSON NULL,
        `sort_order` INTEGER NOT NULL DEFAULT 0,
        `is_active` BOOLEAN NOT NULL DEFAULT true,
        `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        `updated_at` DATETIME(3) NOT NULL,
        UNIQUE INDEX `concern_categories_code_key`(`code`),
        INDEX `idx_type`(`type`),
        INDEX `idx_parent_code`(`parent_code`),
        INDEX `idx_level`(`level`),
        INDEX `idx_is_active`(`is_active`),
        INDEX `idx_sort_order`(`sort_order`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    'SELECT "Table concern_categories already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 concerns 表的字段（如果不存在）
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'concerns' 
    AND column_name = 'category_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `concerns` ADD COLUMN `category_id` VARCHAR(50) NULL',
    'SELECT "Column category_id already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'concerns' 
    AND column_name = 'intent_code'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `concerns` ADD COLUMN `intent_code` VARCHAR(10) NULL',
    'SELECT "Column intent_code already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建索引（如果不存在）
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'concerns' 
    AND index_name = 'idx_category_id'
);

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX `idx_category_id` ON `concerns`(`category_id`)',
    'SELECT "Index idx_category_id already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'concerns' 
    AND index_name = 'idx_intent_code'
);

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX `idx_intent_code` ON `concerns`(`intent_code`)',
    'SELECT "Index idx_intent_code already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加外键约束（如果不存在）
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.key_column_usage 
    WHERE table_schema = DATABASE() 
    AND table_name = 'concerns' 
    AND constraint_name = 'concerns_category_id_fkey'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE `concerns` ADD CONSTRAINT `concerns_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `concern_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key concerns_category_id_fkey already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
