import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { api, AuthResponse } from "@/lib/api"

interface AuthContextType {
  user: AuthResponse["user"] | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    const refreshToken = localStorage.getItem("refreshToken")
    
    if (token && refreshToken) {
      api.getMe(token)
        .then(userData => {
          setUser(userData)
          setAccessToken(token)
        })
        .catch(() => {
          api.refresh(refreshToken)
            .then(data => {
              setUser(data.user)
              setAccessToken(data.accessToken)
              localStorage.setItem("accessToken", data.accessToken)
              localStorage.setItem("refreshToken", data.refreshToken)
            })
            .catch(() => {
              localStorage.removeItem("accessToken")
              localStorage.removeItem("refreshToken")
            })
            .finally(() => setIsLoading(false))
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
