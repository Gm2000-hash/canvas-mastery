import { useState, useEffect } from "react";
import { useParams } from "@/modules/curriculum/config/router";
import { supabase } from "@/modules/curriculum/config/supabase";
import { PdfFlipbookViewer } from "@/modules/curriculum/components/PdfFlipbookViewer";
import { CurriculumReadingViewer } from "@/modules/curriculum/components/CurriculumReadingViewer";
import { Loader2, BookOpenCheck, AlertCircle } from "lucide-react";

interface SharedBook {
  id: string;
  title: string;
  file_path: string;
  source_discipline: string | null;
}

export default function SharedReading() {
  const { token } = useParams<{ token: string }>();
  const [book, setBook] = useState<SharedBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    const loadBook = async () => {
      const { data, error: fetchError } = await supabase
        .rpc("get_shared_book", { _share_token: token })
        .maybeSingle();

      if (fetchError || !data) {
        setError("This reading is not available or the link has expired.");
        setLoading(false);
        return;
      }

      setBook(data as SharedBook);

      // For PDF books, get a signed URL
      if (!data.source_discipline) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from("library-pdfs")
          .createSignedUrl(data.file_path, 60 * 60); // 1 hour

        if (urlError || !urlData?.signedUrl) {
          setError("Failed to load the PDF. Please try again later.");
          setLoading(false);
          return;
        }
        setPdfUrl(urlData.signedUrl);
      }

      setLoading(false);
    };

    loadBook();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading reading...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Reading Not Found</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Curriculum-backed book — render inline
  if (book.source_discipline) {
    return (
      <div className="min-h-screen bg-background">
        <CurriculumReadingViewer
          discipline={book.source_discipline}
          title={book.title}
          onClose={() => window.close()}
        />
      </div>
    );
  }

  // PDF book
  if (pdfUrl) {
    return (
      <div className="min-h-screen bg-background">
        <PdfFlipbookViewer
          fileUrl={pdfUrl}
          title={book.title}
          onClose={() => window.close()}
        />
      </div>
    );
  }

  return null;
}
