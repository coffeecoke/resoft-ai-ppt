-- 前端 QA 展示用字段：点赞数、专家核准、专家建议、专家审核人
ALTER TABLE `concerns` ADD COLUMN `likes` INT NOT NULL DEFAULT 0;
ALTER TABLE `concerns` ADD COLUMN `expert_approved` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `concerns` ADD COLUMN `expert_advice` TEXT NULL;
ALTER TABLE `concerns` ADD COLUMN `expert_reviewer` VARCHAR(100) NULL;
