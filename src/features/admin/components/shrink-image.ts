/** Yuklashdan oldin brauzerda kichraytirish (≤1600 px, JPEG): server action hajm chegarasidan oshmasin; server baribir qayta kodlaydi */
export async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.88));
  } catch {
    // rasm sifatida ochilmadi — asl fayl yuboriladi, server tushunarli xato qaytaradi
    return file;
  }
}
