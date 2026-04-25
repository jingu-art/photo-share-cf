import { useCallback, useEffect, useState } from "react";
import { deletePhoto, getPhotos } from "../api";
import type { Photo } from "../types";
import { downloadAsZip } from "../utils/zip";
import Lightbox from "./Lightbox";

interface Props {
  folderId: string;
  folderName: string;
  onBack?: () => void;
  onFolderDeleted?: () => void;
  onDeleteFolder?: () => Promise<void>;
}

export default function PhotoGrid({ folderId, folderName, onBack, onDeleteFolder }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPhotos(folderId);
      setPhotos(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  const handleDeletePhoto = async (key: string) => {
    if (!confirm("この写真を削除しますか？")) return;
    try {
      await deletePhoto(key);
      setPhotos((prev) => prev.filter((p) => p.key !== key));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleZipDownload = async () => {
    if (photos.length === 0) return;
    setZipProgress({ current: 0, total: photos.length });
    try {
      await downloadAsZip(
        folderName,
        photos.map((p) => ({ name: p.name, url: p.url })),
        (current, total) => setZipProgress({ current, total })
      );
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setZipProgress(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!onDeleteFolder) return;
    if (!confirm(`フォルダ「${folderName}」と全写真を削除しますか？`)) return;
    setDeleting(true);
    try {
      await onDeleteFolder();
    } catch (e) {
      alert((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="photo-grid-wrap">
      {onBack && (
        <button className="back-btn" onClick={onBack}>
          ← フォルダ一覧
        </button>
      )}
      <div className="photo-grid-header">
        <h2>{folderName}</h2>
        {photos.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleZipDownload}
            disabled={!!zipProgress}
          >
            {zipProgress
              ? `${zipProgress.current}/${zipProgress.total}枚取得中…`
              : "⬇ ZIP"}
          </button>
        )}
        {onDeleteFolder && (
          <button className="btn btn-danger btn-sm" onClick={handleDeleteFolder} disabled={deleting}>
            🗑 削除
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="photo-empty">読み込み中…</div>
      ) : photos.length === 0 ? (
        <div className="photo-empty">写真がありません</div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo, i) => (
            <div
              key={photo.key}
              className="photo-thumb"
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={photo.thumbUrl}
                alt={photo.name}
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = photo.url; }}
              />
              <button
                className="photo-delete-btn"
                onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.key); }}
                aria-label="削除"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
