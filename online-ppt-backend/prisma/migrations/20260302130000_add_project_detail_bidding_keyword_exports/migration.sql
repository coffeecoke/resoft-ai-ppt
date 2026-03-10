-- AlterTable: 招投标关键词导出表增加「项目详情」字段
ALTER TABLE `bidding_keyword_exports` ADD COLUMN `project_detail` TEXT NULL;
