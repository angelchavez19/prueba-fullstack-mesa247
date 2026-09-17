export type QueueStatus = 'reserved' | 'called' | 'seated' | 'cancelled' | 'no-show'

export type UserRole = 'host' | 'admin' | 'manager'

export interface Branch {
  id: number
  name: string
  street: string
  exterior_number: string
  interior_number?: string | null
  neighborhood: string
  city: string
  state: string
  country: string
  postal_code?: string | null
  full_address: string
  created_at: string
  updated_at: string
}

export interface QueueEntry {
  id: number
  branch_id: number
  customer_name: string
  phone_number: string
  party_size: number
  check_in_time: string
  status: QueueStatus
  called_at?: string | null
  was_called: boolean
  seated_at?: string | null
  cancelled_at?: string | null
  no_show_at?: string | null
  wait_time_seconds?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface QueuePositionInfo {
  entry_id: number
  branch_id: number
  customer_name: string
  party_size: number
  status: QueueStatus
  order_number: number | null
  people_ahead: number
  called_at?: string | null
  average_wait_minutes?: number | null
  estimated_wait_minutes?: number | null
  message: string
}

export type MetricTimeframe = 'day' | 'week' | 'month' | 'year' | 'all'

export interface QueueMetrics {
  branch_id: number
  timeframe: MetricTimeframe
  from_date?: string | null
  joined: number
  seated: number
  left_without_sitting: number
  did_not_come_when_called: number
  average_wait_minutes?: number | null
  average_wait_seconds?: number | null
  total_entries: number
  currently_reserved: number
  currently_called: number
  total_seated: number
  total_cancelled: number
  total_no_show: number
  avg_wait_time_seated_seconds?: number | null
  avg_wait_time_seated_minutes?: number | null
  cancellation_rate_percent: number
  no_show_rate_percent: number
  seated_rate_percent: number
}

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  branch_id: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in_seconds: number
}
