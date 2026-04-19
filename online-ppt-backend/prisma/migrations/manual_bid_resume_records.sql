-- 手动执行：投标文件简历抽取表（与 bid_sections 独立）
-- 执行前请确认库名；Prisma migrate 用户可改为正式 migration

CREATE TABLE IF NOT EXISTS `bid_resume_records` (
  `id` VARCHAR(50) NOT NULL,
  `run_batch_id` VARCHAR(50) NULL,
  `source_docx_path` VARCHAR(800) NOT NULL,
  `source_docx_basename` VARCHAR(255) NOT NULL,
  `h1_section_title` VARCHAR(500) NOT NULL,
  `l2_section_title` VARCHAR(500) NULL,
  `person_name` VARCHAR(100) NULL,
  `role_title` VARCHAR(200) NULL,
  `raw_text` LONGTEXT NULL,
  `extracted_json` JSON NULL,
  `split_docx_path` VARCHAR(500) NULL,
  `manifest_path` VARCHAR(800) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_bidresume_batch` (`run_batch_id`),
  KEY `idx_bidresume_srcbase` (`source_docx_basename`),
  KEY `idx_bidresume_person` (`person_name`),
  KEY `idx_bidresume_created` (`created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
