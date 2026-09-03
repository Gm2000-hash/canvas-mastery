import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Details } from '@tiptap/extension-details';
import { DetailsSummary } from '@tiptap/extension-details-summary';
import { DetailsContent } from '@tiptap/extension-details-content';
import { Node, mergeAttributes } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { RichTextToolbar } from './RichTextToolbar';
import { isAllowedEmbedUrl } from '@/modules/curriculum/lib/sanitize-rich-html';

// Notion-style "callout" block — a styled wrapper containing block content
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      icon: { default: '💡' },
      tone: { default: 'info' }, // info | warn | success | danger
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const { icon, tone, ...rest } = HTMLAttributes as any;
    return [
      'div',
      mergeAttributes(rest, { 'data-callout': '', 'data-tone': tone, 'data-icon': icon, class: 'tk-callout' }),
      0,
    ];
  },
  addCommands() {
    return {
      setCallout:
        (attrs: { icon?: string; tone?: string } = {}) =>
        ({ commands }: any) =>
          commands.wrapIn(this.name, attrs),
      unsetCallout:
        () =>
        ({ commands }: any) =>
          commands.lift(this.name),
    } as any;
  },
});

// Embed block — iframe wrapper for H5P, YouTube, Vimeo, Padlet, Google Docs, etc.
function pickIframeAttrs(el: any) {
  return {
    src: el.getAttribute('src') || null,
    width: el.getAttribute('width') || '100%',
    height: el.getAttribute('height') || 480,
    allow:
      el.getAttribute('allow') ||
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
    allowfullscreen: el.getAttribute('allowfullscreen') ?? 'true',
    title: el.getAttribute('title') || 'Embedded content',
  };
}

const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      width: { default: '100%' },
      height: { default: 480 },
      allow: {
        default:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
      },
      allowfullscreen: { default: 'true' },
      title: { default: 'Embedded content' },
    };
  },
  parseHTML() {
    return [
      { tag: 'div[data-embed]', getAttrs: (el: any) => {
        const ifr = el.querySelector?.('iframe');
        if (!ifr) return false;
        const attrs = pickIframeAttrs(ifr);
        // Reject embeds whose src isn't on the allowlist — keeps
        // editor-state and reader-state in sync (no silent stripping later).
        if (!attrs.src || !isAllowedEmbedUrl(attrs.src)) return false;
        return attrs;
      } },
      { tag: 'iframe', getAttrs: (el: any) => {
        const attrs = pickIframeAttrs(el);
        if (!attrs.src || !isAllowedEmbedUrl(attrs.src)) return false;
        return attrs;
      } },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, width, height, allow, allowfullscreen, title } = HTMLAttributes as any;
    return [
      'div',
      { 'data-embed': '', class: 'tk-embed', style: 'position:relative;margin:1rem 0;' },
      [
        'iframe',
        mergeAttributes(
          { src, width, height, allow, allowfullscreen, title },
          {
            frameborder: '0',
            loading: 'lazy',
            referrerpolicy: 'strict-origin-when-cross-origin',
            style: 'width:100%;min-height:320px;border:0;border-radius:12px;background:#000;',
          },
        ),
      ],
    ];
  },
  addCommands() {
    return {
      setEmbed:
        (attrs: { src: string; width?: string | number; height?: string | number; title?: string }) =>
        ({ commands }: any) =>
          commands.insertContent({ type: this.name, attrs }),
    } as any;
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Compact mode hides some toolbar items for smaller fields */
  compact?: boolean;
  /** Minimal mode shows only inline formatting (bold/italic/underline) */
  minimal?: boolean;
  className?: string;
  /** If true, editor is not editable */
  readOnly?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  compact = false,
  minimal = false,
  className = '',
  readOnly = false,
}: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: minimal ? false : { levels: [1, 2, 3, 4] },
        bulletList: minimal ? false : undefined,
        orderedList: minimal ? false : undefined,
        blockquote: minimal ? false : undefined,
        codeBlock: minimal ? false : undefined,
        horizontalRule: minimal ? false : undefined,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ...(minimal
        ? []
        : [
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
            Image.configure({ inline: true }),
            TaskList.configure({ HTMLAttributes: { class: 'tk-task-list' } }),
            TaskItem.configure({ nested: true, HTMLAttributes: { class: 'tk-task-item' } }),
            Table.configure({ resizable: true, HTMLAttributes: { class: 'tk-table' } }),
            TableRow,
            TableHeader,
            TableCell,
            Details.configure({ HTMLAttributes: { class: 'tk-details' } }),
            DetailsSummary,
            DetailsContent,
            Callout,
            Embed,
          ]),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[60px] px-3 py-2 ${className}`,
      },
      handlePaste: (view, event) => {
        if (minimal) return false;
        const cb = event.clipboardData;
        if (!cb) return false;
        const text = (cb.getData('text/html') || cb.getData('text/plain') || '').trim();
        if (!text) return false;

        // Pasted iframe HTML
        const iframeMatch = text.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/i);
        if (iframeMatch) {
          const src = iframeMatch[1];
          if (!isAllowedEmbedUrl(src)) return false;
          const widthAttr = text.match(/\bwidth=["']([^"']+)["']/i)?.[1] || '100%';
          const heightAttr = text.match(/\bheight=["']([^"']+)["']/i)?.[1] || 480;
          const titleAttr = text.match(/\btitle=["']([^"']+)["']/i)?.[1] || 'Embedded content';
          (view as any).dispatch(
            view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.embed.create({ src, width: widthAttr, height: heightAttr, title: titleAttr }),
            ),
          );
          event.preventDefault();
          return true;
        }

        // Bare URL → try to convert to embed
        if (/^https?:\/\/\S+$/i.test(text)) {
          const embedSrc = urlToEmbedSrc(text);
          if (embedSrc && isAllowedEmbedUrl(embedSrc)) {
            (view as any).dispatch(
              view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.embed.create({ src: embedSrc }),
              ),
            );
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const currentHTML = editor.getHTML();
    if (content !== currentHTML) {
      isUpdatingRef.current = true;
      editor.commands.setContent(content);
      isUpdatingRef.current = false;
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!readOnly);
  }, [readOnly, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-input bg-background overflow-hidden">
      {!readOnly && <RichTextToolbar editor={editor} compact={compact} minimal={minimal} />}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Convert a known provider URL into its embeddable iframe src. */
export function urlToEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    // YouTube
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const id = u.searchParams.get('v') || u.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const id = u.pathname.match(/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === 'player.vimeo.com') return url;

    // Google Forms shortlink
    if (host === 'forms.gle') return url;

    // Generic — accept the URL itself if host is allowed (handles H5P embed URLs, Padlet, Wordwall, etc.)
    if (isAllowedEmbedUrl(url)) return url;
    return null;
  } catch {
    return null;
  }
}
