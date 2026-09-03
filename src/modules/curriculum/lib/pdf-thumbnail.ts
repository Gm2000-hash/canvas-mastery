import { pdfjs } from 'react-pdf';
import { supabase } from '@/modules/curriculum/config/supabase';
import { ensurePdfWorker } from '@/modules/curriculum/lib/pdf-worker';

ensurePdfWorker();

/**
 * Generates a thumbnail from the first page of a PDF file,
 * uploads it to the avatars bucket (public), and returns the public URL.
 */
export async function generatePdfThumbnail(
  pdfFile: File,
  bookId: string,
): Promise<string | null> {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // Render at a reasonable thumbnail size
    const targetWidth = 400;
    const viewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;

    // Convert canvas to blob
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) return null;

    // Upload to the public avatars bucket under book-covers/
    const filePath = `book-covers/${bookId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Cover upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Failed to generate PDF thumbnail:', err);
    return null;
  }
}
