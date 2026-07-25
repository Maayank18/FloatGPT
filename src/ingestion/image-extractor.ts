/**
 * Reads an image file and returns its Data URL (base64 string).
 * For Image sources, we don't extract raw text immediately via OCR; 
 * instead, we pass the base64 to vision-capable models (like Gemini 1.5 Pro/Flash or GPT-4o)
 * which provides much better understanding of structure and context.
 */
export function extractImageBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
