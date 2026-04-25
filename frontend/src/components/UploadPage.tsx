import { useRef, useState } from "react";
import { createFolder, prepareUpload } from "../api";
import type { Folder } from "../types";
import { compressImage, generateThumbnail, validateFileSize } from "../utils/compress";
import WorkGuide from "./WorkGuide";

interface Props {
  folders: Folder[];
  onFolderCreated: (folder: Folder) => void;
  onBack?: () => void;
}

const PARALLEL = 5;

export default function UploadPage({ folders, onFolderCreated }: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles(dropped);
    setError("");
  };

  const handleUpload = async () => {
    setError("");

    // フォルダ確定
    let folderId = selectedFolderId;
    if (createMode) {
      const name = newFolderName.trim();
      if (!name) { setError("フォルダ名を入力してください"); return; }
      try {
        const folder = await createFolder(name);
        onFolderCreated(folder);
        folderId = folder.id;
        setCreateMode(false);
        setNewFolderName("");
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    if (!folderId) { setError("フォルダを選択してください"); return; }
    if (files.length === 0) { setError("写真を選択してください"); return; }

    // ファイルサイズ検証（20MB以下）
    for (const f of files) {
      const msg = validateFileSize(f);
      if (msg) { setError(msg); return; }
    }

    setUploading(true);
    setProgress({ current: 0, total: files.length });

    try {
      // サーバーからPresigned URL取得（使用量チェックも含む）
      const { items } = await prepareUpload(
        folderId,
        files.map((f) => f.name)
      );

      let done = 0;

      // 5枚並列アップロード
      const uploadOne = async (i: number) => {
        const file = files[i];
        const item = items[i];

        // 圧縮 + サムネイル生成（クライアントサイド）
        const compressed = await compressImage(file);
        const thumb = await generateThumbnail(compressed);

        // R2へ直接アップロード
        await Promise.all([
          fetch(item.uploadUrl, {
            method: "PUT",
            body: compressed,
            headers: { "Content-Type": "image/jpeg" },
          }),
          fetch(item.thumbUploadUrl, {
            method: "PUT",
            body: thumb,
            headers: { "Content-Type": "image/jpeg" },
          }),
        ]);

        done++;
        setProgress({ current: done, total: files.length });
      };

      for (let i = 0; i < files.length; i += PARALLEL) {
        const batch = Array.from({ length: Math.min(PARALLEL, files.length - i) }, (_, j) => i + j);
        await Promise.all(batch.map(uploadOne));
      }

      showToast(`✅ ${files.length}枚アップロード完了`);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // フォルダ選択は維持（selectedFolderIdはそのまま）
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-wrap">
      <div className="upload-section">
        <h3>📁 フォルダ選択</h3>
        <div className="field-group">
          {!createMode ? (
            <div className="field-row">
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
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
                onClick={() => { setCreateMode(true); setSelectedFolderId(""); }}
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
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setCreateMode(false)}
                autoFocus
                maxLength={50}
                disabled={uploading}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setCreateMode(false); setNewFolderName(""); }}
                disabled={uploading}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="upload-section">
        <h3>📸 写真を選択</h3>
        <div
          className={`file-drop-zone${dragging ? " drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />
          {files.length > 0 ? (
            <div>
              <div style={{ fontSize: "1.5rem" }}>🖼</div>
              <div className="file-count">{files.length}枚選択済み</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "1.5rem" }}>📷</div>
              <div>タップして写真を選択</div>
              <div style={{ fontSize: ".8rem", marginTop: 4 }}>（またはドロップ）</div>
            </div>
          )}
        </div>

        {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}

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

        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
          >
            {uploading ? `アップロード中… ${progress.current}/${progress.total}` : "アップロード開始"}
          </button>
        </div>
      </div>

      <WorkGuide />

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
