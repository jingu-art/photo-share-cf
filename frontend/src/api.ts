import type { Folder, Photo, UploadItem } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const getFolders = (): Promise<Folder[]> => req("/api/folders");

export const getFolder = (id: string): Promise<Folder> => req(`/api/folders/${id}`);

export const createFolder = (name: string): Promise<Folder> =>
  req("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const renameFolder = (id: string, name: string): Promise<Folder> =>
  req(`/api/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteFolder = (id: string): Promise<void> =>
  req(`/api/folders/${id}`, { method: "DELETE" });

export const getPhotos = (folderId: string): Promise<Photo[]> =>
  req(`/api/folders/${folderId}/photos`);

export const deletePhoto = (key: string): Promise<void> =>
  req(`/api/photos?key=${encodeURIComponent(key)}`, { method: "DELETE" });

export const prepareUpload = (
  folderId: string,
  filenames: string[]
): Promise<{ items: UploadItem[]; newFileCount: number }> =>
  req("/api/upload-prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId, filenames }),
  });
