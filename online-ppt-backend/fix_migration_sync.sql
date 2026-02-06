-- 修复迁移记录同步问题
-- 删除数据库中不存在的迁移记录

-- 删除已删除的迁移记录
DELETE FROM _prisma_migrations 
WHERE migration_name = '20260109150000_add_dict_tables';

-- 查看当前迁移记录
SELECT migration_name, finished_at, applied_steps_count 
FROM _prisma_migrations 
ORDER BY finished_at;




