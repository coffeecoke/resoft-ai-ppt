-- 给 aippt_user 添加创建数据库的权限(用于 Prisma shadow database)
GRANT CREATE ON *.* TO 'aippt_user'@'localhost';
FLUSH PRIVILEGES;

