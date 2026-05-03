import { useState } from "react";
import { createFolder, deleteFolder, renameFolder } from "../api";
import type { Folder } from "../types";
import FolderRenameModal from "./FolderRenameModal";

interface Props {
  folders: Folder[];
  selectedId: string | null;
  shareIds: string[] | null;
  onSelect: (id: string) => void;
  onFolderCreated: (folder: Folder) => void;
  onFolderDeleted: (id: string) => void;
  onFolderRenamed: (folder: Folder) => void;
  onShareChange: (ids: string[] | null) => void;
  onDeleteModeChange?: (active: boolean) => void;
}

export default function FolderList({
  folders,
  selectedId,
  shareIds,
  onSelect,
  onFolderCreated,
  onFolderDeleted,
  onFolderRenamed,
  onShareChange,
  onDeleteModeChange,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSelected, setDeleteSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });

  const displayed = shareIds
    ? folders.filter((f) => shareIds.includes(f.id))
    : folders;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreateError("フォルダ名を入力してください"); return; }
    setCreating(true);
    try {
      const folder = await createFolder(name);
      onFolderCreated(folder);
      setNewName("");
      setShowCreate(false);
      setCreateError("");
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("空フォルダを削除しますか？")) return;
    await deleteFolder(id);
    onFolderDeleted(id);
  };

  const handleRename = async (folder: Folder, name: string) => {
    const updated = await renameFolder(folder.id, name);
    onFolderRenamed(updated);
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCopyShareUrl = async () => {
    if (checked.size === 0) return;
    const url = `${window.location.origin}${window.location.pathname}?share=${[...checked].join(",")}`;
    await navigator.clipboard.writeText(url);
    setCopyMsg("コピーしました！");
    setTimeout(() => setCopyMsg(""), 2000);
  };

  const enterDeleteMode = () => {
    setDeleteMode(true);
    setDeleteSelected(new Set());
    setShowCreate(false);
    onDeleteModeChange?.(true);
  };

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setDeleteSelected(new Set());
    onDeleteModeChange?.(false);
  };

  const toggleDeleteSelect = (id: string) => {
    setDeleteSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setDeleteSelected(new Set(displayed.map((f) => f.id)));
  };

  const handleBulkDelete = async () => {
    if (deleteSelected.size === 0) return;
    const ids = [...deleteSelected];
    const count = ids.length;
    if (!confirm(`${count}件のアルバムをすべて削除しますか？この操作は取り消せません。`)) return;

    setBulkDeleting(true);
    setDeleteProgress({ done: 0, total: count });

    for (let i = 0; i < ids.length; i++) {
      try {
        await deleteFolder(ids[i]);
        onFolderDeleted(ids[i]);
      } catch {
        // ignore individual errors, continue deleting
      }
      setDeleteProgress({ done: i + 1, total: count });
    }

    setBulkDeleting(false);
    exitDeleteMode();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="list-header">
        <h2>フォルダ一覧</h2>
        {!shareIds && !deleteMode && (
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={enterDeleteMode}
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              削除モード
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
              ＋ 作成
            </button>
          </>
        )}
        {!shareIds && deleteMode && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={selectAll} disabled={bulkDeleting}>
              全選択
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exitDeleteMode} disabled={bulkDeleting}>
              キャンセル
            </button>
          </>
        )}
      </div>

      {shareIds && (
        <div className="share-bar">
          <span>共有フォルダ表示中</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onShareChange(null)}>
            すべて表示に戻る
          </button>
        </div>
      )}

      {!deleteMode && showCreate && (
        <div style={{ padding: "0 12px 8px" }}>
          <div className="field-row">
            <input
              type="text"
              placeholder="フォルダ名"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
              maxLength={50}
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
              {creating ? "…" : "作成"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreate(false); setCreateError(""); }}>
              ✕
            </button>
          </div>
          {createError && <div className="error-msg" style={{ marginTop: 6 }}>{createError}</div>}
        </div>
      )}

      {!deleteMode && checked.size > 0 && (
        <div style={{ padding: "0 12px 8px", display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleCopyShareUrl} style={{ flex: 1 }}>
            🔗 URLをコピー（{checked.size}件）
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set())}>✕</button>
          {copyMsg && <span style={{ color: "var(--success)", fontSize: ".85rem", alignSelf: "center" }}>{copyMsg}</span>}
        </div>
      )}

      <div className="folder-list" style={deleteMode && deleteSelected.size > 0 ? { paddingBottom: 72 } : undefined}>
        {displayed.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0", fontSize: ".9rem" }}>
            フォルダがありません
          </div>
        )}
        {displayed.map((folder) => (
          <div
            key={folder.id}
            className={`folder-card${!deleteMode && selectedId === folder.id ? " selected" : ""}${deleteMode && deleteSelected.has(folder.id) ? " delete-selected" : ""}`}
            onClick={() => {
              if (deleteMode) toggleDeleteSelect(folder.id);
              else onSelect(folder.id);
            }}
          >
            {deleteMode && (
              <input
                type="checkbox"
                checked={deleteSelected.has(folder.id)}
                onChange={() => toggleDeleteSelect(folder.id)}
                onClick={(e) => e.stopPropagation()}
                disabled={bulkDeleting}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--danger)", flexShrink: 0 }}
              />
            )}
            {!deleteMode && !shareIds && (
              <input
                type="checkbox"
                checked={checked.has(folder.id)}
                onChange={() => toggleCheck(folder.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--primary)", flexShrink: 0 }}
              />
            )}
            <div className="folder-card-info">
              <div className="folder-card-name">📁 {folder.name}</div>
              <div className="folder-card-meta">
                {folder.fileCount}枚 ・ {formatDate(folder.createdAt)}
              </div>
            </div>
            {!deleteMode && (
              <div className="folder-card-actions">
                <button
                  className="icon-btn"
                  title="名前を変更"
                  onClick={(e) => { e.stopPropagation(); setRenameTarget(folder); }}
                >
                  ✏️
                </button>
                {folder.fileCount === 0 && (
                  <button
                    className="icon-btn danger"
                    title="削除"
                    onClick={(e) => handleDelete(e, folder.id)}
                  >
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteMode && deleteSelected.size > 0 && (
        <div className="bulk-delete-bar">
          {bulkDeleting ? (
            <span className="bulk-delete-progress">
              {deleteProgress.done}/{deleteProgress.total}件削除中...
            </span>
          ) : (
            <button className="btn btn-danger" onClick={handleBulkDelete} style={{ width: "100%" }}>
              🗑 {deleteSelected.size}件を削除
            </button>
          )}
        </div>
      )}

      {renameTarget && (
        <FolderRenameModal
          currentName={renameTarget.name}
          onSave={(name) => handleRename(renameTarget, name)}
          onClose={() => setRenameTarget(null)}
        />
      )}
    </>
  );
}
