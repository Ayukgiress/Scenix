// Vite exposes variables prefixed with VITE_ on `import.meta.env`.
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:3000";

function getAuthHeaders(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    profileImageUrl?: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Server representation of a Project.
 *
 * The backend stores extra fields (description, hue, editorState, status enum).
 * Only the ones used by the editor are required; the rest are optional.
 */
export interface Project {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  hue?: number | null;
  editorState?: Record<string, unknown> | null;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Frontend-friendly Media. The server stores `sourceUrl` and `fileSizeBytes`,
 * but the editor wants `url` and `size` in a known shape.
 */
export interface Media {
  id: string;
  filename: string;
  type: string;
  size: number;
  duration?: number;
  url: string;
  thumbnailUrl?: string | null;
  projectId?: string;
  createdAt: string;
}

export interface Export {
  id: string;
  projectId: string;
  status: string;
  format: string;
  quality: string;
  progress?: number;
  outputUrl?: string | null;
  createdAt: string;
}

/**
 * Server representation of a TimelineClip.
 *
 * Times are stored in milliseconds (startTimeMs, durationMs) and the
 * media is referenced by `mediaAssetId`. The frontend keeps a friendlier
 * representation (startTime, duration, trimStart, trimEnd, volume) and
 * translates to/from this shape via `clipToServer` / `clipFromServer`.
 */
export interface ServerClip {
  id: string;
  projectId: string;
  mediaAssetId: string | null;
  trackIndex: number;
  zIndex: number;
  startTimeMs: number;
  durationMs: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  rotation: number;
  opacity: number;
  transform: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CloudinarySignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadPreset?: string;
}

// ─── Media translation helpers ──────────────────────────────────────────────

/**
 * Normalise a server MediaAsset into the frontend Media shape:
 * - `sourceUrl` -> `url`
 * - `fileSizeBytes` (BigInt) -> `size` (number)
 * - duration is in ms -> seconds
 * - keep `type` and `thumbnailUrl` for completeness
 */
function normalizeMedia(raw: Record<string, unknown>): Media {
  const sourceUrl = (raw.sourceUrl ?? raw.url ?? "") as string;
  const sizeRaw = raw.fileSizeBytes ?? raw.size ?? 0;
  const size =
    typeof sizeRaw === "number"
      ? sizeRaw
      : typeof sizeRaw === "bigint"
        ? Number(sizeRaw)
        : Number(sizeRaw) || 0;
  const durationMs = (raw.durationMs ?? null) as number | null;
  const duration =
    typeof raw.duration === "number"
      ? (raw.duration as number)
      : durationMs != null
        ? durationMs / 1000
        : undefined;
  return {
    id: (raw.id as string) ?? "",
    filename: ((raw.filename ?? raw.name ?? "") as string) || "",
    type: ((raw.type as string) || "video").toLowerCase(),
    size,
    duration,
    url: sourceUrl,
    thumbnailUrl: (raw.thumbnailUrl as string | null) ?? null,
    projectId: (raw.projectId as string | undefined) ?? undefined,
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
  };
}

/**
 * Build a payload for POST /media that matches the backend DTO.
 */
export function mediaToServer(input: {
  filename: string;
  type: string;
  size: number;
  url: string;
  projectId?: string;
  duration?: number;
  thumbnailUrl?: string;
}): Record<string, unknown> {
  return {
    type: input.type.toUpperCase(),
    sourceUrl: input.url,
    filename: input.filename,
    fileSizeBytes: Math.max(0, Math.floor(input.size)),
    durationMs:
      input.duration != null ? Math.max(0, Math.round(input.duration * 1000)) : undefined,
    projectId: input.projectId,
    thumbnailUrl: input.thumbnailUrl,
  };
}

// ─── Clip translation helpers ────────────────────────────────────────────────

/**
 * Convert a frontend-friendly clip (seconds) into a server payload (ms).
 */
export function clipToServer(input: {
  mediaId?: string;
  track: number;
  startTime: number;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
}): {
  mediaAssetId: string | null;
  trackIndex: number;
  startTimeMs: number;
  durationMs: number;
} {
  return {
    mediaAssetId: input.mediaId ?? null,
    trackIndex: input.track,
    startTimeMs: Math.max(0, Math.round(input.startTime * 1000)),
    durationMs: Math.max(1, Math.round(input.duration * 1000)),
  };
}

/**
 * Convert a server clip (ms) into a frontend-friendly object (seconds).
 */
export function clipFromServer(server: ServerClip): {
  id: string;
  mediaId: string | null;
  track: number;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  opacity: number;
  rotation: number;
  zIndex: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
} {
  const startTime = (server.startTimeMs ?? 0) / 1000;
  const duration = (server.durationMs ?? 0) / 1000;
  return {
    id: server.id,
    mediaId: server.mediaAssetId ?? null,
    track: server.trackIndex ?? 0,
    startTime,
    duration,
    trimStart: 0,
    trimEnd: duration,
    opacity: server.opacity ?? 1,
    rotation: server.rotation ?? 0,
    zIndex: server.zIndex ?? 0,
    x: server.x ?? 0,
    y: server.y ?? 0,
    width: server.width ?? null,
    height: server.height ?? null,
  };
}

// ─── Paginated-response helper ──────────────────────────────────────────────

/**
 * Backend list endpoints return `{ <items>, total, limit, offset }`.
 * This picks the array out regardless of which key the items live under.
 */
function unwrapList<T>(data: unknown, itemKey: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[itemKey])) return obj[itemKey] as T[];
    // try common alternative keys
    for (const alt of ["projects", "assets", "jobs", "items", "data"]) {
      if (Array.isArray(obj[alt])) return obj[alt] as T[];
    }
  }
  return [];
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  // Auth endpoints
  async register(data: RegisterData): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    const res = await fetch(
      `${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
      },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async logout(refreshToken: string): Promise<void> {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refreshToken }),
    });
  },

  async getMe(accessToken: string) {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: getAuthHeaders(accessToken),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Projects endpoints
  async createProject(
    token: string,
    data: { title: string; settings?: Record<string, unknown> },
  ): Promise<Project> {
    const res = await fetch(`${API_URL}/projects`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getProjects(
    token: string,
    params?: {
      status?: string;
      search?: string;
      sort?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<Project[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());

    const res = await fetch(`${API_URL}/projects?${query}`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch projects: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    return unwrapList<Project>(data, "projects");
  },

  async getProject(token: string, id: string): Promise<Project> {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateProject(
    token: string,
    id: string,
    data: { title?: string; settings?: Record<string, unknown> },
  ): Promise<Project> {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteProject(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Media endpoints
  async createMedia(
    token: string,
    data: {
      filename: string;
      type: string;
      size: number;
      url: string;
      projectId?: string;
      duration?: number;
      thumbnailUrl?: string;
    },
  ): Promise<Media> {
    const payload = mediaToServer(data);
    const res = await fetch(`${API_URL}/media`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const raw = await res.json();
    return normalizeMedia(raw);
  },

  async createCloudinaryUpload(
    token: string,
    data: {
      folder?: string;
      type?: "IMAGE" | "VIDEO" | "AUDIO" | "OTHER";
      filename?: string;
    },
  ): Promise<CloudinarySignature> {
    const res = await fetch(`${API_URL}/media/uploads/cloudinary`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getMedia(
    token: string,
    params?: {
      type?: string;
      projectId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Media[]> {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.projectId) query.set("projectId", params.projectId);
    if (params?.search) query.set("search", params.search);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());

    const res = await fetch(`${API_URL}/media?${query}`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch media: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    return unwrapList<Media>(data, "assets").map((m) =>
      normalizeMedia(m as unknown as Record<string, unknown>),
    );
  },

  async getMediaItem(token: string, id: string): Promise<Media> {
    const res = await fetch(`${API_URL}/media/${id}`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return normalizeMedia(await res.json());
  },

  async getMediaUrl(token: string, id: string): Promise<{ url: string }> {
    const res = await fetch(`${API_URL}/media/${id}/url`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteMedia(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/media/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Export endpoints
  async createExport(
    token: string,
    data: {
      projectId: string;
      format: string;
      quality: string;
      settings?: Record<string, unknown>;
    },
  ): Promise<Export> {
    const res = await fetch(`${API_URL}/export`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getExports(
    token: string,
    params?: {
      projectId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Export[]> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set("projectId", params.projectId);
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());

    const res = await fetch(`${API_URL}/export?${query}`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch exports: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    return unwrapList<Export>(data, "jobs");
  },

  async getExport(token: string, id: string): Promise<Export> {
    const res = await fetch(`${API_URL}/export/${id}`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async cancelExport(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/export/${id}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Clips endpoints — translated to backend field names (ms, mediaAssetId)
  async createClip(
    token: string,
    projectId: string,
    data: {
      mediaId: string;
      track: number;
      startTime: number;
      duration: number;
      trimStart?: number;
      trimEnd?: number;
    },
  ): Promise<ServerClip> {
    const payload = clipToServer(data);
    const res = await fetch(`${API_URL}/projects/${projectId}/clips`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getClips(token: string, projectId: string): Promise<ServerClip[]> {
    const res = await fetch(`${API_URL}/projects/${projectId}/clips`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateClip(
    token: string,
    projectId: string,
    clipId: string,
    data: {
      mediaId?: string;
      track?: number;
      startTime?: number;
      duration?: number;
      trimStart?: number;
      trimEnd?: number;
    },
  ): Promise<ServerClip> {
    const payload: Record<string, unknown> = {};
    if (data.mediaId !== undefined) payload.mediaAssetId = data.mediaId;
    if (data.track !== undefined) payload.trackIndex = data.track;
    if (data.startTime !== undefined)
      payload.startTimeMs = Math.max(0, Math.round(data.startTime * 1000));
    if (data.duration !== undefined)
      payload.durationMs = Math.max(1, Math.round(data.duration * 1000));
    const res = await fetch(
      `${API_URL}/projects/${projectId}/clips/${clipId}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteClip(
    token: string,
    projectId: string,
    clipId: string,
  ): Promise<void> {
    const res = await fetch(
      `${API_URL}/projects/${projectId}/clips/${clipId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(token),
      },
    );
    if (!res.ok) throw new Error(await res.text());
  },

  async getProjectActivity(
    token: string,
    projectId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<Array<Record<string, unknown>>> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());

    const res = await fetch(
      `${API_URL}/projects/${projectId}/activity?${query}`,
      {
        headers: getAuthHeaders(token),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  googleAuthUrl: `${API_URL}/auth/google`,
};

// Cloudinary direct upload helper
export async function uploadToCloudinary(
  file: File,
  signature: CloudinarySignature,
  onProgress?: (percent: number) => void,
): Promise<{
  secure_url: string;
  public_id: string;
  resource_type: string;
  duration?: number;
  bytes: number;
}> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("signature", signature.signature);
    formData.append("folder", signature.folder);
    if (signature.uploadPreset)
      formData.append("upload_preset", signature.uploadPreset);

    const xhr = new XMLHttpRequest();
    const resourceType = file.type.startsWith("video")
      ? "video"
      : file.type.startsWith("audio")
        ? "audio"
        : "image";
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Network error during Cloudinary upload"));
    xhr.send(formData);
  });
}
