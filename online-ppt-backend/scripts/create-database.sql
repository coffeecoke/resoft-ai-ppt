-- 创建数据库
CREATE DATABASE IF NOT EXISTS aippt_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS 'aippt_user'@'localhost' 
  IDENTIFIED BY '123456';

-- 授予权限
GRANT ALL PRIVILEGES ON aippt_db.* TO 'aippt_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 显示结果
SELECT 'Database created successfully!' AS message;
SHOW DATABASES LIKE 'aippt_db';
SELECT user, host FROM mysql.user WHERE user = 'aippt_user';

