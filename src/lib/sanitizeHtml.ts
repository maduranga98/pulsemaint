import DOMPurify from 'dompurify';

/**
 * Sanitises author-written lesson HTML before it is rendered with
 * dangerouslySetInnerHTML. Lessons are written by managers and opened by every
 * trainee, so anything that can run script (script/iframe/object tags, inline
 * event handlers — quoted or not —, javascript: URLs, SVG/MathML payloads)
 * must never get through. This replaces an earlier regex filter that missed
 * unquoted handlers such as `<img src=x onerror=alert(1)>`.
 */
const FORBID_TAGS = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'base', 'meta', 'link', 'svg', 'math'];

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  // Links in a lesson open in a new tab and can never reach back to the app.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function escapeText(html: string): string {
  return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeHtml(html: string): string {
  // No DOM available (e.g. a non-browser environment): show the text, never markup.
  if (!DOMPurify.isSupported) return escapeText(html);
  ensureHook();
  return DOMPurify.sanitize(html, {
    FORBID_TAGS,
    FORBID_ATTR: ['style', 'srcdoc', 'formaction'],
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
  });
}
