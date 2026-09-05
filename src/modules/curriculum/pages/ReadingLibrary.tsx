import { useState, useEffect, useMemo } from "react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { BentoHero } from "@/modules/curriculum/config/chrome-bento-hero";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { PdfFlipbookViewer } from "@/modules/curriculum/components/PdfFlipbookViewer";
import { CurriculumReadingViewer } from "@/modules/curriculum/components/CurriculumReadingViewer";
import { CoverArtPicker } from "@/modules/curriculum/components/CoverArtPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useToast } from "@/modules/curriculum/config/toast";
import GenerateContentDialog from "@/modules/curriculum/components/GenerateContentDialog";
import {
  Sparkles, Search, FileText, BookOpenCheck, Share2, Copy, Check, Link2, Loader2,
  LayoutGrid, List, LayoutDashboard, Upload, ImageIcon, Trash2, FileDown,
} from "lucide-react";
import { generatePdfThumbnail } from "@/modules/curriculum/lib/pdf-thumbnail";
import { ReadingDashboardGrid } from "@/modules/curriculum/components/ReadingDashboardGrid";
import { useDashboardLayout } from "@/modules/curriculum/config/dashboard-layout";
import { useAuth } from "@/modules/curriculum/config/auth";
import { toast } from "sonner";
import { exportTextbookAsPdf } from "@/modules/curriculum/lib/export-reading-pdf";

interface LibraryBook {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  source_discipline: string | null;
  cover_url: string | null;
  share_token?: string | null;
}

export default function ReadingLibrary() {
  usePageTitle("Reading Library");
  const { user } = useAuth();
  const { layout: savedLayout, loading: layoutLoading, saveLayout, resetLayout: resetDashboardLayout } = useDashboardLayout(user?.id);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "dashboard">("dashboard");

  // Viewer states
  const [viewingBook, setViewingBook] = useState<{ title: string; url: string } | null>(null);
  const [viewingCurriculum, setViewingCurriculum] = useState<{ title: string; discipline: string } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Share states
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [coverPickerBook, setCoverPickerBook] = useState<LibraryBook | null>(null);

  const ensureScienceBooks = async (userId: string) => {
    const disciplines = ["Life Science", "Earth & Space Science", "Physical Science"];
    // Fetch all existing science books in one query to avoid race conditions
    const { data: existingBooks } = await supabase
      .from("library_books")
      .select("id, source_discipline")
      .eq("user_id", userId)
      .in("source_discipline", disciplines);
    const existingDiscs = new Set((existingBooks || []).map(b => b.source_discipline));
    for (const disc of disciplines) {
      if (!existingDiscs.has(disc)) {
        await supabase.from("library_books").insert({
          user_id: userId,
          title: `${disc} Readings`,
          file_path: `curriculum/${disc.toLowerCase().replace(/\s+/g, "-")}`,
          file_size: 0,
          is_published: true,
          source_discipline: disc,
        });
      }
    }
  };

  const fetchBooks = async () => {
    if (user) {
      await ensureScienceBooks(user.id);
    }
    const { data, error } = await supabase
      .from("library_books")
      .select("id, title, file_path, file_size, source_discipline, cover_url")
      .order("created_at", { ascending: false });

    if (data) setBooks(data as LibraryBook[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchBooks();
  }, [user]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    books.forEach(b => {
      if (b.source_discipline) set.add(b.source_discipline);
    });
    return Array.from(set).sort();
  }, [books]);

  const filtered = useMemo(() => {
    let list = books;
    if (subjectFilter !== "all") {
      list = list.filter(b =>
        subjectFilter === "pdf"
          ? !b.source_discipline
          : b.source_discipline === subjectFilter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.source_discipline || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [books, subjectFilter, search]);

  const openBook = async (book: LibraryBook) => {
    if (book.source_discipline) {
      setViewingCurriculum({ title: book.title, discipline: book.source_discipline });
      return;
    }
    setOpeningId(book.id);
    try {
      const { data, error } = await supabase.storage
        .from("library-pdfs")
        .createSignedUrl(book.file_path, 60 * 30);
      if (error || !data?.signedUrl) throw error;
      setViewingBook({ title: book.title, url: data.signedUrl });
    } catch {
      toast.error("Failed to open PDF");
    } finally {
      setOpeningId(null);
    }
  };

  const handleShare = async (book: LibraryBook) => {
    setSharingId(book.id);
    try {
      // Fetch share_token on-demand to avoid exposing it in bulk queries
      const { data: bookData } = await supabase
        .from("library_books")
        .select("share_token")
        .eq("id", book.id)
        .single();
      let token = bookData?.share_token;
      if (!token) {
        token = crypto.randomUUID();
        const { error } = await supabase
          .from("library_books")
          .update({ share_token: token } as any)
          .eq("id", book.id);
        if (error) throw error;
      }
      const url = `${window.location.origin}/curriculum/shared-reading/${token}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(book.id);
      toast.success("Share link copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Failed to create share link");
    } finally {
      setSharingId(null);
    }
  };

  const handleDelete = async (book: LibraryBook) => {
    if (!confirm(`Delete "${book.title}" from the library?`)) return;
    try {
      if (!book.source_discipline) {
        await supabase.storage.from("library-pdfs").remove([book.file_path]);
      }
      if (book.cover_url) {
        const coverPath = book.cover_url.split("/book-covers/")[1];
        if (coverPath) await supabase.storage.from("book-covers").remove([coverPath]);
      }
      const { error } = await supabase.from("library_books").delete().eq("id", book.id);
      if (error) throw error;
      setBooks(prev => prev.filter(b => b.id !== book.id));
      toast.success(`"${book.title}" deleted`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete book");
    }
  };

  const handleExportPdf = async (book: LibraryBook) => {
    if (!book.source_discipline || !user) return;
    toast.info("Loading readings for export...");
    try {
      const { data: units } = await supabase
        .from("units")
        .select("id, title, sort_order")
        .eq("user_id", user.id)
        .eq("discipline", book.source_discipline)
        .order("sort_order");
      if (!units?.length) { toast.error("No units found for this discipline"); return; }
      const unitMap: Record<string, string> = {};
      units.forEach((u: any) => { unitMap[u.id] = u.title; });
      const { data: lessons } = await supabase
        .from("curriculum_lessons")
        .select("*")
        .eq("user_id", user.id)
        .in("unit_id", units.map((u: any) => u.id))
        .order("sort_order");
      if (!lessons?.length) { toast.error("No readings found to export"); return; }
      exportTextbookAsPdf(lessons as any, unitMap, book.title);
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.type !== "application/pdf") { toast.error("Only PDF files are supported"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("File must be under 50 MB"); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const bookId = crypto.randomUUID();
      const filePath = `${user.id}/${bookId}.pdf`;
      const { error: uploadError } = await supabase.storage.from("library-pdfs").upload(filePath, file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const coverUrl = await generatePdfThumbnail(file, bookId);
      const title = file.name.replace(/\.pdf$/i, "");
      const { error: insertError } = await supabase.from("library_books").insert({ id: bookId, user_id: user.id, title, file_path: filePath, file_size: file.size, cover_url: coverUrl });
      if (insertError) throw insertError;
      toast.success(`"${title}" uploaded successfully`);
      fetchBooks();
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Failed to upload PDF");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Reading Library" }]} />
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <BentoHero
          eyebrow="Reading Library"
          title={<>A shelf of <em className="italic font-light">curated</em> readings.</>}
          subtitle="Curriculum readings, uploaded PDFs, and AI-generated textbooks — all in one place. Share with students via public link or export the whole shelf as a PDF."
          stats={[
            { label: "Items", value: books.length },
            { label: "Subjects", value: subjects.length },
          ]}
          primaryAction={{ label: "AI Generate", onClick: () => setGenerateOpen(true), icon: Sparkles }}
          secondaryActions={[
            { label: uploading ? "Uploading…" : "Upload PDF", onClick: () => document.getElementById("pdf-upload-input")?.click(), icon: Upload },
          ]}
          sideTiles={[
            {
              variant: "peach",
              eyebrow: "AI",
              title: "Generate a textbook",
              body: "Auto-build a unit-aligned reading set with images.",
              action: { label: "Generate", onClick: () => setGenerateOpen(true), icon: Sparkles },
            },
            {
              variant: "coral",
              eyebrow: "Compile",
              title: "Digital textbooks",
              body: "Arrange chapter-format readings into parts, share a student link, or send to Canvas / Google Classroom.",
              action: { label: "Open Textbooks", onClick: () => navigate("/app/curriculum/textbooks"), icon: BookOpen },
            },
          ]}
        />

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border-card-foreground border-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search readings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="pdf">PDF Documents</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded-lg p-0.5 border-2 border-card-foreground">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("dashboard")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Dashboard layout (drag & resize)"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-card-foreground border-2"
            disabled={uploading}
            onClick={() => document.getElementById("pdf-upload-input")?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload PDF
          </Button>
          <input
            id="pdf-upload-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => setGenerateOpen(true)} className="gap-2 rounded-xl border-card-foreground border-2 bg-muted-foreground" size="sm">
            <Sparkles className="h-4 w-4" />
            AI Generate
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <BookOpenCheck className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">
              {books.length === 0
                ? "No readings yet. Use AI Generate to create curriculum readings."
                : "No readings match your search."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mx-0 pl-[300px] pt-[300px] pr-[300px] pb-[300px] bg-[#fef7ec]">
            {filtered.map(book => (
              <div key={book.id} className="group">
                <button
                  onClick={() => openBook(book)}
                  disabled={openingId === book.id}
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl disabled:opacity-70"
                >
                  <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 items-center justify-center relative overflow-hidden transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-1 group-active:scale-[0.97] text-card-foreground border-popover-foreground border-2 flex flex-col text-left bg-destructive-foreground">
                    {openingId === book.id ? (
                      <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    ) : book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <FileText className="h-8 w-8 text-popover-foreground" />
                    )}
                    {!book.cover_url && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/25 rounded-l-xl" />}
                    {book.source_discipline && (
                      <Badge className="absolute bottom-1.5 right-1.5 text-[9px] px-1.5 py-0 text-popover-foreground" variant="secondary">
                        {book.source_discipline}
                      </Badge>
                    )}
                    {!book.source_discipline && (
                      <Badge className="absolute bottom-1.5 right-1.5 text-[9px] px-1.5 py-0 text-popover-foreground" variant="outline">
                        PDF
                      </Badge>
                    )}
                  </div>
                </button>
                <div className="flex items-center justify-between mt-2 px-0.5">
                  <p className="text-xs font-medium text-foreground truncate flex-1">{book.title}</p>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setCoverPickerBook(book); }}
                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Change cover art"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleShare(book)}
                      disabled={sharingId === book.id}
                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Copy share link"
                    >
                      {copiedId === book.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : sharingId === book.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(book); }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete book"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "dashboard" ? (
          <ReadingDashboardGrid
            books={filtered}
            onOpenBook={openBook}
            onShare={handleShare}
            onEditCover={setCoverPickerBook}
            onDelete={handleDelete}
            onExportPdf={handleExportPdf}
            openingId={openingId}
            sharingId={sharingId}
            copiedId={copiedId}
            savedLayout={savedLayout}
            layoutLoading={layoutLoading}
            onLayoutSave={saveLayout}
            onLayoutReset={resetDashboardLayout}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(book => (
              <div
                key={book.id}
                className="flex items-center gap-4 p-3 rounded-xl border border-border/60 bg-card hover:bg-accent/30 transition-colors group"
              >
                <button
                  onClick={() => openBook(book)}
                  disabled={openingId === book.id}
                  className="shrink-0 w-12 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-border/40 flex items-center justify-center overflow-hidden"
                >
                  {openingId === book.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary/30" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => openBook(book)}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block"
                  >
                    {book.title}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    {book.source_discipline ? (
                      <Badge variant="secondary" className="text-[10px]">{book.source_discipline}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">PDF</Badge>
                    )}
                    {book.share_token && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Link2 className="h-3 w-3" /> Shared
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setCoverPickerBook(book)}
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Cover
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleShare(book)}
                  disabled={sharingId === book.id}
                >
                  {copiedId === book.id ? (
                    <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
                  ) : sharingId === book.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><Share2 className="h-3.5 w-3.5" /> Share</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => handleDelete(book)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <GenerateContentDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onComplete={() => fetchBooks()}
        defaultContentType="reading"
      />

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

      {coverPickerBook && (
        <CoverArtPicker
          open={!!coverPickerBook}
          onOpenChange={(open) => { if (!open) setCoverPickerBook(null); }}
          bookId={coverPickerBook.id}
          bookTitle={coverPickerBook.title}
          currentCoverUrl={coverPickerBook.cover_url}
          onCoverUpdated={(url) => {
            setBooks(prev => prev.map(b => b.id === coverPickerBook.id ? { ...b, cover_url: url } : b));
            setCoverPickerBook(null);
          }}
          onCoverRemoved={() => {
            setBooks(prev => prev.map(b => b.id === coverPickerBook.id ? { ...b, cover_url: null } : b));
            setCoverPickerBook(null);
          }}
        />
      )}
    </div>
  );
}
