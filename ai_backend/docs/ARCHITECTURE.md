# 架构流程图

本文档使用 Mermaid 图表展示文档文本提取器的架构和流程。

## 1. 总体架构图

```mermaid
graph TB
    A[JSON 文档输入] --> B[DocumentTextExtractor]
    B --> C[JSON 解析器]
    C --> D{遍历 Slides}
    D --> E{遍历 Elements}
    E --> F{元素类型判断}
    
    F -->|text| G[extractTextFromSpan]
    F -->|table| H[extractFromTable]
    
    G --> I[HTML 实体解码]
    H --> I
    
    I --> J[ExtractedText 对象]
    J --> K[按 SlideId 分组]
    K --> L[MergedText 对象]
    
    J --> M[详细版输出<br/>extracted_text.txt]
    L --> N[拼接版输出<br/>extracted_text_merged.txt]
    
    style A fill:#e1f5ff
    style M fill:#c8e6c9
    style N fill:#c8e6c9
```

## 2. 数据处理流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant CLI as 命令行
    participant Ext as DocumentTextExtractor
    participant FS as 文件系统
    participant JSON as JSON 解析器
    participant HTML as HTML 解析器
    
    User->>CLI: node DocumentTextExtractor.js
    CLI->>Ext: run(inputFile, outputFile)
    
    Ext->>FS: 读取 JSON 文件
    FS-->>Ext: JSON 字符串
    
    Ext->>JSON: 解析 JSON
    JSON-->>Ext: rootObject
    
    Ext->>Ext: 提取 title
    
    loop 遍历每个 Slide
        Ext->>Ext: 获取 slide.id
        
        loop 遍历每个 Element
            Ext->>Ext: 判断 element.type
            
            alt element.type === 'table'
                Ext->>Ext: extractFromTable()
            else 其他类型
                Ext->>HTML: extractTextFromSpan()
                HTML-->>Ext: 文本数组
            end
            
            Ext->>Ext: 创建 ExtractedText
        end
    end
    
    Ext->>Ext: 按 SlideId 合并
    
    Ext->>FS: 写入详细版文件
    Ext->>FS: 写入拼接版文件
    
    FS-->>User: 提取完成
```

## 3. 类结构图

```mermaid
classDiagram
    class DocumentTextExtractor {
        -RegExp spanPattern
        +constructor()
        +run(inputFile, outputFile)
        +extractText(inputFile, outputFile)
        +extractFromTable(tableElement, ...)
        +extractTextFromSpan(htmlText)
        +decodeHtmlEntities(text)
        +writeToFile(texts, outputFile)
        +writeMergedFile(texts, outputFile)
    }
    
    class ExtractedText {
        -String fileName
        -String slideId
        -String elementId
        -String text
        +constructor(fileName, slideId, elementId, text)
        +getFileName()
        +getSlideId()
        +getElementId()
        +getText()
    }
    
    class MergedText {
        -String fileName
        -String slideId
        -Array~String~ mergedText
        +constructor(fileName, slideId)
        +appendText(text)
        +getFileName()
        +getSlideId()
        +getMergedText()
    }
    
    DocumentTextExtractor --> ExtractedText : 创建
    DocumentTextExtractor --> MergedText : 创建
    ExtractedText --> MergedText : 合并为
```

## 4. JSON 数据结构解析流程

```mermaid
graph LR
    A[JSON 文档] --> B[rootObject]
    B --> C[title]
    B --> D[slides[]]
    
    D --> E[slide]
    E --> F[slide.id]
    E --> G[slide.elements[]]
    
    G --> H[element]
    H --> I{element.type}
    
    I -->|text| J[element.text.content]
    I -->|text| K[element.content]
    I -->|table| L[element.data[][]]
    
    J --> M[span 标签解析]
    K --> M
    
    L --> N[cell.text]
    N --> O[纯文本]
    
    M --> O
    
    style C fill:#ffeb3b
    style F fill:#ffeb3b
    style O fill:#4caf50
```

## 5. 文本提取状态机

```mermaid
stateDiagram-v2
    [*] --> 读取文件
    读取文件 --> 解析JSON
    解析JSON --> 提取标题
    提取标题 --> 遍历Slides
    
    遍历Slides --> 检查Element类型
    
    检查Element类型 --> 处理Table: type = table
    检查Element类型 --> 处理Text: type != table
    
    处理Table --> 提取单元格文本
    提取单元格文本 --> 创建ExtractedText对象
    
    处理Text --> 提取Span标签
    提取Span标签 --> 解码HTML实体
    解码HTML实体 --> 创建ExtractedText对象
    
    创建ExtractedText对象 --> 检查是否还有Element: 有
    创建ExtractedText对象 --> 检查是否还有Slide: 无Element
    
    检查是否还有Element --> 检查Element类型: 有
    检查是否还有Slide --> 遍历Slides: 有
    检查是否还有Slide --> 合并文本: 无
    
    合并文本 --> 写入详细文件
    写入详细文件 --> 写入拼接文件
    写入拼接文件 --> [*]
```

## 6. 批量处理流程

```mermaid
flowchart TD
    A[开始批量处理] --> B[扫描 documents 目录]
    B --> C{找到 JSON 文件?}
    C -->|否| D[输出:没有文件]
    C -->|是| E[初始化统计信息]
    
    E --> F{遍历每个文件}
    F --> G[读取文件]
    G --> H{处理成功?}
    
    H -->|成功| I[successCount++]
    H -->|失败| J[failedCount++<br/>记录错误信息]
    
    I --> K{还有文件?}
    J --> K
    
    K -->|是| F
    K -->|否| L[输出汇总信息]
    
    L --> M[显示成功/失败列表]
    M --> N[结束]
    
    style D fill:#ffcdd2
    style I fill:#c8e6c9
    style J fill:#ffcdd2
    style N fill:#e1bee7
```

## 7. 错误处理流程

```mermaid
graph TD
    A[开始执行] --> B{文件存在?}
    B -->|否| C[抛出错误:<br/>文件不存在]
    B -->|是| D[读取文件]
    
    D --> E{JSON 格式正确?}
    E -->|否| F[抛出错误:<br/>JSON 解析失败]
    E -->|是| G[提取数据]
    
    G --> H{有 slides 数组?}
    H -->|否| I[输出警告:<br/>未找到 slides]
    H -->|是| J[处理 slides]
    
    J --> K{处理成功?}
    K -->|否| L[捕获异常<br/>输出错误信息]
    K -->|是| M[写入输出文件]
    
    M --> N{写入成功?}
    N -->|否| O[抛出错误:<br/>写入失败]
    N -->|是| P[提取完成]
    
    C --> Q[退出程序]
    F --> Q
    L --> Q
    O --> Q
    
    I --> R[生成空文件]
    R --> P
    
    style C fill:#f44336
    style F fill:#f44336
    style L fill:#ff9800
    style O fill:#f44336
    style P fill:#4caf50
```

## 8. 数据转换管道

```mermaid
graph LR
    A[原始 JSON] --> B[rootObject]
    B --> C[slides 数组]
    C --> D[elements 数组]
    
    D --> E{类型判断}
    
    E -->|text| F1[HTML 内容]
    E -->|table| F2[二维数组]
    
    F1 --> G1[正则匹配]
    G1 --> H1[span 标签内容]
    H1 --> I[HTML 解码]
    
    F2 --> G2[遍历单元格]
    G2 --> H2[cell.text]
    H2 --> I
    
    I --> J[ExtractedText]
    J --> K[详细版输出]
    
    J --> L[按 SlideId 分组]
    L --> M[MergedText]
    M --> N[拼接版输出]
    
    style A fill:#e3f2fd
    style K fill:#c8e6c9
    style N fill:#c8e6c9
```

## 9. 模块依赖关系

```mermaid
graph TD
    A[DocumentTextExtractor.js] --> B[fs.promises]
    A --> C[path]
    A --> D[内置 RegExp]
    
    E[batch-extract.js] --> A
    F[test-extractor.js] --> A
    
    G[online-ppt-backend] -.-> A
    
    style A fill:#2196f3,color:#fff
    style E fill:#4caf50
    style F fill:#ff9800
    style G fill:#9c27b0,color:#fff
```

## 10. 部署架构

```mermaid
graph TB
    subgraph "开发环境"
        A1[DocumentTextExtractor.js]
        A2[batch-extract.js]
        A3[test-extractor.js]
    end
    
    subgraph "数据源"
        B1[online-ppt-backend/data/documents/]
        B2[document_1.json]
        B3[document_4.json]
        B4[document_N.json]
        
        B1 --> B2
        B1 --> B3
        B1 --> B4
    end
    
    subgraph "输出目标"
        C1[ai_backend/output/]
        C2[*.txt 详细版]
        C3[*_merged.txt 拼接版]
        
        C1 --> C2
        C1 --> C3
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    
    A1 --> C1
    A2 --> C1
    A3 --> C1
    
    subgraph "可选集成"
        D1[Express API]
        D2[定时任务]
        D3[消息队列]
    end
    
    D1 -.-> A1
    D2 -.-> A2
    D3 -.-> A1
    
    style A1 fill:#2196f3,color:#fff
    style B1 fill:#ff9800
    style C1 fill:#4caf50
```

## 使用说明

### 如何查看这些图表

1. **在 VS Code 中**：
   - 安装 Mermaid 扩展
   - 打开此文件即可看到渲染的图表

2. **在 GitHub 中**：
   - GitHub 原生支持 Mermaid
   - 直接查看 README.md 即可

3. **在线编辑器**：
   - 访问 [Mermaid Live Editor](https://mermaid.live/)
   - 复制代码块内容进行编辑

### 图表说明

- **图 1-3**：展示整体架构和核心流程
- **图 4-5**：详细展示数据结构和状态转换
- **图 6-7**：批量处理和错误处理流程
- **图 8-10**：数据转换、依赖关系和部署架构

---

**提示**：这些图表可以帮助你快速理解代码结构和执行流程，便于维护和扩展。

