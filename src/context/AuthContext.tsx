import { useState, useEffect, ReactNode } from "react"
import { api, AuthResponse } from "@/lib/api"
import { AuthContext } from "@/context/authContextType"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("accessToken")
      const refreshToken = localStorage.getItem("refreshToken")
      
      if (token && refreshToken) {
        try {
          const userData = await api.getMe(token)
          setUser(userData)
          setAccessToken(token)
        } catch {
          try {
            const data = await api.refresh(refreshToken)
            setUser(data.user)
            setAccessToken(data.accessToken)
            localStorage.setItem("accessToken", data.accessToken)
            localStorage.setItem("refreshToken", data.refreshToken)
          } catch {
            localStorage.removeItem("accessToken")
            localStorage.removeItem("refreshToken")
          }
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password })
    setUser(data.user)
    setAccessToken(data.accessToken)
    localStorage.setItem("accessToken", data.accessToken)
    localStorage.setItem("refreshToken", data.refreshToken)
  }

  const register = async (name: string, email: string, password: string) => {
    return await api.register({ name, email, password })
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem("refreshToken")
    if (refreshToken) {
      await api.logout(refreshToken)
    }
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
  }

  const refreshAuth = async () => {
    const refreshToken = localStorage.getItem("refreshToken")
    if (!refreshToken) throw new Error("No refresh token")
    const data = await api.refresh(refreshToken)
    setUser(data.user)
    setAccessToken(data.accessToken)
    localStorage.setItem("accessToken", data.accessToken)
    localStorage.setItem("refreshToken", data.refreshToken)
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
