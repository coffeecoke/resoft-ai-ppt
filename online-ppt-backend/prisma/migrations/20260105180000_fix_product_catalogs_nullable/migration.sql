-- AlterTable: 修复 product_catalogs.product_id 字段，允许为 NULL（所有产品共用目录时）
ALTER TABLE `product_catalogs` MODIFY COLUMN `product_id` VARCHAR(50) NULL;

