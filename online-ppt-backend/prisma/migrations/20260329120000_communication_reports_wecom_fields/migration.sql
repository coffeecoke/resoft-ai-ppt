-- 企微交流报备：来源、消息去重、JSON 快照路径
ALTER TABLE `communication_reports`
    ADD COLUMN `source_channel` VARCHAR(50) NULL COMMENT '如 wecom_bot' AFTER `created_by`,
    ADD COLUMN `wecom_msg_id` VARCHAR(100) NULL COMMENT '企微消息 msgid' AFTER `source_channel`,
    ADD COLUMN `snapshot_json_path` VARCHAR(500) NULL COMMENT '落盘 JSON 相对上传根目录路径' AFTER `wecom_msg_id`;

CREATE INDEX `idx_comm_report_wecom_msg` ON `communication_reports`(`wecom_msg_id`);
