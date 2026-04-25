import { useRef, useState } from "react";
import { createFolder } from "../api";
import { useUpload } from "../hooks/useUpload";
import type { Folder } from "../types";
import WorkGuide from "./WorkGuide";

interface Props {
  folders: Folder[];
  onFolderCreated: (folder: Folder) => void;
  onBack?: () => void;
}

export default function UploadPage({ folders, onFolderCreated }: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [toast, setToast] = useState("");
  const [folderError, setFolderError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress, error: uploadError, clearError } = useUpload();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  // フォルダを確定して ID を返す（なければ作成）
  const resolveFolder = async (): Promise<string | null> => {
    if (createMode) {
      const name = newFolderName.trim();
      if (!name) {
        setFolderError("フォルダ名を入力してください");
        return null;
      }
      try {
        const folder = await createFolder(name);
        onFolderCreated(folder);
        setCreateMode(false);
        setNewFolderName("");
        setSelectedFolderId(folder.id);
        return folder.id;
      } catch (e) {
        setFolderError((e as Error).message);
        return null;
      }
    }
    if (!selectedFolderId) {
      setFolderError("フォルダを選択してください");
      return null;
    }
    return selectedFolderId;
  };

  // ファイル選択→即アップロード
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    if (files.length === 0) return;
    clearError();
    setFolderError("");

    const folderId = await resolveFolder();
    if (!folderId) return;

    const ok = await upload(folderId, files);
    if (ok) {
      showToast(`✅ ${files.length}枚アップロード完了`);
    }
  };

  // ドロップも即アップロード
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    clearError();
    setFolderError("");

    const folderId = await resolveFolder();
    if (!folderId) return;

    await upload(folderId, files);
    if (!uploadError) showToast(`✅ ${files.length}枚アップロード完了`);
  };

  return (
    <div className="upload-wrap">
      {/* フォルダ選択 */}
      <div className="upload-section">
        <h3>📁 フォルダ選択</h3>
        <div className="field-group">
          {!createMode ? (
            <div className="field-row">
              <select
                value={selectedFolderId}
                onChange={(e) => { setSelectedFolderId(e.target.value); setFolderError(""); }}
                disabled={uploading}
              >
                <option value="">-- フォルダを選択 --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}（{f.fileCount}枚）</option>
                ))}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => { setCreateMode(true); setSelectedFolderId(""); setFolderError(""); }}
                disabled={uploading}
              >
                ＋ 新規
              </button>
            </div>
          ) : (
            <div className="field-row">
              <input
                type="text"
                placeholder="新しいフォルダ名"
                value={newFolderName}
                onChange={(e) => { setNewFolderName(e.target.value); setFolderError(""); }}
                onKeyDown={(e) => e.key === "Escape" && setCreateMode(false)}
                autoFocus
                maxLength={50}
                disabled={uploading}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setCreateMode(false); setNewFolderName(""); setFolderError(""); }}
                disabled={uploading}
              >
                ✕
              </button>
            </div>
          )}
          {folderError && <div className="error-msg">{folderError}</div>}
        </div>
      </div>

      {/* 写真選択（選択したらそのままアップロード） */}
      <div className="upload-section">
        <h3>📸 写真を選択してアップロード</h3>

        <div
          className={`file-drop-zone${dragging ? " drag-over" : ""}${uploading ? " uploading" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <div>
              <div style={{ fontSize: "1.5rem" }}>⬆️</div>
              <div style={{ marginTop: 4 }}>アップロード中…</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "1.5rem" }}>📷</div>
              <div style={{ fontWeight: 600 }}>タップして写真を選択</div>
              <div style={{ fontSize: ".8rem", marginTop: 4, color: "var(--text-muted)" }}>
                選択するとすぐにアップロード開始
              </div>
            </div>
          )}
        </div>

        {/* 進捗バー */}
        {uploading && (
          <div className="progress-bar-wrap">
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <div className="progress-label">{progress.current} / {progress.total} 枚完了</div>
          </div>
        )}

        {uploadError && <div className="error-msg" style={{ marginTop: 8 }}>{uploadError}</div>}
      </div>

      <WorkGuide />

      {toast && <div className="toast success">{toast}</div>}
    </div>
  );
}
