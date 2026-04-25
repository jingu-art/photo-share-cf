import { useState } from "react";
import { prepareUpload } from "../api";
import { compressImage, generateThumbnail, validateFileSize } from "../utils/compress";

const PARALLEL = 5;

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");

  const upload = async (folderId: string, files: File[]): Promise<boolean> => {
    setError("");

    for (const f of files) {
      const msg = validateFileSize(f);
      if (msg) { setError(msg); return false; }
    }

    setUploading(true);
    setProgress({ current: 0, total: files.length });

    try {
      const { items } = await prepareUpload(folderId, files.map((f) => f.name));
      let done = 0;

      const uploadOne = async (i: number) => {
        const compressed = await compressImage(files[i]);
        const thumb = await generateThumbnail(compressed);
        const [r1, r2] = await Promise.all([
          fetch(items[i].uploadUrl, {
            method: "PUT",
            body: compressed,
            headers: { "Content-Type": "image/jpeg" },
          }),
          fetch(items[i].thumbUploadUrl, {
            method: "PUT",
            body: thumb,
            headers: { "Content-Type": "image/jpeg" },
          }),
        ]);
        if (!r1.ok || !r2.ok) throw new Error("R2へのアップロードに失敗しました");
        done++;
        setProgress({ current: done, total: files.length });
      };

      for (let i = 0; i < files.length; i += PARALLEL) {
        const batch = Array.from(
          { length: Math.min(PARALLEL, files.length - i) },
          (_, j) => i + j
        );
        await Promise.all(batch.map(uploadOne));
      }

      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress, error, clearError: () => setError("") };
}
