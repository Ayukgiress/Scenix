import { createContext } from "react"
import { AuthResponse } from "@/lib/api"

export interface AuthContextType {
  user: AuthResponse["user"] | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
