import { useEffect } from "react";
import type { Photo } from "../types";

interface Props {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({ photos, index, onClose, onNavigate }: Props) {
  const photo = photos[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, photos.length, onClose, onNavigate]);

  if (!photo) return null;

  return (
    <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img className="lightbox-img" src={photo.url} alt={photo.name} />

      <button className="lightbox-close" onClick={onClose} aria-label="閉じる">✕</button>

      {index > 0 && (
        <button className="lightbox-nav prev" onClick={() => onNavigate(index - 1)} aria-label="前へ">‹</button>
      )}
      {index < photos.length - 1 && (
        <button className="lightbox-nav next" onClick={() => onNavigate(index + 1)} aria-label="次へ">›</button>
      )}

      <div className="lightbox-counter">{index + 1} / {photos.length}</div>
    </div>
  );
}
