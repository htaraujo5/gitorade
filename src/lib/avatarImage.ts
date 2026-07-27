/** Resize an image file to a small JPEG/PNG data URL for profile storage. */
export async function fileToAvatarDataUrl(file: File, maxSide = 192): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Não foi possível processar a imagem.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  // Prefer JPEG for photos (smaller); keep PNG for transparency-ish sources.
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = mime === "image/jpeg" ? 0.85 : undefined;
  const dataUrl = canvas.toDataURL(mime, quality);
  if (dataUrl.length > 200_000) {
    const smaller = canvas.toDataURL("image/jpeg", 0.7);
    if (smaller.length > 200_000) {
      throw new Error("Imagem ainda grande demais após compactar. Use outra foto.");
    }
    return smaller;
  }
  return dataUrl;
}
