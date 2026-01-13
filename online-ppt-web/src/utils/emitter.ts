import mitt, { type Emitter } from 'mitt'

export const enum EmitterEvents {
  RICH_TEXT_COMMAND = 'RICH_TEXT_COMMAND',
  SYNC_RICH_TEXT_ATTRS_TO_STORE = 'SYNC_RICH_TEXT_ATTRS_TO_STORE',
  OPEN_CHART_DATA_EDITOR = 'OPEN_CHART_DATA_EDITOR',
  OPEN_LATEX_EDITOR = 'OPEN_LATEX_EDITOR',
  GET_SELECTION_INFO = 'GET_SELECTION_INFO',
  REPLACE_TEXT_RANGE = 'REPLACE_TEXT_RANGE',
}

export interface RichTextAction {
  command: string
  value?: string
}

export interface RichTextCommand {
  target?: string
  action: RichTextAction | RichTextAction[]
}

export interface SelectionInfo {
  hasSelection: boolean
  selectedText: string
  from: number
  to: number
  fullContent: string
  elementId: string
  // 新增：HTML 结构信息
  selectedHTML?: string  // 选中部分的 HTML（如果有选中）
  fullHTML?: string      // 完整内容的 HTML
  paragraphStructures?: Array<{  // 段落结构信息
    text: string
    html: string
    styles: string  // 段落的样式字符串
  }>
}

export interface GetSelectionInfoPayload {
  elementId: string
  callback: (info: SelectionInfo) => void
}

export interface ReplaceTextRangePayload {
  elementId: string
  from: number
  to: number
  newText: string
}

type Events = {
  [EmitterEvents.RICH_TEXT_COMMAND]: RichTextCommand
  [EmitterEvents.SYNC_RICH_TEXT_ATTRS_TO_STORE]: void
  [EmitterEvents.OPEN_CHART_DATA_EDITOR]: void
  [EmitterEvents.OPEN_LATEX_EDITOR]: void
  [EmitterEvents.GET_SELECTION_INFO]: GetSelectionInfoPayload
  [EmitterEvents.REPLACE_TEXT_RANGE]: ReplaceTextRangePayload
} 

const emitter: Emitter<Events> = mitt<Events>()

export default emitter