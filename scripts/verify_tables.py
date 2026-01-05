#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证数据库表是否创建成功
"""
import pymysql

# 数据库连接配置
DB_CONFIG = {
    'host': '10.168.188.131',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'pre_sales_analysis',
    'charset': 'utf8mb4'
}

def verify_tables():
    """验证表是否创建成功"""
    try:
        connection = pymysql.connect(**DB_CONFIG)
        
        try:
            with connection.cursor() as cursor:
                # 查询所有表
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                
                print(f"[INFO] 数据库中共有 {len(tables)} 张表：")
                for table in tables:
                    table_name = table[0]
                    # 查询表的记录数
                    cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                    count = cursor.fetchone()[0]
                    print(f"  - {table_name}: {count} 条记录")
                
                # 验证分类数据
                cursor.execute("SELECT COUNT(*) FROM ppt_categories WHERE level = 1")
                parent_count = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM ppt_categories WHERE level = 2")
                child_count = cursor.fetchone()[0]
                
                print(f"\n[INFO] 分类数据：")
                print(f"  - 父类数量: {parent_count}")
                print(f"  - 子类数量: {child_count}")
                
                print("\n[SUCCESS] 数据库表结构验证完成！")
                
        finally:
            connection.close()
            
    except Exception as e:
        print(f"[ERROR] 验证失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    verify_tables()

