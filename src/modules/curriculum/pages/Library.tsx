import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/modules/curriculum/config/supabase';
import { useAuth } from '@/modules/curriculum/config/auth';
import { AppNavSheet } from '@/modules/curriculum/config/chrome-nav-sheet';
import { Breadcrumbs } from '@/modules/curriculum/config/chrome-breadcrumbs';
import { PdfFlipbookViewer } from '@/modules/curriculum/components/PdfFlipbookViewer';
import { CurriculumReadingViewer } from '@/modules/curriculum/components/CurriculumReadingViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookOpen, Upload, Loader2, Trash2, FileText, Eye, EyeOff } from 'lucide-react';
import { generatePdfThumbnail } from '@/modules/curriculum/lib/pdf-thumbnail';

interface LibraryBook {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  page_count: number;
  created_at: string;
  is_published: boolean;
  source_discipline: string | null;
  cover_url: string | null;
}

interface ViewingBook {
  id: string;
  title: string;
  url: string;
}

export default function Library() {
  const { user } = useAuth();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingBook, setViewingBook] = useState<ViewingBook | null>(null);
  const [viewingCurriculum, setViewingCurriculum] = useState<{ title: string; discipline: string } | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('library_books')
      .select('id, title, file_path, file_size, page_count, created_at, is_published, source_discipline, cover_url')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch books:', error);
      toast.error('Failed to load library');
    } else {
      setBooks((data || []) as LibraryBook[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be under 50MB');
      return;
    }

    setUploading(true);
    try {
      const filePath = `shared/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('library-pdfs')
        .upload(filePath, file, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const title = file.name.replace(/\.pdf$/i, '');
      const { data: insertData, error: insertError } = await supabase
        .from('library_books')
        .insert({
          user_id: user.id,
          title,
          file_path: filePath,
          file_size: file.size,
          is_published: false,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Generate thumbnail from first page
      if (insertData) {
        const coverUrl = await generatePdfThumbnail(file, insertData.id);
        if (coverUrl) {
          await supabase
            .from('library_books')
            .update({ cover_url: coverUrl })
            .eq('id', insertData.id);
        }
      }

      toast.success(`"${title}" uploaded as unpublished`);
      fetchBooks();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload PDF');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (book: LibraryBook) => {
    if (!confirm(`Delete "${book.title}" from the shared library?`)) return;

    try {
      const { error: storageError } = await supabase.storage.from('library-pdfs').remove([book.file_path]);
      if (storageError) throw storageError;

      const { error: deleteError } = await supabase.from('library_books').delete().eq('id', book.id);
      if (deleteError) throw deleteError;

      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      toast.success('Book removed');
    } catch (error) {
      console.error('Failed to delete book:', error);
      toast.error('Failed to delete book');
    }
  };

  const handleTogglePublished = async (book: LibraryBook) => {
    const nextPublished = !book.is_published;
    setUpdatingId(book.id);

    try {
      const { error } = await supabase
        .from('library_books')
        .update({ is_published: nextPublished })
        .eq('id', book.id);

      if (error) throw error;

      setBooks((prev) =>
        prev.map((item) =>
          item.id === book.id ? { ...item, is_published: nextPublished } : item
        )
      );

      toast.success(nextPublished ? 'Book published' : 'Book unpublished');
    } catch (error) {
      console.error('Failed to update publish state:', error);
      toast.error('Failed to update publish state');
    } finally {
      setUpdatingId(null);
    }
  };

  const openBook = async (book: LibraryBook) => {
    if (book.source_discipline) {
      setViewingCurriculum({ title: book.title, discipline: book.source_discipline });
      return;
    }

    setOpeningId(book.id);
    try {
      const { data, error } = await supabase.storage
        .from('library-pdfs')
        .createSignedUrl(book.file_path, 60 * 30);

      if (error || !data?.signedUrl) throw error;

      setViewingBook({ id: book.id, title: book.title, url: data.signedUrl });
    } catch (error) {
      console.error('Failed to open PDF:', error);
      toast.error('Failed to open PDF');
    } finally {
      setOpeningId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: 'Manage Library' }]} />
      </header>

      <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 bg-page-green">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Manage Shared Library</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Upload PDFs, then publish them when they should appear on teacher home screens.
              </p>
            </div>
            <div>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                id="pdf-upload"
                disabled={uploading}
              />
              <Button asChild disabled={uploading} className="gap-2">
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload PDF
                    </>
                  )}
                </label>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : books.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No books yet</h3>
                <p className="text-sm text-muted-foreground">Upload a PDF to start the shared library</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {books.map((book) => {
                const isUpdating = updatingId === book.id;
                const isOpening = openingId === book.id;

                return (
                  <Card
                    key={book.id}
                    className="group overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => openBook(book)}
                      disabled={isOpening}
                    >
                      <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 flex items-center justify-center relative overflow-hidden">
                        {isOpening ? (
                          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                        ) : book.cover_url ? (
                          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="h-10 w-10 text-primary/40" />
                        )}
                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-primary/20" />
                      </div>
                    </button>

                    <CardContent className="space-y-3 p-3">
                      <div className="space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">{book.title}</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">{book.source_discipline ? 'Curriculum' : formatSize(book.file_size)}</p>
                          <Badge variant={book.is_published ? 'default' : 'secondary'}>
                            {book.is_published ? 'Published' : 'Unpublished'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          disabled={isUpdating}
                          onClick={() => handleTogglePublished(book)}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : book.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          {book.is_published ? 'Unpublish' : 'Publish'}
                        </Button>

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => handleDelete(book)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {viewingBook && (
        <PdfFlipbookViewer
          fileUrl={viewingBook.url}
          title={viewingBook.title}
          onClose={() => setViewingBook(null)}
        />
      )}

      {viewingCurriculum && (
        <CurriculumReadingViewer
          discipline={viewingCurriculum.discipline}
          title={viewingCurriculum.title}
          onClose={() => setViewingCurriculum(null)}
        />
      )}
    </div>
  );
}
