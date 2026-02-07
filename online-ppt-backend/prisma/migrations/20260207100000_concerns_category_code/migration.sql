-- concerns 关联 concern_categories 改为按 code（稳定），不再按 id；降级时用 category 旧字段

-- 1. 新增 category_code
ALTER TABLE `concerns` ADD COLUMN `category_code` VARCHAR(50) NULL;

-- 2. 从原 category_id 回填 code（存在则填）
UPDATE `concerns` c
INNER JOIN `concern_categories` cc ON c.`category_id` = cc.`id`
SET c.`category_code` = cc.`code`
WHERE c.`category_id` IS NOT NULL;

-- 3. 删除原外键与 category_id（若表里没有 category_id 列则跳过 3、4）
-- 外键名可查：SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='concerns' AND COLUMN_NAME='category_id' AND REFERENCED_TABLE_NAME IS NOT NULL;
ALTER TABLE `concerns` DROP FOREIGN KEY `concerns_category_id_fkey`;
ALTER TABLE `concerns` DROP COLUMN `category_id`;

-- 5. 建索引
CREATE INDEX `idx_category_code` ON `concerns`(`category_code`);

-- 6. 新外键：category_code -> concern_categories(code)
ALTER TABLE `concerns` ADD CONSTRAINT `concerns_category_code_fkey` FOREIGN KEY (`category_code`) REFERENCES `concern_categories`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;
