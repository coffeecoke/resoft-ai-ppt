-- AlterTable
ALTER TABLE `documents` ADD COLUMN `product_id` VARCHAR(50) NULL,
    ADD COLUMN `session_id` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `thumbnails` ADD COLUMN `analyzed_at` DATETIME(3) NULL,
    ADD COLUMN `page_type` VARCHAR(100) NULL,
    ADD COLUMN `page_type_confidence` DOUBLE NULL;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `category` VARCHAR(50) NULL,
    `tags` JSON NULL,
    `icon` VARCHAR(500) NULL,
    `cover` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_code_key`(`code`),
    INDEX `idx_category`(`category`),
    INDEX `idx_is_active`(`is_active`),
    INDEX `idx_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_catalogs` (
    `id` VARCHAR(50) NOT NULL,
    `product_id` VARCHAR(50) NOT NULL,
    `parent_id` VARCHAR(50) NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `level` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_level`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_documents` (
    `id` VARCHAR(50) NOT NULL,
    `product_id` VARCHAR(50) NOT NULL,
    `document_id` VARCHAR(50) NOT NULL,
    `catalog_id` VARCHAR(50) NULL,
    `version` VARCHAR(20) NOT NULL DEFAULT 'public',
    `slide_pages` JSON NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_document_id`(`document_id`),
    INDEX `idx_catalog_id`(`catalog_id`),
    INDEX `idx_version`(`version`),
    UNIQUE INDEX `uk_product_document_catalog`(`product_id`, `document_id`, `catalog_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_type_catalog_mappings` (
    `id` VARCHAR(50) NOT NULL,
    `product_id` VARCHAR(50) NOT NULL,
    `catalog_id` VARCHAR(50) NOT NULL,
    `page_type` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_catalog_id`(`catalog_id`),
    INDEX `idx_page_type`(`page_type`),
    UNIQUE INDEX `uk_product_catalog_page_type`(`product_id`, `catalog_id`, `page_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `customer_name` VARCHAR(255) NOT NULL,
    `session_date` DATETIME(3) NOT NULL,
    `duration` INTEGER NULL,
    `location` VARCHAR(255) NULL,
    `video_url` VARCHAR(500) NULL,
    `thumbnail` VARCHAR(500) NULL,
    `participants` JSON NULL,
    `product_id` VARCHAR(50) NULL,
    `industry` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(50) NULL,

    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_customer_name`(`customer_name`),
    INDEX `idx_session_date`(`session_date`),
    INDEX `idx_created_by`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `concerns` (
    `id` VARCHAR(50) NOT NULL,
    `question` TEXT NOT NULL,
    `category` VARCHAR(100) NULL,
    `priority` VARCHAR(20) NULL,
    `answer` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_category`(`category`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_concerns` (
    `id` VARCHAR(50) NOT NULL,
    `session_id` VARCHAR(50) NOT NULL,
    `concern_id` VARCHAR(50) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_session_id`(`session_id`),
    INDEX `idx_concern_id`(`concern_id`),
    UNIQUE INDEX `uk_session_concern`(`session_id`, `concern_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_concerns` (
    `id` VARCHAR(50) NOT NULL,
    `document_id` VARCHAR(50) NOT NULL,
    `concern_id` VARCHAR(50) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_document_id`(`document_id`),
    INDEX `idx_concern_id`(`concern_id`),
    UNIQUE INDEX `uk_document_concern`(`document_id`, `concern_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_needs` (
    `id` VARCHAR(50) NOT NULL,
    `session_id` VARCHAR(50) NOT NULL,
    `need` TEXT NOT NULL,
    `priority` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_session_id`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_product_id` ON `documents`(`product_id`);

-- CreateIndex
CREATE INDEX `idx_session_id` ON `documents`(`session_id`);

-- CreateIndex
CREATE INDEX `idx_page_type` ON `thumbnails`(`page_type`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_catalogs` ADD CONSTRAINT `product_catalogs_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_catalogs` ADD CONSTRAINT `product_catalogs_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `product_catalogs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_documents` ADD CONSTRAINT `product_documents_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_documents` ADD CONSTRAINT `product_documents_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_documents` ADD CONSTRAINT `product_documents_catalog_id_fkey` FOREIGN KEY (`catalog_id`) REFERENCES `product_catalogs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_type_catalog_mappings` ADD CONSTRAINT `page_type_catalog_mappings_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_type_catalog_mappings` ADD CONSTRAINT `page_type_catalog_mappings_catalog_id_fkey` FOREIGN KEY (`catalog_id`) REFERENCES `product_catalogs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_concerns` ADD CONSTRAINT `session_concerns_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_concerns` ADD CONSTRAINT `session_concerns_concern_id_fkey` FOREIGN KEY (`concern_id`) REFERENCES `concerns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_concerns` ADD CONSTRAINT `document_concerns_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_concerns` ADD CONSTRAINT `document_concerns_concern_id_fkey` FOREIGN KEY (`concern_id`) REFERENCES `concerns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_needs` ADD CONSTRAINT `session_needs_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
