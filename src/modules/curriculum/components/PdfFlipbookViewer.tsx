import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { Document, Page } from 'react-pdf';
import HTMLFlipBook from 'react-pageflip';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  ZoomIn, ZoomOut, BookOpen, ScrollText,
} from 'lucide-react';
import { ensurePdfWorker } from '@/modules/curriculum/lib/pdf-worker';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

ensurePdfWorker();

interface PdfFlipbookViewerProps {
  fileUrl: string;
  title: string;
  onClose: () => void;
}

type ViewMode = 'flipbook' | 'scroll';

const FlipPage = forwardRef<HTMLDivElement, { pageNumber: number; width: number; height: number }>(
  ({ pageNumber, width, height }, ref) => (
    <div ref={ref} className="bg-white flex items-center justify-center overflow-hidden relative">
      <Page
        pageNumber={pageNumber}
        width={width}
        height={height}
        renderTextLayer={false}
        renderAnnotationLayer={true}
        className="pdf-page-render [&_.react-pdf__Page__annotations]:absolute [&_.react-pdf__Page__annotations]:inset-0 [&_.react-pdf__Page__annotations]:z-[1000] [&_.react-pdf__Page__annotations_a]:pointer-events-auto"
      />
    </div>
  )
);
FlipPage.displayName = 'FlipPage';

export function PdfFlipbookViewer({ fileUrl, title, onClose }: PdfFlipbookViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('flipbook');
  const [flipbookFailed, setFlipbookFailed] = useState(false);
  const flipBookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getPageDimensions = useCallback(() => {
    const maxW = isFullscreen ? window.innerWidth * 0.42 : Math.min(420, window.innerWidth * 0.38);
    const maxH = isFullscreen ? window.innerHeight * 0.82 : Math.min(580, window.innerHeight * 0.72);
    const ratio = 8.5 / 11;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { width: Math.floor(w * scale), height: Math.floor(h * scale) };
  }, [isFullscreen, scale]);

  const getScrollPageWidth = useCallback(() => {
    const maxW = isFullscreen ? window.innerWidth * 0.75 : Math.min(680, window.innerWidth * 0.65);
    return Math.floor(maxW * scale);
  }, [isFullscreen, scale]);

  const { width: pageWidth, height: pageHeight } = getPageDimensions();

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoadError(null);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setLoadError(error?.message || 'Failed to load PDF');
    setLoading(false);
  }, []);

  const goToPrev = () => flipBookRef.current?.pageFlip()?.flipPrev();
  const goToNext = () => flipBookRef.current?.pageFlip()?.flipNext();
  const onFlip = useCallback((e: any) => setCurrentPage(e.data), []);

  const toggleFullscreen = () => setIsFullscreen(prev => !prev);
  const zoomIn = () => setScale(s => Math.min(s + 0.15, 1.6));
  const zoomOut = () => setScale(s => Math.max(s - 0.15, 0.6));

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'flipbook' ? 'scroll' : 'flipbook');
  };

  // Auto-fallback: if flipbook throws during render, catch and switch
  useEffect(() => {
    if (flipbookFailed && viewMode === 'flipbook') {
      setViewMode('scroll');
    }
  }, [flipbookFailed, viewMode]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (viewMode === 'flipbook') {
        if (e.key === 'ArrowLeft') goToPrev();
        if (e.key === 'ArrowRight') goToNext();
      }
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, onClose, viewMode]);

  const displayPage = Math.min(currentPage + 1, numPages);
  const activeMode = flipbookFailed ? 'scroll' : viewMode;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md transition-all duration-300 ${
        isFullscreen ? '' : 'p-4 md:p-8'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl shrink-0">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {!flipbookFailed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleViewMode}
              className="rounded-xl h-8 w-8"
              title={activeMode === 'flipbook' ? 'Switch to scroll view' : 'Switch to flipbook view'}
            >
              {activeMode === 'flipbook' ? <ScrollText className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={zoomOut} className="rounded-xl h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={zoomIn} className="rounded-xl h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="rounded-xl h-8 w-8">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        {loading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">Loading PDF...</div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3 max-w-sm px-4">
              <p className="text-sm text-destructive font-medium">Failed to load PDF</p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => { setLoadError(null); setLoading(true); setNumPages(0); }}>
                Retry
              </Button>
            </div>
          </div>
        )}

        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading="" externalLinkTarget="_blank">
          {numPages > 0 && activeMode === 'flipbook' && (
            <FlipbookRenderer
              numPages={numPages}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              flipBookRef={flipBookRef}
              onFlip={onFlip}
              onError={() => setFlipbookFailed(true)}
            />
          )}

          {numPages > 0 && activeMode === 'scroll' && (
            <div
              ref={scrollContainerRef}
              className="h-full w-full overflow-y-auto flex flex-col items-center gap-4 py-4 px-2"
            >
              {Array.from({ length: numPages }, (_, i) => (
                <div key={i} className="bg-white shadow-md rounded-sm shrink-0">
                  <Page
                    pageNumber={i + 1}
                    width={getScrollPageWidth()}
                    renderTextLayer={false}
                    renderAnnotationLayer={true}
                    className="pdf-page-render [&_.react-pdf__Page__annotations]:absolute [&_.react-pdf__Page__annotations]:inset-0 [&_.react-pdf__Page__annotations]:z-[1000] [&_.react-pdf__Page__annotations_a]:pointer-events-auto"
                  />
                </div>
              ))}
            </div>
          )}
        </Document>
      </div>

      {/* Footer controls — only show page nav in flipbook mode */}
      {activeMode === 'flipbook' && (
        <div className="flex items-center justify-center gap-4 py-3 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrev}
            disabled={currentPage === 0}
            className="rounded-xl h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground font-medium min-w-[80px] text-center">
            {displayPage} / {numPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNext}
            disabled={currentPage >= numPages - 1}
            className="rounded-xl h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {activeMode === 'scroll' && (
        <div className="flex items-center justify-center py-3 shrink-0">
          <span className="text-sm text-muted-foreground font-medium">
            {numPages} page{numPages !== 1 ? 's' : ''} — scroll to read
          </span>
        </div>
      )}
    </div>
  );
}

/** Wrapper that catches flipbook render errors and triggers fallback */
function FlipbookRenderer({
  numPages, pageWidth, pageHeight, flipBookRef, onFlip, onError,
}: {
  numPages: number;
  pageWidth: number;
  pageHeight: number;
  flipBookRef: React.RefObject<any>;
  onFlip: (e: any) => void;
  onError: () => void;
}) {
  useEffect(() => {
    // If the flipbook component fails to mount, catch it
    const timeout = setTimeout(() => {
      if (!flipBookRef.current?.pageFlip()) {
        console.warn('Flipbook failed to initialize, switching to scroll mode');
        onError();
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [flipBookRef, onError]);

  try {
    return (
      <div className="flipbook-container" style={{ perspective: '2000px' }}>
        {/* @ts-ignore - react-pageflip typing issues */}
        <HTMLFlipBook
          ref={flipBookRef}
          width={pageWidth}
          height={pageHeight}
          size="fixed"
          minWidth={280}
          maxWidth={600}
          minHeight={400}
          maxHeight={800}
          showCover={true}
          maxShadowOpacity={0.4}
          mobileScrollSupport={true}
          onFlip={onFlip}
          className="flipbook-shadow"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={600}
          usePortrait={false}
          startZIndex={0}
          autoSize={false}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <FlipPage key={i} pageNumber={i + 1} width={pageWidth} height={pageHeight} />
          ))}
        </HTMLFlipBook>
      </div>
    );
  } catch (err) {
    console.error('Flipbook render error:', err);
    onError();
    return null;
  }
}
