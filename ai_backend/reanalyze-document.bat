@echo off
chcp 65001 >nul
echo.
echo ====================================
echo 重新分析文档 (使用最新分类标准)
echo ====================================
echo.
echo 文档: document_1 (个人ppt-一表通)
echo 模型: custom-openai
echo.
echo 开始分析...
echo.

curl -X POST http://localhost:3002/api/ppt-analysis/analyze/document_1 ^
  -H "Content-Type: application/json" ^
  -d "{\"modelName\":\"custom-openai\"}"

echo.
echo.
echo 分析完成！
echo 请运行 node diagnose-analysis-results.js 查看结果
echo.
pause

