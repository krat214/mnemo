import type { Episode, Memory, Trait } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  scopes: () => request<string[]>("/api/scopes"),

  memories: (scope?: string) => request<Memory[]>(`/api/memories${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`),
  updateMemory: (id: string, patch: { gist?: string; details?: string }) =>
    request<Memory>(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }),
  deleteMemory: (id: string) => request<{ deleted: number }>(`/api/memories/${id}`, { method: "DELETE" }),

  episodes: (scope?: string) => request<Episode[]>(`/api/episodes${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`),
  capture: (scope: string, content: string) =>
    request<{ episode: Episode; deduped: boolean }>("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, content })
    }),
  consolidate: (scope: string) =>
    request<Memory | null>("/api/consolidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope })
    }),

  traits: (scope?: string) => request<Trait[]>(`/api/traits${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`),
  crystallize: (scope: string, name: string, value: string, evidence?: string) =>
    request<Trait>("/api/crystallize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, name, value, evidence })
    }),
  deleteTrait: (id: string) => request<{ deleted: number }>(`/api/traits/${id}`, { method: "DELETE" }),

  recall: (query: string, scope?: string) =>
    request<{ memories: Memory[]; traits: Trait[] }>(
      `/api/recall?q=${encodeURIComponent(query)}${scope ? `&scope=${encodeURIComponent(scope)}` : ""}`
    )
};
