/**
 * Client-side resize before upload.
 *
 * The old panel uploaded whatever was picked, with only a "keep it under
 * ~2MB" hint — which is how a 4.19 MB PNG ended up as a 300px thumbnail.
 */

const MAX_EDGE = 2400;
const QUALITY = 0.82;

export interface ResizeResult {
  base64: string;
  ext: 'webp';
  beforeBytes: number;
  afterBytes: number;
  width: number;
  height: number;
}

export async function resizeImage(file: File): Promise<ResizeResult> {
  // imageOrientation: 'from-image' is NOT optional. Phone photos carry EXIF
  // rotation; without it every portrait shot commits sideways.
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });

  const ctx = (canvas as any).getContext('2d');
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();

  const blob: Blob =
    'convertToBlob' in canvas
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/webp', quality: QUALITY })
      : await new Promise((res) =>
          (canvas as HTMLCanvasElement).toBlob((b) => res(b!), 'image/webp', QUALITY),
        );

  // readAsDataURL rather than folding bytes by hand: it does not risk the
  // call-stack overflow that String.fromCharCode(...bytes) hits on big files.
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  return {
    base64,
    ext: 'webp',
    beforeBytes: file.size,
    afterBytes: blob.size,
    width,
    height,
  };
}

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`;
