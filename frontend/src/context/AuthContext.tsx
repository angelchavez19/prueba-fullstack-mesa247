import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '../types'
import { api } from '../services/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('mesa247_user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mesa247_token'))
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const logout = () => {
    localStorage.removeItem('mesa247_token')
    localStorage.removeItem('mesa247_user')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const profile = await api.getMe()
      setUser(profile)
      localStorage.setItem('mesa247_user', JSON.stringify(profile))
    } catch {
      logout()
    }
  }

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password)
    localStorage.setItem('mesa247_token', data.access_token)
    setToken(data.access_token)
    const profile = await api.getMe()
    setUser(profile)
    localStorage.setItem('mesa247_user', JSON.stringify(profile))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
