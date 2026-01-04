/**
 * 测试外部文件提取脚本
 * 用于处理中文路径的文件
 */

const { DocumentTextExtractor } = require('../core/extractors/DocumentTextExtractor')
const fs = require('fs').promises
const path = require('path')

async function testExternalFile() {
  try {
    console.log('='.repeat(60))
    console.log('测试外部文件提取')
    console.log('='.repeat(60))
    
    // 尝试多个可能的路径
    const possiblePaths = [
      'E:\\ppt文件\\产品PPT\\产品PPT\\document_3.json',
      'E:\\ppt�ļ�\\产品PPT\\产品PPT\\document_3.json',
      'E:\\ppt文件\\document_3.json'
    ]
    
    let inputFile = null
    
    // 查找存在的文件
    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath)
        inputFile = testPath
        console.log(`✅ 找到文件: ${testPath}`)
        break
      } catch (err) {
        console.log(`⏭️  路径不存在: ${testPath}`)
      }
    }
    
    if (!inputFile) {
      console.log('\n尝试扫描 E:\\ 目录...')
      // 扫描 E 盘寻找文件
      const eDrive = 'E:\\'
      const folders = await fs.readdir(eDrive, { withFileTypes: true })
      
      for (const folder of folders) {
        if (folder.isDirectory() && folder.name.includes('ppt')) {
          const pptFolder = path.join(eDrive, folder.name)
          console.log(`📁 检查目录: ${pptFolder}`)
          
          try {
            // 递归查找 document_3.json
            const findFile = async (dir, depth = 0) => {
              if (depth > 3) return null // 限制深度
              
              const items = await fs.readdir(dir, { withFileTypes: true })
              
              for (const item of items) {
                const fullPath = path.join(dir, item.name)
                
                if (item.isFile() && item.name === 'document_3.json') {
                  return fullPath
                }
                
                if (item.isDirectory() && depth < 3) {
                  const found = await findFile(fullPath, depth + 1)
                  if (found) return found
                }
              }
              return null
            }
            
            const found = await findFile(pptFolder)
            if (found) {
              inputFile = found
              console.log(`✅ 找到文件: ${found}`)
              break
            }
          } catch (err) {
            console.log(`   ⚠️  无法访问: ${err.message}`)
          }
        }
      }
    }
    
    if (!inputFile) {
      console.log('\n❌ 未找到 document_3.json 文件')
      console.log('\n请手动指定文件路径，或者将文件复制到:')
      console.log(`   ${path.join(__dirname, 'output', 'document_3.json')}`)
      process.exit(1)
    }
    
    // 提取文本
    console.log('\n' + '='.repeat(60))
    console.log('开始提取文本...')
    console.log('='.repeat(60))
    
    const extractor = new DocumentTextExtractor()
    const outputFile = path.join(__dirname, 'output', 'document_3_test.txt')
    
    await extractor.run(inputFile, outputFile)
    
    console.log('\n✅ 提取完成！')
    console.log(`输出文件: ${outputFile}`)
    console.log(`拼接版: ${outputFile.replace('.txt', '_merged.txt')}`)
    
    // 显示提取结果摘要
    const content = await fs.readFile(outputFile, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('='))
    
    console.log('\n' + '='.repeat(60))
    console.log('提取结果摘要')
    console.log('='.repeat(60))
    console.log(`总行数: ${lines.length - 1} 条记录（不含表头）`)
    
    if (lines.length > 1) {
      console.log('\n前 10 条记录:')
      console.log('-'.repeat(60))
      lines.slice(0, 11).forEach((line, index) => {
        if (line.trim()) {
          console.log(line.substring(0, 100) + (line.length > 100 ? '...' : ''))
        }
      })
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    console.error('\n详细信息:', error)
    process.exit(1)
  }
}

// 运行测试
testExternalFile()

