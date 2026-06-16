// Reads an image file and returns a resized JPEG data URL.
// We resize to keep localStorage usage reasonable; when migrating to
// Supabase Storage this util can be replaced with a direct upload.
export function fileToResizedDataUrl(file, { maxSize = 1280, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (!file.type.startsWith('image/')) return reject(new Error('File is not an image'));

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function approxDataUrlKB(dataUrl) {
  if (!dataUrl) return 0;
  // base64 length / 4 * 3 ≈ bytes
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx === -1 ? dataUrl : dataUrl.slice(commaIdx + 1);
  return Math.round((b64.length * 0.75) / 1024);
}
