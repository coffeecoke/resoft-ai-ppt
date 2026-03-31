/**
 * 字典管理服务
 * 
 * 提供字典类型和字典数据的增删改查功能
 */
 
import { generateDocumentId } from '../../../utils/idGenerator.js'
import { formatObjectDates, formatArrayDates } from '../../../utils/dateFormatter.js'
import prisma from '../../../lib/prisma.js'

class DictService {
  // ==================== 字典类型管理 ====================

  /**
   * 获取字典类型列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码，默认1
   * @param {number} params.pageSize - 每页数量，默认20
   * @param {string} params.keyword - 关键词搜索（字典类型代码或名称）
   * @param {string} params.status - 状态筛选：0=正常，1=停用
   * @returns {Promise<Object>} { list, total }
   */
  async getDictTypeList(params = {}) {
    try {
      const { page = 1, pageSize = 20, keyword, status } = params
      const skip = (page - 1) * pageSize

      const where = {}
      if (keyword) {
        where.OR = [
          { dict_type: { contains: keyword } },
          { dict_name: { contains: keyword } }
        ]
      }
      if (status !== undefined && status !== '') {
        where.status = status
      }

      const [list, total] = await Promise.all([
        prisma.dict_types.findMany({
          where,
          skip,
          take: parseInt(pageSize),
          orderBy: [
            { sort_order: 'asc' },
            { created_at: 'desc' }
          ],
          include: {
            _count: {
              select: { dict_data: true }
            }
          }
        }),
        prisma.dict_types.count({ where })
      ])

      // 格式化返回数据，添加字典数据数量，并格式化日期
      const formattedList = list.map(item => {
        const formatted = {
          ...item,
          dataCount: item._count.dict_data,
          _count: undefined
        }
        // 格式化日期字段（处理 Date 对象或 ISO 字符串）
        const result = formatObjectDates(formatted, ['created_at', 'updated_at'])
        return result
      })

      return { list: formattedList, total }
    } catch (error) {
      console.error('[字典服务] 获取字典类型列表失败:', error)
      throw new Error(`获取字典类型列表失败: ${error.message}`)
    }
  }

  /**
   * 获取字典类型详情
   * @param {string} id - 字典类型ID
   * @returns {Promise<Object>} 字典类型信息
   */
  async getDictTypeById(id) {
    try {
      const dictType = await prisma.dict_types.findUnique({
        where: { id },
        include: {
          _count: {
            select: { dict_data: true }
          }
        }
      })

      if (!dictType) {
        throw new Error('字典类型不存在')
      }

      const formatted = {
        ...dictType,
        dataCount: dictType._count.dict_data,
        _count: undefined
      }
      // 格式化日期字段
      return formatObjectDates(formatted, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[字典服务] 获取字典类型详情失败:', error)
      throw new Error(`获取字典类型详情失败: ${error.message}`)
    }
  }

  /**
   * 创建字典类型
   * @param {Object} data - 字典类型数据
   * @param {string} data.dict_type - 字典类型代码（必填，唯一）
   * @param {string} data.dict_name - 字典类型名称（必填）
   * @param {string} data.status - 状态：0=正常，1=停用，默认0
   * @param {string} data.remark - 备注
   * @param {number} data.sort_order - 排序字段，默认0
   * @returns {Promise<Object>} 创建的字典类型信息
   */
  async createDictType(data) {
    try {
      // 验证必填字段
      if (!data.dict_type || !data.dict_name) {
        throw new Error('字典类型代码和名称不能为空')
      }

      // 验证字典类型代码格式（只能包含字母、数字、下划线）
      if (!/^[a-zA-Z0-9_]+$/.test(data.dict_type)) {
        throw new Error('字典类型代码只能包含字母、数字、下划线')
      }

      // 检查字典类型代码是否已存在
      const existing = await prisma.dict_types.findUnique({
        where: { dict_type: data.dict_type }
      })
      if (existing) {
        throw new Error('字典类型代码已存在')
      }

      const dictType = await prisma.dict_types.create({
        data: {
          id: generateDocumentId().replace('document_', 'dict_type_'),
          dict_type: data.dict_type,
          dict_name: data.dict_name,
          status: data.status || '0',
          remark: data.remark || null,
          sort_order: data.sort_order || 0
        }
      })

      // 格式化日期字段
      return formatObjectDates(dictType, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[字典服务] 创建字典类型失败:', error)
      throw new Error(`创建字典类型失败: ${error.message}`)
    }
  }

  /**
   * 更新字典类型
   * @param {string} id - 字典类型ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的字典类型信息
   */
  async updateDictType(id, data) {
    try {
      // 检查字典类型是否存在
      const existing = await prisma.dict_types.findUnique({
        where: { id }
      })
      if (!existing) {
        throw new Error('字典类型不存在')
      }

      // 如果更新字典类型代码，需要检查是否重复
      if (data.dict_type && data.dict_type !== existing.dict_type) {
        const duplicate = await prisma.dict_types.findUnique({
          where: { dict_type: data.dict_type }
        })
        if (duplicate) {
          throw new Error('字典类型代码已存在')
        }
      }

      const updated = await prisma.dict_types.update({
        where: { id },
        data: {
          dict_type: data.dict_type,
          dict_name: data.dict_name,
          status: data.status,
          remark: data.remark,
          sort_order: data.sort_order
        }
      })

      // 格式化日期字段
      return formatObjectDates(updated, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[字典服务] 更新字典类型失败:', error)
      throw new Error(`更新字典类型失败: ${error.message}`)
    }
  }

  /**
   * 删除字典类型
   * @param {string} id - 字典类型ID
   * @returns {Promise<void>}
   */
  async deleteDictType(id) {
    try {
      // 检查字典类型是否存在
      const existing = await prisma.dict_types.findUnique({
        where: { id },
        include: {
          _count: {
            select: { dict_data: true }
          }
        }
      })
      if (!existing) {
        throw new Error('字典类型不存在')
      }

      // 如果有关联的字典数据，不允许删除
      if (existing._count.dict_data > 0) {
        throw new Error('该字典类型下存在字典数据，无法删除。请先删除所有字典数据')
      }

      await prisma.dict_types.delete({
        where: { id }
      })
    } catch (error) {
      console.error('[字典服务] 删除字典类型失败:', error)
      throw new Error(`删除字典类型失败: ${error.message}`)
    }
  }

  // ==================== 字典数据管理 ====================

  /**
   * 获取字典数据列表
   * @param {Object} params - 查询参数
   * @param {string} params.dict_type - 字典类型代码（必填）
   * @param {number} params.page - 页码，默认1
   * @param {number} params.pageSize - 每页数量，默认20
   * @param {string} params.keyword - 关键词搜索（字典标签或值）
   * @param {string} params.status - 状态筛选：0=正常，1=停用
   * @returns {Promise<Object>} { list, total }
   */
  async getDictDataList(params = {}) {
    try {
      const { dict_type, page = 1, pageSize = 20, keyword, status } = params

      if (!dict_type) {
        throw new Error('字典类型代码不能为空')
      }

      const where = { dict_type }
      if (keyword) {
        where.OR = [
          { dict_label: { contains: keyword } },
          { dict_value: { contains: keyword } }
        ]
      }
      if (status !== undefined && status !== '') {
        where.status = status
      }

      const skip = (page - 1) * pageSize

      const [list, total] = await Promise.all([
        prisma.dict_data.findMany({
          where,
          skip,
          take: parseInt(pageSize),
          orderBy: [
            { dict_sort: 'asc' },
            { created_at: 'desc' }
          ]
        }),
        prisma.dict_data.count({ where })
      ])

      // 格式化日期字段
      const formattedList = formatArrayDates(list, ['created_at', 'updated_at'])
      return { list: formattedList, total }
    } catch (error) {
      console.error('[字典服务] 获取字典数据列表失败:', error)
      throw new Error(`获取字典数据列表失败: ${error.message}`)
    }
  }

  /**
   * 获取字典数据详情
   * @param {string} id - 字典数据ID
   * @returns {Promise<Object>} 字典数据信息
   */
  async getDictDataById(id) {
    try {
      const dictData = await prisma.dict_data.findUnique({
        where: { id }
      })

      if (!dictData) {
        throw new Error('字典数据不存在')
      }

      // 格式化日期字段
      return formatObjectDates(dictData, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[字典服务] 获取字典数据详情失败:', error)
      throw new Error(`获取字典数据详情失败: ${error.message}`)
    }
  }

  /**
   * 创建字典数据
   * @param {Object} data - 字典数据
   * @param {string} data.dict_type - 字典类型代码（必填）
   * @param {string} data.dict_label - 字典标签（必填）
   * @param {string} data.dict_value - 字典值（必填）
   * @param {number} data.dict_sort - 排序字段，默认0
   * @param {string} data.css_class - CSS类名
   * @param {string} data.list_class - 列表样式类
   * @param {string} data.is_default - 是否默认：Y=是，N=否，默认N
   * @param {string} data.status - 状态：0=正常，1=停用，默认0
   * @param {string} data.remark - 备注
   * @returns {Promise<Object>} 创建的字典数据信息
   */
  async createDictData(data) {
    try {
      // 验证必填字段
      if (!data.dict_type || !data.dict_label || !data.dict_value) {
        throw new Error('字典类型代码、标签和值不能为空')
      }

      // 检查字典类型是否存在
      const dictType = await prisma.dict_types.findUnique({
        where: { dict_type: data.dict_type }
      })
      if (!dictType) {
        throw new Error('字典类型不存在')
      }

      // 检查同一字典类型下，字典值是否重复
      const existing = await prisma.dict_data.findUnique({
        where: {
          dict_type_dict_value: {
            dict_type: data.dict_type,
            dict_value: data.dict_value
          }
        }
      })
      if (existing) {
        throw new Error('该字典类型下已存在相同的字典值')
      }

      // 如果设置为默认，需要取消同类型下其他默认项
      if (data.is_default === 'Y') {
        await prisma.dict_data.updateMany({
          where: {
            dict_type: data.dict_type,
            is_default: 'Y'
          },
          data: {
            is_default: 'N'
          }
        })
      }

      const dictData = await prisma.dict_data.create({
        data: {
          id: generateDocumentId().replace('document_', 'dict_data_'),
          dict_type: data.dict_type,
          dict_label: data.dict_label,
          dict_value: data.dict_value,
          dict_sort: data.dict_sort || 0,
          css_class: data.css_class || null,
          list_class: data.list_class || null,
          is_default: data.is_default || 'N',
          status: data.status || '0',
          remark: data.remark || null
        }
      })

      // 格式化日期字段
      return formatObjectDates(dictData, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[字典服务] 创建字典数据失败:', error)
      throw new Error(`创建字典数据失败: ${error.message}`)
    }
  }

  /**
   * 更新字典数据
   * @param {string} id - 字典数据ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的字典数据信息
   */
  async updateDictData(id, data) {
    try {
      // 检查字典数据是否存在
      const existing = await prisma.dict_data.findUnique({
        where: { id }
      })
      if (!existing) {
        throw new Error('字典数据不存在')
      }

      // 如果更新字典值，需要检查是否重复
      if (data.dict_value && data.dict_value !== existing.dict_value) {
        const duplicate = await prisma.dict_data.findUnique({
          where: {
            dict_type_dict_value: {
              dict_type: existing.dict_type,
              dict_value: data.dict_value
            }
          }
        })
        if (duplicate) {
          throw new Error('该字典类型下已存在相同的字典值')
        }
      }

      // 如果设置为默认，需要取消同类型下其他默认项
      if (data.is_default === 'Y') {
        await prisma.dict_data.updateMany({
          where: {
            dict_type: existing.dict_type,
            is_default: 'Y',
            id: { not: id }
          },
          data: {
            is_default: 'N'
          }
        })
      }

      const updated = await prisma.dict_data.update({
        where: { id },
        data: {
          dict_label: data.dict_label,
          dict_value: data.dict_value,
          dict_sort: data.dict_sort,
          css_class: data.css_class,
          list_class: data.list_class,
          is_default: data.is_default,
          status: data.status,
          remark: data.remark
        }
      })

      // 格式化日期字段
      return formatObjectDates(updated, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[字典服务] 更新字典数据失败:', error)
      throw new Error(`更新字典数据失败: ${error.message}`)
    }
  }

  /**
   * 删除字典数据
   * @param {string} id - 字典数据ID
   * @returns {Promise<void>}
   */
  async deleteDictData(id) {
    try {
      // 检查字典数据是否存在
      const existing = await prisma.dict_data.findUnique({
        where: { id }
      })
      if (!existing) {
        throw new Error('字典数据不存在')
      }

      await prisma.dict_data.delete({
        where: { id }
      })
    } catch (error) {
      console.error('[字典服务] 删除字典数据失败:', error)
      throw new Error(`删除字典数据失败: ${error.message}`)
    }
  }

  // ==================== 字典查询（前端工具库使用） ====================

  /**
   * 根据字典类型代码获取字典数据（前端工具库使用）
   * 只返回正常状态的字典数据，按排序字段排序
   * @param {string} dictType - 字典类型代码
   * @returns {Promise<Array>} 字典数据列表
   */
  async getDictByType(dictType) {
    try {
      if (!dictType) {
        return []
      }

      const dictData = await prisma.dict_data.findMany({
        where: {
          dict_type: dictType,
          status: '0' // 只返回正常状态的
        },
        orderBy: { dict_sort: 'asc' }
      })

      return dictData
    } catch (error) {
      console.error('[字典服务] 根据类型获取字典数据失败:', error)
      // 前端工具库使用，失败时返回空数组，不抛出异常
      return []
    }
  }

  /**
   * 批量获取多个字典类型的数据（前端工具库使用）
   * @param {Array<string>} dictTypes - 字典类型代码数组
   * @returns {Promise<Object>} { dictType1: [...], dictType2: [...] }
   */
  async getDictsByTypes(dictTypes) {
    try {
      if (!Array.isArray(dictTypes) || dictTypes.length === 0) {
        return {}
      }

      const dictData = await prisma.dict_data.findMany({
        where: {
          dict_type: { in: dictTypes },
          status: '0' // 只返回正常状态的
        },
        orderBy: [
          { dict_type: 'asc' },
          { dict_sort: 'asc' }
        ]
      })

      // 按字典类型分组
      const result = {}
      dictTypes.forEach(type => {
        result[type] = dictData.filter(item => item.dict_type === type)
      })

      return result
    } catch (error) {
      console.error('[字典服务] 批量获取字典数据失败:', error)
      // 前端工具库使用，失败时返回空对象
      return {}
    }
  }
}

export default new DictService()

