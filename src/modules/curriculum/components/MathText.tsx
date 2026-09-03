import katex from "katex";
import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";

interface MathTextProps {
  text: string;
  className?: string;
  /** If true, render as inline span instead of block div */
  inline?: boolean;
}

/**
 * Renders text that may contain LaTeX math delimiters ($...$, $$...$$)
 * and/or HTML markup. Math is rendered via KaTeX; HTML is sanitized.
 */
export function MathText({ text, className = "", inline = false }: MathTextProps) {
  if (!text) return null;

  const rendered = renderMathInText(text);
  const clean = DOMPurify.sanitize(rendered, {
    ADD_TAGS: ["span", "math", "semantics", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "msqrt", "mover", "munder", "mtext", "annotation"],
    ADD_ATTR: ["class", "style", "aria-hidden", "xmlns", "encoding"],
  });

  if (inline) {
    return (
      <span
        className={`math-text ${className}`}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  return (
    <div
      className={`math-text ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/**
 * Processes text to replace LaTeX delimiters with rendered KaTeX HTML.
 * Supports $$...$$ (display) and $...$ (inline).
 */
function renderMathInText(text: string): string {
  // First handle display math: $$...$$
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

  // Then handle inline math: $...$
  // Avoid matching currency like "$5" or "$10.00" by requiring non-digit after opening $
  result = result.replace(/\$([^\$\n]+?)\$/g, (_match, formula) => {
    // Skip if it looks like currency (just a number)
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
