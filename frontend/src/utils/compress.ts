const MAX_BYTES = 1024 * 1024; // 1MB
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_DIMENSION = 2048;

export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} は20MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`;
  }
  return null;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読み込みに失敗しました"));
    };
    img.src = url;
  });
}

function drawToCanvas(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("変換失敗"))),
      "image/jpeg",
      quality
    );
  });
}

export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);

  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    if (w > h) {
      h = Math.round((h * MAX_DIMENSION) / w);
      w = MAX_DIMENSION;
    } else {
      w = Math.round((w * MAX_DIMENSION) / h);
      h = MAX_DIMENSION;
    }
  }

  const canvas = drawToCanvas(img, w, h);

  for (let q = 0.8; q >= 0.1; q -= 0.1) {
    const blob = await canvasToBlob(canvas, q);
    if (blob.size <= MAX_BYTES) return blob;
  }

  // 最終手段：さらに縮小
  const scale = Math.sqrt(MAX_BYTES / (await canvasToBlob(canvas, 0.1)).size);
  const canvas2 = drawToCanvas(img, Math.round(w * scale), Math.round(h * scale));
  return canvasToBlob(canvas2, 0.8);
}

export async function generateThumbnail(blob: Blob, shortSide = 400): Promise<Blob> {
  const img = await loadImage(blob);
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w <= h) {
    h = Math.round((h * shortSide) / w);
    w = shortSide;
  } else {
    w = Math.round((w * shortSide) / h);
    h = shortSide;
  }

  const canvas = drawToCanvas(img, w, h);
  return canvasToBlob(canvas, 0.8);
}
