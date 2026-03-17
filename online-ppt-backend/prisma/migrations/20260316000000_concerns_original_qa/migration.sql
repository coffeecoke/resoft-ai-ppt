-- AlterTable: 保留问答对优化前的原文（首次优化时写入，便于查看/还原）
ALTER TABLE `concerns` ADD COLUMN `question_original` TEXT NULL;
ALTER TABLE `concerns` ADD COLUMN `answer_original` TEXT NULL;
