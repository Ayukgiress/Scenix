const API_URL = "http://localhost:3000"

function getAuthHeaders(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` })
  }
}

// Types
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name?: string
    profileImageUrl?: string
  }
}

export interface RegisterData {
  email: string
  password: string
  name: string
}

export interface LoginData {
  email: string
  password: string
}

export interface Project {
  id: string
  title: string
  status: string
  settings?: any
  createdAt: string
  updatedAt: string
}

export interface Media {
  id: string
  filename: string
  type: string
  size: number
  duration?: number
  url: string
  projectId?: string
  createdAt: string
}

export interface Export {
  id: string
  projectId: string
  status: string
  format: string
  quality: string
  progress?: number
  outputUrl?: string
  createdAt: string
}

export interface Clip {
  id: string
  projectId: string
  mediaId: string
  trackIndex: number
  startTime: number
  endTime: number
  trimStart: number
  trimEnd: number
  position: number
}

export const api = {
  // Auth endpoints
  async register(data: RegisterData): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ email }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ token, password }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async logout(refreshToken: string): Promise<void> {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refreshToken }),
    })
  },

  async getMe(accessToken: string) {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: getAuthHeaders(accessToken),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  // Projects endpoints
  async createProject(token: string, data: { title: string; settings?: any }): Promise<Project> {
    const res = await fetch(`${API_URL}/projects`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async getProjects(token: string, params?: { status?: string; search?: string; sort?: 'asc' | 'desc'; limit?: number; offset?: number }): Promise<Project[]> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.search) query.set('search', params.search)
    if (params?.sort) query.set('sort', params.sort)
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    
    const res = await fetch(`${API_URL}/projects?${query}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Failed to fetch projects: ${res.status} ${errorText}`)
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async getProject(token: string, id: string): Promise<Project> {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async updateProject(token: string, id: string, data: { title?: string; settings?: any }): Promise<Project> {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async deleteProject(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
  },

  // Media endpoints
  async createMedia(token: string, data: { filename: string; type: string; size: number; url: string; projectId?: string; duration?: number }): Promise<Media> {
    const res = await fetch(`${API_URL}/media`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async getMedia(token: string, params?: { type?: string; projectId?: string; search?: string; limit?: number; offset?: number }): Promise<Media[]> {
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.projectId) query.set('projectId', params.projectId)
    if (params?.search) query.set('search', params.search)
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    
    const res = await fetch(`${API_URL}/media?${query}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Failed to fetch media: ${res.status} ${errorText}`)
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async getMediaItem(token: string, id: string): Promise<Media> {
    const res = await fetch(`${API_URL}/media/${id}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async deleteMedia(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/media/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
  },

  // Export endpoints
  async createExport(token: string, data: { projectId: string; format: string; quality: string; settings?: any }): Promise<Export> {
    const res = await fetch(`${API_URL}/export`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async getExports(token: string, params?: { projectId?: string; status?: string; limit?: number; offset?: number }): Promise<Export[]> {
    const query = new URLSearchParams()
    if (params?.projectId) query.set('projectId', params.projectId)
    if (params?.status) query.set('status', params.status)
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    
    const res = await fetch(`${API_URL}/export?${query}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Failed to fetch exports: ${res.status} ${errorText}`)
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async getExport(token: string, id: string): Promise<Export> {
    const res = await fetch(`${API_URL}/export/${id}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async cancelExport(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/export/${id}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
  },

  // Clips endpoints
  async createClip(token: string, projectId: string, data: { mediaId: string; trackIndex: number; startTime: number; endTime: number; trimStart: number; trimEnd: number; position: number }): Promise<Clip> {
    const res = await fetch(`${API_URL}/projects/${projectId}/clips`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async getClips(token: string, projectId: string): Promise<Clip[]> {
    const res = await fetch(`${API_URL}/projects/${projectId}/clips`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async updateClip(token: string, projectId: string, clipId: string, data: Partial<Clip>): Promise<Clip> {
    const res = await fetch(`${API_URL}/projects/${projectId}/clips/${clipId}`, {
      method: "PATCH",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async deleteClip(token: string, projectId: string, clipId: string): Promise<void> {
    const res = await fetch(`${API_URL}/projects/${projectId}/clips/${clipId}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
  },

  async getProjectActivity(token: string, projectId: string, params?: { limit?: number; offset?: number }): Promise<any[]> {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    
    const res = await fetch(`${API_URL}/projects/${projectId}/activity?${query}`, {
      headers: getAuthHeaders(token),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  googleAuthUrl: `${API_URL}/auth/google`,
}
