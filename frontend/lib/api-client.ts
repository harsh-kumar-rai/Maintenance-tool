export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ??
  "http://localhost:4000"

export function backendUrl(path: string) {
  return `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(backendUrl(path), init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Backend request failed (${res.status})`)
  }
  return (await res.json()) as T
}
