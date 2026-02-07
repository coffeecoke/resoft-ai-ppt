-- 创建售前交流综合分析结果表
CREATE TABLE IF NOT EXISTS `presales_analysis_results` (
    `id` VARCHAR(50) NOT NULL,
    `transcription_id` VARCHAR(50) NOT NULL,
    
    -- 分析配置
    `model_id` VARCHAR(50) NULL,
    `model_name` VARCHAR(100) NULL,
    `prompt_code` VARCHAR(100) NULL,
    `prompt_name` VARCHAR(100) NULL,
    
    -- 分析结果（JSON格式）
    `analysis_result` LONGTEXT NOT NULL,
    
    -- 元数据
    `dialogue_count` INT DEFAULT 0,
    `analysis_time` INT NULL,
    `confidence` DECIMAL(3, 2) NULL,
    
    -- 状态
    `status` VARCHAR(20) DEFAULT 'completed',
    `error_message` TEXT NULL,
    
    -- 时间戳
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (`id`),
    INDEX `idx_transcription_id`(`transcription_id`),
    INDEX `idx_created_at`(`created_at`),
    CONSTRAINT `fk_presales_analysis_transcription` FOREIGN KEY (`transcription_id`) REFERENCES `transcriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

