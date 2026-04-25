import { useCallback, useEffect, useState } from "react";
import { deleteFolder, getFolders } from "./api";
import TwoPaneLayout from "./components/TwoPaneLayout";
import FolderList from "./components/FolderList";
import PhotoGrid from "./components/PhotoGrid";
import UploadPage from "./components/UploadPage";
import type { Folder } from "./types";
import { getCached, invalidateCache, setCached } from "./utils/cache";

const CACHE_KEY = "folders_v1";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default function App() {
  const [page, setPage] = useState<"home" | "upload">("home");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePage, setMobilePage] = useState<"list" | "detail">("list");
  const [shareIds, setShareIds] = useState<string[] | null>(null);

  // ?share= パラメータを解析
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const share = params.get("share");
    if (share) setShareIds(share.split(",").filter(Boolean));
  }, []);

  const loadFolders = useCallback(async () => {
    // stale-while-revalidate
    const cached = getCached<Folder[]>(CACHE_KEY);
    if (cached) setFolders(cached);

    try {
      const fresh = await getFolders();
      // 7日以内のフォルダのみ表示
      const recent = fresh.filter(
        (f) => Date.now() - new Date(f.createdAt).getTime() < SEVEN_DAYS
      );
      setFolders(recent);
      setCached(CACHE_KEY, recent);
    } catch {
      // キャッシュがあれば継続表示
    }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const handleFolderCreated = (folder: Folder) => {
    setFolders((prev) => [folder, ...prev]);
    invalidateCache(CACHE_KEY);
    setSelectedId(folder.id);
  };

  const handleFolderDeleted = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    invalidateCache(CACHE_KEY);
    if (selectedId === id) {
      setSelectedId(null);
      setMobilePage("list");
    }
  };

  const handleFolderRenamed = (updated: Folder) => {
    setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    invalidateCache(CACHE_KEY);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobilePage("detail");
  };

  const handleDeleteSelectedFolder = async () => {
    if (!selectedId) return;
    await deleteFolder(selectedId);
    handleFolderDeleted(selectedId);
  };

  const selectedFolder = folders.find((f) => f.id === selectedId);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <span className="navbar-title">📸 写真共有</span>
        {page === "home" ? (
          <button
            className="navbar-btn"
            onClick={() => setPage("upload")}
          >
            ⬆ アップロード
          </button>
        ) : (
          <button className="navbar-btn" onClick={() => setPage("home")}>
            ← 戻る
          </button>
        )}
      </nav>

      {/* Upload page */}
      {page === "upload" && (
        <UploadPage
          folders={folders}
          onFolderCreated={(folder) => {
            handleFolderCreated(folder);
            loadFolders();
          }}
          onBack={() => setPage("home")}
        />
      )}

      {/* Home page */}
      {page === "home" && (
        <>
          {/* PC: 2ペインレイアウト */}
          <TwoPaneLayout
            folders={folders}
            selectedId={selectedId}
            shareIds={shareIds}
            onSelect={handleSelect}
            onFolderCreated={handleFolderCreated}
            onFolderDeleted={handleFolderDeleted}
            onFolderRenamed={handleFolderRenamed}
            onShareChange={(ids) => {
              setShareIds(ids);
              if (!ids) {
                const url = new URL(window.location.href);
                url.searchParams.delete("share");
                window.history.replaceState({}, "", url);
              }
            }}
          />

          {/* Mobile: フォルダ一覧 */}
          <div className="mobile-only">
            {mobilePage === "list" ? (
              <FolderList
                folders={folders}
                selectedId={selectedId}
                shareIds={shareIds}
                onSelect={handleSelect}
                onFolderCreated={handleFolderCreated}
                onFolderDeleted={handleFolderDeleted}
                onFolderRenamed={handleFolderRenamed}
                onShareChange={(ids) => {
                  setShareIds(ids);
                  if (!ids) {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("share");
                    window.history.replaceState({}, "", url);
                  }
                }}
              />
            ) : selectedFolder ? (
              <PhotoGrid
                folderId={selectedFolder.id}
                folderName={selectedFolder.name}
                onBack={() => {
                  setMobilePage("list");
                  const sp = shareIds ? `?share=${shareIds.join(",")}` : "";
                  window.history.replaceState({}, "", `${window.location.pathname}${sp}`);
                }}
                onDeleteFolder={handleDeleteSelectedFolder}
              />
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
