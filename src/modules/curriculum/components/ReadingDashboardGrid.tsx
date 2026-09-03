import { useState, useCallback, useMemo } from "react";
import { GridLayout, verticalCompactor } from "react-grid-layout";
import type { LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { FileText, Link2, Check, Loader2, RotateCcw, ImageIcon, Trash2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LibraryBook {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  source_discipline: string | null;
  cover_url: string | null;
  share_token?: string | null;
}

interface ReadingDashboardGridProps {
  books: LibraryBook[];
  onOpenBook: (book: LibraryBook) => void;
  onShare: (book: LibraryBook) => void;
  onEditCover?: (book: LibraryBook) => void;
  onDelete?: (book: LibraryBook) => void;
  onExportPdf?: (book: LibraryBook) => void;
  openingId: string | null;
  sharingId: string | null;
  copiedId: string | null;
  savedLayout: LayoutItem[] | null;
  layoutLoading: boolean;
  onLayoutSave: (layout: LayoutItem[]) => void;
  onLayoutReset: () => void;
}

const COLS = 6;
const ROW_HEIGHT = 120;

function makeItem(id: string, x: number, y: number, w = 1, h = 2): LayoutItem {
  return { i: id, x, y, w, h, minW: 1, minH: 1, maxW: 6, maxH: 6 };
}

function generateDefaultLayout(books: LibraryBook[]): LayoutItem[] {
  return books.map((book, i) => makeItem(book.id, i % COLS, Math.floor(i / COLS) * 2));
}

function mergeLayout(saved: LayoutItem[] | null, books: LibraryBook[]): LayoutItem[] {
  if (!saved || saved.length === 0) return generateDefaultLayout(books);
  const bookIds = new Set(books.map(b => b.id));
  const existing = saved.filter(l => bookIds.has(l.i));
  const existingIds = new Set(existing.map(l => l.i));
  const newBooks = books.filter(b => !existingIds.has(b.id));
  const maxY = existing.length > 0 ? Math.max(...existing.map(l => l.y + l.h)) : 0;
  const newLayouts = newBooks.map((book, i) => makeItem(book.id, i % COLS, maxY + Math.floor(i / COLS) * 2));
  return [...existing, ...newLayouts];
}

export function ReadingDashboardGrid({
  books,
  onOpenBook,
  onShare,
  onEditCover,
  onDelete,
  onExportPdf,
  openingId,
  sharingId,
  copiedId,
  savedLayout,
  layoutLoading,
  onLayoutSave,
  onLayoutReset,
}: ReadingDashboardGridProps) {
  const currentLayout = useMemo(() => mergeLayout(savedLayout, books), [savedLayout, books]);

  const onLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    onLayoutSave([...newLayout]);
  }, [onLayoutSave]);

  const bookMap = useMemo(() => {
    const map = new Map<string, LibraryBook>();
    books.forEach(b => map.set(b.id, b));
    return map;
  }, [books]);

  if (layoutLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-muted-foreground italic">
          Drag the handle to reposition • Resize from bottom-right corner
        </p>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onLayoutReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Layout
        </Button>
      </div>
      <GridLayout
        layout={currentLayout}
        width={900}
        gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: [12, 12] as const, containerPadding: null, maxRows: Infinity }}
        onLayoutChange={onLayoutChange}
        dragConfig={{ enabled: true, handle: ".drag-handle" }}
        resizeConfig={{ enabled: true }}
        compactor={verticalCompactor}
      >
        {currentLayout.map(item => {
          const book = bookMap.get(item.i);
          if (!book) return null;
          return (
            <div
              key={book.id}
              className="rounded-xl border-2 border-popover-foreground bg-destructive-foreground overflow-hidden flex flex-col group transition-shadow hover:shadow-lg"
            >
              {/* Drag handle */}
              <div className="drag-handle cursor-grab active:cursor-grabbing h-5 flex items-center justify-center bg-muted/50 border-b border-border/40 shrink-0">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                </div>
              </div>

              {/* Content */}
              <button
                onClick={() => onOpenBook(book)}
                disabled={openingId === book.id}
                className="flex-1 flex flex-col items-center justify-center p-2 gap-1 disabled:opacity-70 min-h-0"
              >
                {openingId === book.id ? (
                  <div className="h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                ) : book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full flex-1 object-cover rounded-lg min-h-0" />
                ) : (
                  <FileText className="h-6 w-6 text-popover-foreground shrink-0" />
                )}
              </button>

              {/* Footer */}
              <div className="flex items-center justify-between px-2 py-1 border-t border-border/40 shrink-0">
                <p className="text-base font-medium text-foreground truncate flex-1">{book.title}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {book.source_discipline ? (
                    <Badge className="text-[8px] px-1 py-0 text-popover-foreground" variant="secondary">{book.source_discipline}</Badge>
                  ) : (
                    <Badge className="text-[8px] px-1 py-0 text-popover-foreground" variant="outline">PDF</Badge>
                  )}
                  {onEditCover && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditCover(book); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      title="Change cover art"
                    >
                      <ImageIcon className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onShare(book); }}
                    disabled={sharingId === book.id}
                    className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {copiedId === book.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : sharingId === book.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                  </button>
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(book); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete book"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  {onExportPdf && book.source_discipline && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onExportPdf(book); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      title="Export as PDF"
                    >
                      <FileDown className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
