import { marked } from 'marked';

/**
 * Render publisher-supplied README markdown to HTML.
 *
 * READMEs arrive from the database, so the output is sanitized before it reaches
 * `set:html`: script/style/iframe/object/embed elements are dropped, inline event
 * handlers are stripped, and `javascript:` URLs are neutralized.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown.trim()) return '';
  const html = marked.parse(markdown, { async: false }) as string;
  return sanitize(html);
}

function sanitize(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
}
