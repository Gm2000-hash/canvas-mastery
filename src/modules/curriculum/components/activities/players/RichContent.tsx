import katex from "katex";
import "katex/dist/katex.min.css";
import { sanitizeRichHtml } from "@/modules/curriculum/lib/sanitize-rich-html";

interface Props {
  html: string;
  className?: string;
}

/**
 * Renders rich text HTML content safely using DOMPurify-sanitized markup.
 * Automatically detects and renders LaTeX math ($...$, $$...$$).
 * Falls back to plain text display if content doesn't contain HTML tags or math.
 */
export function RichContent({ html, className = "" }: Props) {
  // Process LaTeX math first
  const processed = renderMathInText(html);

  const isHTML = /<[a-z][\s\S]*>/i.test(processed);

  if (!isHTML) {
    return <p className={`text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed ${className}`}>{html}</p>;
  }

  const clean = sanitizeRichHtml(processed, {
    extraTags: ["span", "math", "semantics", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "msqrt", "mover", "munder", "mtext", "annotation"],
    extraAttrs: ["target", "class", "aria-hidden", "xmlns", "encoding"],
  });

  return (
    <div
      className={`prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function renderMathInText(text: string): string {
  // Display math: $$...$$
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<code>${formula}</code>`;
    }
  });

  // Inline math: $...$
  result = result.replace(/\$([^\$\n]+?)\$/g, (_match, formula) => {
    if (/^\d+(\.\d+)?$/.test(formula.trim())) {
      return `$${formula}$`;
    }
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<code>${formula}</code>`;
    }
  });

  return result;
}
