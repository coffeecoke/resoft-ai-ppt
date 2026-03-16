-- CreateTable: 交流报备表（客户交流报备记录）
CREATE TABLE `communication_reports` (
    `id` VARCHAR(50) NOT NULL,
    `lead_code` VARCHAR(100) NULL,
    `lead_id` VARCHAR(50) NULL,
    `report_date` DATETIME(3) NOT NULL,
    `start_at` DATETIME(3) NULL,
    `end_at` DATETIME(3) NULL,
    `record_method` VARCHAR(50) NULL,
    `communication_form` VARCHAR(50) NULL,
    `speaker` VARCHAR(100) NULL,
    `our_participants` TEXT NULL,
    `client_participants` TEXT NULL,
    `customer_name` VARCHAR(255) NOT NULL,
    `lead_name` VARCHAR(255) NULL,
    `main_content` VARCHAR(500) NULL,
    `system_name` VARCHAR(255) NULL,
    `report_note` TEXT NULL,
    `objectives` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(50) NULL,

    INDEX `idx_comm_report_lead_code`(`lead_code`),
    INDEX `idx_comm_report_lead_id`(`lead_id`),
    INDEX `idx_comm_report_customer`(`customer_name`),
    INDEX `idx_comm_report_date`(`report_date`),
    INDEX `idx_comm_report_created_by`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 交流报备推送临时表
CREATE TABLE `communication_report_inbox` (
    `id` VARCHAR(50) NOT NULL,
    `sender` VARCHAR(100) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_inbox_sent_at`(`sent_at`),
    INDEX `idx_inbox_sender`(`sender`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: communication_reports.lead_id -> leads.id
ALTER TABLE `communication_reports` ADD CONSTRAINT `communication_reports_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
