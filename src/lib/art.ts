import type { CSSProperties } from 'react';
export function artPanel(url: string) {
  const match = url.match(/\/artworks\/artwork-([1-5])\.png$/);
  return match ? Number(match[1]) - 1 : null;
}
export function artStyle(url: string): CSSProperties {
  const panel = artPanel(url);
  return { backgroundImage: `url("${url}")`, backgroundSize: panel === null ? '100% 100%' : '500% 100%', backgroundPosition: panel === null ? 'center' : `${panel * 25}% center` };
}
export async function readImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG, JPG, WebP 이미지를 선택해주세요.');
  if (file.size > 20 * 1024 * 1024) throw new Error('이미지는 20MB 이하로 올려주세요.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 60_000_000) throw new Error('이미지가 너무 큽니다. 6천만 픽셀 이하로 줄여주세요.');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지를 처리할 수 없습니다.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.9);
  } finally { bitmap.close(); }
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
