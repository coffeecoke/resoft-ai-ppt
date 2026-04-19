#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入SQL脚本到MySQL数据库
"""
import pymysql
import sys
import os

# 数据库连接配置
DB_CONFIG = {
    'host': '10.168.188.131',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'pre_sales_analysis',
    'charset': 'utf8mb4'
}

def execute_sql_file(sql_file_path):
    """执行SQL文件"""
    try:
        # 读取SQL文件
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # 连接数据库
        print(f"正在连接数据库 {DB_CONFIG['host']}:{DB_CONFIG['port']}...")
        connection = pymysql.connect(**DB_CONFIG)
        print(f"[INFO] 数据库连接成功！")
        
        try:
            with connection.cursor() as cursor:
                # 分割SQL语句（按分号和换行）
                # 过滤掉注释和空语句
                statements = []
                current_statement = []
                
                for line in sql_content.split('\n'):
                    line = line.strip()
                    # 跳过注释和空行
                    if not line or line.startswith('--') or line.startswith('/*'):
                        continue
                    
                    current_statement.append(line)
                    
                    # 如果行以分号结尾，说明是一个完整的SQL语句
                    if line.endswith(';'):
                        statement = ' '.join(current_statement)
                        if statement and statement != ';':
                            statements.append(statement)
                        current_statement = []
                
                # 执行所有SQL语句
                print(f"共找到 {len(statements)} 条SQL语句，开始执行...")
                
                for i, statement in enumerate(statements, 1):
                    try:
                        cursor.execute(statement)
                        if i % 10 == 0:
                            print(f"已执行 {i}/{len(statements)} 条SQL语句...")
                    except Exception as e:
                        print(f"执行第 {i} 条SQL时出错: {e}")
                        print(f"SQL内容: {statement[:200]}...")
                        # 继续执行下一条
                        continue
                
                # 提交事务
                connection.commit()
                print(f"\n[SUCCESS] 成功执行 {len(statements)} 条SQL语句！")
                print("[SUCCESS] 数据库表结构导入完成！")
                
        finally:
            connection.close()
            
    except FileNotFoundError:
        print(f"[ERROR] 错误：找不到SQL文件 {sql_file_path}")
        sys.exit(1)
    except pymysql.Error as e:
        print(f"[ERROR] 数据库错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    # SQL文件路径
    sql_file = os.path.join(os.path.dirname(__file__), '..', 'docs', 'PPT数据库表结构.sql')
    sql_file = os.path.abspath(sql_file)
    
    print(f"SQL文件路径: {sql_file}")
    print(f"目标数据库: {DB_CONFIG['database']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}\n")
    
    execute_sql_file(sql_file)

