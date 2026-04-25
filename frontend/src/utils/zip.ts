import JSZip from "jszip";

export async function downloadAsZip(
  folderName: string,
  photos: { name: string; url: string }[],
  onProgress: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  let done = 0;

  const fetchOne = async (photo: { name: string; url: string }) => {
    const res = await fetch(photo.url);
    if (!res.ok) throw new Error(`Failed to fetch ${photo.name}`);
    const blob = await res.blob();
    zip.file(photo.name, blob);
    done++;
    onProgress(done, photos.length);
  };

  // 5枚並列
  for (let i = 0; i < photos.length; i += 5) {
    await Promise.all(photos.slice(i, i + 5).map(fetchOne));
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
