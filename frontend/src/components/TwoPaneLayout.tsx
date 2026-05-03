import type { Folder } from "../types";
import FolderList from "./FolderList";
import PhotoGrid from "./PhotoGrid";
import { deleteFolder } from "../api";

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

export default function TwoPaneLayout({
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
  const selectedFolder = folders.find((f) => f.id === selectedId);

  const handleDeleteFolder = async () => {
    if (!selectedId) return;
    await deleteFolder(selectedId);
    onFolderDeleted(selectedId);
  };

  return (
    <div className="two-pane">
      <div className="pane-left">
        <FolderList
          folders={folders}
          selectedId={selectedId}
          shareIds={shareIds}
          onSelect={onSelect}
          onFolderCreated={onFolderCreated}
          onFolderDeleted={onFolderDeleted}
          onFolderRenamed={onFolderRenamed}
          onShareChange={onShareChange}
          onDeleteModeChange={onDeleteModeChange}
        />
      </div>
      <div className="pane-right">
        {selectedFolder ? (
          <PhotoGrid
            folderId={selectedFolder.id}
            folderName={selectedFolder.name}
            onDeleteFolder={handleDeleteFolder}
          />
        ) : (
          <div className="pane-empty">
            <span style={{ fontSize: "2rem" }}>📂</span>
            <span>フォルダを選択してください</span>
          </div>
        )}
      </div>
    </div>
  );
}
