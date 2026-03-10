-- 对应迁移 20260207300000_add_products_is_featured
ALTER TABLE `products` ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false;
