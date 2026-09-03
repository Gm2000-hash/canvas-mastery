import { type Editor } from '@tiptap/react';
import { useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Quote, Code2, Minus, Link2, Unlink, Image as ImageIcon,
  Undo2, Redo2, Highlighter, Palette, Type, ChevronDown,
  ListChecks, Table as TableIcon, Lightbulb, ChevronRight,
  Frame, Code, Eye, AlertTriangle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { isAllowedEmbedUrl, sanitizeRichHtml } from '@/modules/curriculum/lib/sanitize-rich-html';
import { urlToEmbedSrc } from './RichTextEditor';

interface RichTextToolbarProps {
  editor: Editor;
  compact?: boolean;
  minimal?: boolean;
}

const COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#374151', label: 'Gray 700' },
  { value: '#6b7280', label: 'Gray 500' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' },
];

const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: 'Yellow' },
  { value: '#bbf7d0', label: 'Green' },
  { value: '#bfdbfe', label: 'Blue' },
  { value: '#fecaca', label: 'Red' },
  { value: '#e9d5ff', label: 'Purple' },
  { value: '#fed7aa', label: 'Orange' },
];

function ToolBtn({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md ${active ? 'bg-accent text-accent-foreground' : ''}`}
            onClick={onClick}
            disabled={disabled}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

export function RichTextToolbar({ editor, compact = false, minimal = false }: RichTextToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedCode, setEmbedCode] = useState('');
  const [embedHeight, setEmbedHeight] = useState('480');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedTab, setEmbedTab] = useState<'html' | 'preview'>('html');

  const setLink = useCallback(() => {
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setLinkUrl('');
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const insertImage = useCallback(() => {
    if (imageUrl.trim()) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
    }
    setImageUrl('');
    setImageOpen(false);
  }, [editor, imageUrl]);

  // Parse the HTML/URL in the textarea into a validated embed spec.
  const parsedEmbed = useMemo(() => {
    const raw = embedCode.trim();
    if (!raw) return { src: null as string | null, error: null as string | null };

    // Tolerant: match the opening <iframe ...> tag and grab its src.
    // Works for self-closing iframes, iframes without </iframe>, and code that
    // includes surrounding <script> tags (H5P provides both).
    const iframeMatch = raw.match(/<iframe\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
    let src: string | null = null;
    if (iframeMatch) {
      src = iframeMatch[1];
    } else if (/^https?:\/\/\S+$/i.test(raw)) {
      src = urlToEmbedSrc(raw);
    }

    if (!src) return { src: null, error: 'Couldn\u2019t find an iframe or recognizable URL.' };
    if (!isAllowedEmbedUrl(src)) {
      let host = src;
      try { host = new URL(src).hostname; } catch { /* noop */ }
      return { src: null, error: `Host "${host}" isn\u2019t on the embed allowlist.` };
    }
    return { src, error: null };
  }, [embedCode]);

  const openEmbedDialog = useCallback(() => {
    // If currently inside an embed node, prefill for editing.
    if (editor.isActive('embed')) {
      const attrs = editor.getAttributes('embed') as any;
      if (attrs?.src) {
        setEmbedCode(
          `<iframe src="${attrs.src}" width="${attrs.width ?? '100%'}" height="${attrs.height ?? 480}" title="${attrs.title ?? 'Embedded content'}" allowfullscreen></iframe>`,
        );
        setEmbedHeight(String(attrs.height ?? 480));
        setEmbedTitle(attrs.title ?? '');
      }
    }
    setEmbedTab('html');
    setEmbedOpen(true);
  }, [editor]);

  const insertEmbed = useCallback(() => {
    if (!parsedEmbed.src) return;
    const heightNum = parseInt(embedHeight, 10) || 480;
    (editor.chain().focus() as any)
      .setEmbed({
        src: parsedEmbed.src,
        width: '100%',
        height: heightNum,
        title: embedTitle.trim() || 'Embedded content',
      })
      .run();
    setEmbedCode('');
    setEmbedTitle('');
    setEmbedHeight('480');
    setEmbedOpen(false);
  }, [editor, parsedEmbed, embedHeight, embedTitle]);

  const previewHtml = useMemo(() => {
    if (!parsedEmbed.src) return '';
    const h = parseInt(embedHeight, 10) || 480;
    return sanitizeRichHtml(
      `<iframe src="${parsedEmbed.src}" width="100%" height="${h}" title="${(embedTitle || 'Embedded content').replace(/"/g, '&quot;')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;border:0;border-radius:12px;background:#000;"></iframe>`,
    );
  }, [parsedEmbed, embedHeight, embedTitle]);

  const activeHeading = editor.isActive('heading', { level: 1 })
    ? 'H1'
    : editor.isActive('heading', { level: 2 })
    ? 'H2'
    : editor.isActive('heading', { level: 3 })
    ? 'H3'
    : editor.isActive('heading', { level: 4 })
    ? 'H4'
    : 'Normal';

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-border bg-muted/30 px-1.5 py-1">
      {/* Undo / Redo */}
      <ToolBtn icon={Undo2} label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
      <ToolBtn icon={Redo2} label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />

      <Sep />

      {/* Headings */}
      {!minimal && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2 min-w-[70px] justify-between">
                <Type className="h-3.5 w-3.5" />
                {activeHeading}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className={!editor.isActive('heading') ? 'bg-accent' : ''}>
                Normal text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}>
                <Heading1 className="h-4 w-4 mr-2" /> Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}>
                <Heading2 className="h-4 w-4 mr-2" /> Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''}>
                <Heading3 className="h-4 w-4 mr-2" /> Heading 3
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={editor.isActive('heading', { level: 4 }) ? 'bg-accent' : ''}>
                <Heading4 className="h-4 w-4 mr-2" /> Heading 4
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Sep />
        </>
      )}

      {/* Inline formatting */}
      <ToolBtn icon={Bold} label="Bold (⌘B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolBtn icon={Italic} label="Italic (⌘I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolBtn icon={UnderlineIcon} label="Underline (⌘U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolBtn icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />

      <Sep />

      {/* Text Color */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Text color">
            <Palette className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-2">
          <div className="grid grid-cols-5 gap-1">
            {COLORS.map(c => (
              <button
                key={c.value}
                className="h-6 w-6 rounded-md border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c.value }}
                title={c.label}
                onClick={() => editor.chain().focus().setColor(c.value).run()}
              />
            ))}
          </div>
          <button
            className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-left px-1"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            Reset color
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Highlight */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Highlight">
            <Highlighter className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-2">
          <div className="grid grid-cols-3 gap-1">
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.value}
                className="h-6 w-10 rounded-md border border-border hover:scale-110 transition-transform text-[9px]"
                style={{ backgroundColor: c.value }}
                title={c.label}
                onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-left px-1"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            Remove highlight
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      {minimal && <div className="flex-1" />}

      {!minimal && (
        <>
          <Sep />

          {/* Lists */}
          <ToolBtn icon={List} label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <ToolBtn icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
          <ToolBtn icon={ListChecks} label="To-do list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />

          {!compact && (
            <>
              <Sep />

              {/* Alignment */}
              <ToolBtn icon={AlignLeft} label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
              <ToolBtn icon={AlignCenter} label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
              <ToolBtn icon={AlignRight} label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
            </>
          )}

          <Sep />

          {/* Block inserts */}
          <ToolBtn icon={Quote} label="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
          {!compact && (
            <>
              <ToolBtn icon={Code2} label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
              <ToolBtn icon={Minus} label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
              <ToolBtn
                icon={Lightbulb}
                label="Callout"
                active={editor.isActive('callout')}
                onClick={() => {
                  if (editor.isActive('callout')) (editor.chain().focus() as any).unsetCallout().run();
                  else (editor.chain().focus() as any).setCallout({ icon: '💡', tone: 'info' }).run();
                }}
              />
              <ToolBtn
                icon={ChevronRight}
                label="Toggle / details"
                active={editor.isActive('details')}
                onClick={() => (editor.chain().focus() as any).setDetails().run()}
              />
              <ToolBtn
                icon={TableIcon}
                label="Insert table"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              />
            </>
          )}

          <Sep />

          {/* Link */}
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${editor.isActive('link') ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => {
                  const previousUrl = editor.getAttributes('link').href || '';
                  setLinkUrl(previousUrl);
                  setLinkOpen(true);
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-2" align="start">
              <p className="text-xs font-medium">Insert Link</p>
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && setLink()}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={setLink}>Apply</Button>
                {editor.isActive('link') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}
                  >
                    <Unlink className="h-3 w-3" /> Remove
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Image */}
          {!compact && (
            <Popover open={imageOpen} onOpenChange={setImageOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-2" align="start">
                <p className="text-xs font-medium">Insert Image URL</p>
                <Input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                  onKeyDown={e => e.key === 'Enter' && insertImage()}
                />
                <Button size="sm" className="h-7 text-xs" onClick={insertImage}>Insert</Button>
              </PopoverContent>
            </Popover>
          )}

          {/* Embed (H5P / iframe) — Canvas-style HTML / Preview modal */}
          {!minimal && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${editor.isActive('embed') ? 'bg-accent text-accent-foreground' : ''}`}
                title="Embed (H5P, YouTube, Padlet…)"
                onClick={openEmbedDialog}
              >
                <Frame className="h-3.5 w-3.5" />
              </Button>
              <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
                <DialogContent className="max-w-3xl z-[150]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Frame className="h-4 w-4" />
                      {editor.isActive('embed') ? 'Edit embed' : 'Insert embed'}
                    </DialogTitle>
                    <DialogDescription>
                      Paste an <code className="text-[11px]">&lt;iframe&gt;</code> embed code or a URL.
                      Switch to <strong>Preview</strong> to confirm it loads, then insert.
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs value={embedTab} onValueChange={(v) => setEmbedTab(v as 'html' | 'preview')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="html" className="gap-2">
                        <Code className="h-3.5 w-3.5" /> HTML
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="gap-2">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="html" className="space-y-3 mt-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Source</Label>
                        <Textarea
                          rows={12}
                          value={embedCode}
                          onChange={(e) => setEmbedCode(e.target.value)}
                          placeholder={'<iframe src="https://h5p.org/h5p/embed/…" width="100%" height="480" allowfullscreen></iframe>\n\nor a single URL:\nhttps://www.youtube.com/watch?v=…'}
                          className="text-xs font-mono leading-relaxed"
                          spellCheck={false}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Title (optional)</Label>
                          <Input
                            value={embedTitle}
                            onChange={(e) => setEmbedTitle(e.target.value)}
                            placeholder="Embedded content"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Height (px)</Label>
                          <Input
                            value={embedHeight}
                            onChange={(e) => setEmbedHeight(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="480"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      {embedCode.trim() && (
                        parsedEmbed.error ? (
                          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{parsedEmbed.error}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span>Recognized: <code className="text-[11px]">{parsedEmbed.src}</code>. Switch to Preview, then Insert.</span>
                          </div>
                        )
                      )}
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Allowed providers: H5P, YouTube, Vimeo, Loom, Edpuzzle, Padlet, Wordwall,
                        Quizizz, Desmos, GeoGebra, PhET, Google Docs/Slides/Forms, CodePen, Figma,
                        LearningApps.
                      </p>
                    </TabsContent>

                    <TabsContent value="preview" className="mt-3">
                      {parsedEmbed.error || !parsedEmbed.src ? (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p className="font-medium">Can't preview this embed</p>
                            <p className="text-xs opacity-90">
                              {parsedEmbed.error ?? 'Paste an iframe or supported URL in the HTML tab first.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="rounded-lg border border-border bg-muted/30 p-2 min-h-[320px]"
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                      )}
                    </TabsContent>
                  </Tabs>

                  <DialogFooter className="gap-2 sm:gap-2">
                    {editor.isActive('embed') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mr-auto text-destructive hover:text-destructive"
                        onClick={() => {
                          editor.chain().focus().deleteSelection().run();
                          setEmbedOpen(false);
                        }}
                      >
                        Remove embed
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEmbedOpen(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={insertEmbed} disabled={!parsedEmbed.src}>
                      {editor.isActive('embed') ? 'Update' : 'Insert'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </>
      )}
    </div>
  );
}
