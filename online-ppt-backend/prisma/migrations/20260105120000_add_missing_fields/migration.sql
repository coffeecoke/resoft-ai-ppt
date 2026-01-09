-- AlterTable: 添加 documents.audience_names 字段
ALTER TABLE `documents` ADD COLUMN `audience_names` TEXT NULL;

-- AlterTable: 修复 transcriptions 表的字段类型（TEXT -> LONGTEXT）
ALTER TABLE `transcriptions` MODIFY COLUMN `dialogues` LONGTEXT NULL;

-- AlterTable: 修复 transcriptions 表的字段类型（TEXT -> LONGTEXT）
ALTER TABLE `transcriptions` MODIFY COLUMN `full_text` LONGTEXT NULL;

-- AlterTable: 添加 transcriptions.speaker_roles 字段
ALTER TABLE `transcriptions` ADD COLUMN `speaker_roles` LONGTEXT NULL;

-- AlterTable: 修复 transcriptions.error_message 字段类型（TEXT -> LONGTEXT）
ALTER TABLE `transcriptions` MODIFY COLUMN `error_message` LONGTEXT NULL;

