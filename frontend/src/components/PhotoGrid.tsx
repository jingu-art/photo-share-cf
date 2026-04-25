import { useCallback, useEffect, useRef, useState } from "react";
import { deletePhoto, getPhotos } from "../api";
import { useUpload } from "../hooks/useUpload";
import type { Photo } from "../types";
import { downloadAsZip } from "../utils/zip";
import Lightbox from "./Lightbox";

interface Props {
  folderId: string;
  folderName: string;
  onBack?: () => void;
  onDeleteFolder?: () => Promise<void>;
}

export default function PhotoGrid({ folderId, folderName, onBack, onDeleteFolder }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // 複数選択削除
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // 追加アップロード
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress: uploadProgress, error: uploadError, clearError } = useUpload();
  const [uploadToast, setUploadToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getPhotos(folderId);
      setPhotos(data);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  // 追加アップロード：ファイル選択→即アップロード
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    if (files.length === 0) return;
    clearError();

    const ok = await upload(folderId, files);
    if (ok) {
      setUploadToast(`✅ ${files.length}枚アップロード完了`);
      setTimeout(() => setUploadToast(""), 2000);
      await load(); // 即反映
    }
  };

  // 個別削除
  const handleDeleteOne = async (key: string) => {
    if (!confirm("この写真を削除しますか？")) return;
    try {
      await deletePhoto(key);
      setPhotos((prev) => prev.filter((p) => p.key !== key));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // 複数選択の切り替え
  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`${selectedKeys.size}枚の写真を削除しますか？`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedKeys].map((key) => deletePhoto(key)));
      setPhotos((prev) => prev.filter((p) => !selectedKeys.has(p.key)));
      setSelectedKeys(new Set());
      setSelectMode(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // フォルダ削除
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

  // ZIPダウンロード
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

  return (
    <div className="photo-grid-wrap">
      {onBack && (
        <button className="back-btn" onClick={onBack}>← フォルダ一覧</button>
      )}

      {/* ヘッダー */}
      <div className="photo-grid-header">
        <h2>{folderName}</h2>

        {/* 追加アップロードボタン */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? `${uploadProgress.current}/${uploadProgress.total}枚…` : "＋ 追加"}
        </button>

        {/* 選択モード切り替え */}
        {photos.length > 0 && !selectMode && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectMode(true)}>
            ☑ 選択
          </button>
        )}
        {selectMode && (
          <>
            {selectedKeys.size > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                🗑 {selectedKeys.size}枚削除
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSelectMode(false); setSelectedKeys(new Set()); }}
            >
              キャンセル
            </button>
          </>
        )}

        {/* ZIP / フォルダ削除（選択モード外） */}
        {!selectMode && photos.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleZipDownload}
            disabled={!!zipProgress}
          >
            {zipProgress ? `${zipProgress.current}/${zipProgress.total}枚…` : "⬇ ZIP"}
          </button>
        )}
        {onDeleteFolder && !selectMode && (
          <button className="btn btn-danger btn-sm" onClick={handleDeleteFolder} disabled={deleting}>
            🗑 フォルダ
          </button>
        )}
      </div>

      {/* アップロード進捗バー */}
      {uploading && (
        <div className="progress-bar-wrap" style={{ marginBottom: 8 }}>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
          <div className="progress-label">{uploadProgress.current} / {uploadProgress.total} 枚完了</div>
        </div>
      )}

      {(uploadError || loadError) && (
        <div className="error-msg" style={{ marginBottom: 8 }}>
          {uploadError || loadError}
        </div>
      )}

      {/* 写真グリッド */}
      {loading ? (
        <div className="photo-empty">読み込み中…</div>
      ) : photos.length === 0 ? (
        <div className="photo-empty">
          写真がありません<br />
          <span style={{ fontSize: ".85rem", marginTop: 8, display: "block" }}>
            「＋ 追加」ボタンから写真をアップロードできます
          </span>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo, i) => {
            const isSelected = selectedKeys.has(photo.key);
            return (
              <div
                key={photo.key}
                className={`photo-thumb${selectMode && isSelected ? " photo-selected" : ""}`}
                onClick={() => {
                  if (selectMode) {
                    toggleSelect(photo.key);
                  } else {
                    setLightboxIndex(i);
                  }
                }}
              >
                <img
                  src={photo.thumbUrl}
                  alt={photo.name}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = photo.url; }}
                />
                {/* 選択モード：チェックマーク */}
                {selectMode && (
                  <div className={`photo-check-badge${isSelected ? " checked" : ""}`}>
                    {isSelected ? "✓" : ""}
                  </div>
                )}
                {/* 通常モード：個別削除ボタン */}
                {!selectMode && (
                  <button
                    className="photo-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDeleteOne(photo.key); }}
                    aria-label="削除"
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ライトボックス（選択モード外） */}
      {!selectMode && lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* アップロード完了トースト */}
      {uploadToast && <div className="toast success">{uploadToast}</div>}
    </div>
  );
}
