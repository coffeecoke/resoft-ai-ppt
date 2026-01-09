/**
 * 系统管理 API 服务
 * 
 * 封装角色、用户、部门管理相关的 API 调用
 */

import axios from '../config'

const API_BASE = '/api/admin/system'

// ==================== 角色管理 ====================

export interface Role {
  id: string
  role_name: string
  role_key: string
  role_sort: number
  status: string
  remark?: string
  create_time: string
}

export interface RoleListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export interface RoleListResponse {
  list: Role[]
  total: number
}

export async function getRoleList(params: RoleListParams = {}): Promise<RoleListResponse> {
  const response = await axios.get<{ success: boolean; data: RoleListResponse; error?: string }>(`${API_BASE}/role`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取角色列表失败')
  }
  return response.data
}

export async function getRoleById(id: string): Promise<Role> {
  const response = await axios.get<{ success: boolean; data: Role; error?: string }>(`${API_BASE}/role/${id}`)
  if (!response.success) {
    throw new Error(response.error || '获取角色详情失败')
  }
  return response.data
}

export async function createRole(data: Partial<Role>): Promise<Role> {
  const response = await axios.post<{ success: boolean; data: Role; error?: string }>(`${API_BASE}/role`, data)
  if (!response.success) {
    throw new Error(response.error || '创建角色失败')
  }
  return response.data
}

export async function updateRole(id: string, data: Partial<Role>): Promise<Role> {
  const response = await axios.put<{ success: boolean; data: Role; error?: string }>(`${API_BASE}/role/${id}`, data)
  if (!response.success) {
    throw new Error(response.error || '更新角色失败')
  }
  return response.data
}

export async function deleteRole(id: string): Promise<void> {
  const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE}/role/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除角色失败')
  }
}

// ==================== 用户管理 ====================

export interface User {
  id: string
  user_name: string
  nick_name: string
  email?: string
  phone?: string
  sex: string
  status: string
  dept_id?: string
  dept_name?: string
  role_ids?: string[]
  create_time: string
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  dept_id?: string
}

export interface UserListResponse {
  list: User[]
  total: number
}

export async function getUserList(params: UserListParams = {}): Promise<UserListResponse> {
  const response = await axios.get<{ success: boolean; data: UserListResponse; error?: string }>(`${API_BASE}/user`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取用户列表失败')
  }
  return response.data
}

export async function getUserById(id: string): Promise<User> {
  const response = await axios.get<{ success: boolean; data: User; error?: string }>(`${API_BASE}/user/${id}`)
  if (!response.success) {
    throw new Error(response.error || '获取用户详情失败')
  }
  return response.data
}

export async function createUser(data: Partial<User> & { password: string }): Promise<User> {
  const response = await axios.post<{ success: boolean; data: User; error?: string }>(`${API_BASE}/user`, data)
  if (!response.success) {
    throw new Error(response.error || '创建用户失败')
  }
  return response.data
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const response = await axios.put<{ success: boolean; data: User; error?: string }>(`${API_BASE}/user/${id}`, data)
  if (!response.success) {
    throw new Error(response.error || '更新用户失败')
  }
  return response.data
}

export async function deleteUser(id: string): Promise<void> {
  const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE}/user/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除用户失败')
  }
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const response = await axios.put<{ success: boolean; error?: string }>(`${API_BASE}/user/${id}/reset-password`, {
    newPassword
  })
  if (!response.success) {
    throw new Error(response.error || '重置密码失败')
  }
}

// ==================== 部门管理 ====================

export interface Dept {
  id: string
  dept_name: string
  parent_id: string
  order_num: number
  leader?: string
  phone?: string
  email?: string
  status: string
  children?: Dept[]
}

export interface DeptListParams {
  keyword?: string
  status?: string
}

export async function getDeptTree(params: DeptListParams = {}): Promise<Dept[]> {
  const response = await axios.get<{ success: boolean; data: Dept[]; error?: string }>(`${API_BASE}/dept/tree`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取部门树失败')
  }
  return response.data
}

export async function getDeptList(params: DeptListParams = {}): Promise<Dept[]> {
  const response = await axios.get<{ success: boolean; data: Dept[]; error?: string }>(`${API_BASE}/dept`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取部门列表失败')
  }
  return response.data
}

export async function getDeptById(id: string): Promise<Dept> {
  const response = await axios.get<{ success: boolean; data: Dept; error?: string }>(`${API_BASE}/dept/${id}`)
  if (!response.success) {
    throw new Error(response.error || '获取部门详情失败')
  }
  return response.data
}

export async function createDept(data: Partial<Dept>): Promise<Dept> {
  const response = await axios.post<{ success: boolean; data: Dept; error?: string }>(`${API_BASE}/dept`, data)
  if (!response.success) {
    throw new Error(response.error || '创建部门失败')
  }
  return response.data
}

export async function updateDept(id: string, data: Partial<Dept>): Promise<Dept> {
  const response = await axios.put<{ success: boolean; data: Dept; error?: string }>(`${API_BASE}/dept/${id}`, data)
  if (!response.success) {
    throw new Error(response.error || '更新部门失败')
  }
  return response.data
}

export async function deleteDept(id: string): Promise<void> {
  const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE}/dept/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除部门失败')
  }
}

