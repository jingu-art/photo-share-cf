import { useState } from "react";

interface Props {
  currentName: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

export default function FolderRenameModal({ currentName, onSave, onClose }: Props) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("フォルダ名を入力してください"); return; }
    if (trimmed === currentName) { onClose(); return; }
    setLoading(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>フォルダ名を変更</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
          maxLength={50}
        />
        {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
