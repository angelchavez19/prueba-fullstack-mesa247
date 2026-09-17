import axios from 'axios'
import type {
  Branch,
  QueueEntry,
  QueuePositionInfo,
  QueueStatus,
  QueueMetrics,
  MetricTimeframe,
  User,
  UserRole,
  TokenResponse,
} from '../types'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for attaching auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('mesa247_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if it's diner unauthenticated request
      const isStaffEndpoint =
        error.config.url?.includes('/auth/me') ||
        error.config.url?.includes('/users') ||
        (error.config.url?.includes('/queue') && !error.config.url?.includes('/position') && !error.config.url?.includes('/check-in'))
      if (isStaffEndpoint && localStorage.getItem('mesa247_token')) {
        localStorage.removeItem('mesa247_token')
        localStorage.removeItem('mesa247_user')
      }
    }
    return Promise.reject(error)
  }
)

export const api = {
  // Authentication
  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await apiClient.post<TokenResponse>('/auth/login', { email, password })
    return res.data
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me')
    return res.data
  },

  // Branches
  async listBranches(): Promise<Branch[]> {
    const res = await apiClient.get<Branch[]>('/branches/')
    return res.data
  },

  async getBranch(branchId: number): Promise<Branch> {
    const res = await apiClient.get<Branch>(`/branches/${branchId}`)
    return res.data
  },

  // Queue - Comensales (Public)
  async checkInDiner(
    branchId: number,
    data: { customer_name: string; phone_number: string; party_size: number; notes?: string }
  ): Promise<QueueEntry> {
    const res = await apiClient.post<QueueEntry>(`/branches/${branchId}/queue/check-in`, data)
    return res.data
  },

  async getDinerPosition(branchId: number, entryId: number): Promise<QueuePositionInfo> {
    const res = await apiClient.get<QueuePositionInfo>(`/branches/${branchId}/queue/${entryId}/position`)
    return res.data
  },

  async cancelDinerReservation(branchId: number, entryId: number): Promise<QueueEntry> {
    const res = await apiClient.post<QueueEntry>(`/branches/${branchId}/queue/${entryId}/cancel`)
    return res.data
  },

  // Queue - Staff Operations
  async listQueueEntries(branchId: number, status?: QueueStatus): Promise<QueueEntry[]> {
    const params = status ? { queue_status: status } : {}
    const res = await apiClient.get<QueueEntry[]>(`/branches/${branchId}/queue/`, { params })
    return res.data
  },

  async updateQueueStatus(branchId: number, entryId: number, status: QueueStatus): Promise<QueueEntry> {
    const res = await apiClient.patch<QueueEntry>(`/branches/${branchId}/queue/${entryId}/status`, { status })
    return res.data
  },

  async getBranchMetrics(branchId: number, timeframe: MetricTimeframe = 'day'): Promise<QueueMetrics> {
    const res = await apiClient.get<QueueMetrics>(`/branches/${branchId}/queue/metrics`, {
      params: { timeframe },
    })
    return res.data
  },

  // Users (Admin)
  async listUsers(branchId?: number): Promise<User[]> {
    const params = branchId ? { branch_id: branchId } : {}
    const res = await apiClient.get<User[]>('/users/', { params })
    return res.data
  },

  async createUser(data: {
    name: string
    email: string
    password: string
    role: UserRole
    branch_id: number
  }): Promise<User> {
    const res = await apiClient.post<User>('/users/', data)
    return res.data
  },

  // SSE Stream URLs
  getDinerLiveStreamUrl(branchId: number, entryId: number): string {
    return `/api/v1/branches/${branchId}/queue/${entryId}/live`
  },

  getBranchQueueStreamUrl(branchId: number): string {
    return `/api/v1/branches/${branchId}/queue/stream`
  },
}

export default api
