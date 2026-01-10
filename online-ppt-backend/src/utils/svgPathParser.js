import { SVGPathData } from 'svg-pathdata'

/**
 * 获取SVG路径的范围
 * @param {string} path SVG path d属性
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
export const getSvgPathRange = (path) => {
  try {
    const pathData = new SVGPathData(path)
    const xList = []
    const yList = []
    for (const item of pathData.commands) {
      const x = ('x' in item) ? item.x : 0
      const y = ('y' in item) ? item.y : 0
      xList.push(x)
      yList.push(y)
    }
    return {
      minX: Math.min(...xList),
      minY: Math.min(...yList),
      maxX: Math.max(...xList),
      maxY: Math.max(...yList),
    }
  }
  catch {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    }
  }
}

