-- 修复 transcriptions 表的字段类型，将 TEXT 改为 LONGTEXT
-- 解决 "The provided value for the column is too long for the column's type" 错误

USE aippt_db;

-- 修改 dialogues 字段为 LONGTEXT
ALTER TABLE transcriptions 
MODIFY COLUMN dialogues LONGTEXT NULL COMMENT '对话列表（JSON数组）';

-- 修改 full_text 字段为 LONGTEXT
ALTER TABLE transcriptions 
MODIFY COLUMN full_text LONGTEXT NULL COMMENT '完整文本内容（用于搜索）';

-- 修改 speaker_roles 字段为 LONGTEXT（虽然通常不会很长，但为了安全）
ALTER TABLE transcriptions 
MODIFY COLUMN speaker_roles LONGTEXT NULL COMMENT '说话人角色设置（JSON格式）';

-- 修改 error_message 字段为 LONGTEXT（错误信息可能很长）
ALTER TABLE transcriptions 
MODIFY COLUMN error_message LONGTEXT NULL COMMENT '错误信息（失败时记录）';

-- 显示修改结果
SHOW COLUMNS FROM transcriptions LIKE '%dialogues%';
SHOW COLUMNS FROM transcriptions LIKE '%full_text%';
SHOW COLUMNS FROM transcriptions LIKE '%speaker_roles%';
SHOW COLUMNS FROM transcriptions LIKE '%error_message%';

