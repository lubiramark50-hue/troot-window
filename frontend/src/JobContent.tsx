import { createElement, type ReactNode } from "react";

/**
 * Employer feeds often provide HTML, while jobs posted on Troot Window are plain text.
 * Convert only a small set of semantic HTML elements into React elements: never
 * inject untrusted markup into the DOM or execute remote styles / scripts.
 */
const FORMATTING = /<\/?(?:p|div|section|article|br|ul|ol|li|h[1-6]|strong|b|em|i|a|span|blockquote|table|tr|td|th)\b/i;
const OMIT = new Set(["script", "style", "svg", "iframe", "object", "embed", "form", "input", "textarea", "select", "button", "link", "meta", "head", "noscript", "template", "img", "video", "audio"]);
const ALLOWED = new Set(["p", "br", "ul", "ol", "li", "strong", "em", "blockquote", "h3", "h4"]);

export function isFormattedJobText(text: string) {
  return FORMATTING.test(text);
}

function convertNode(node: ChildNode, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (OMIT.has(tag)) return null;
  const children = Array.from(element.childNodes).map((child, i) => convertNode(child, `${key}-${i}`));

  if (tag === "a") {
    const href = element.getAttribute("href")?.trim();
    // Remote employers can include links, but only absolute HTTPS/HTTP links
    // are safe and unambiguous. javascript:, data:, and relative URLs stay text.
    if (href && /^https?:\/\//i.test(href)) {
      try {
        const parsed = new URL(href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return createElement("a", { key, href: parsed.toString(), target: "_blank", rel: "noopener noreferrer nofollow" }, ...children);
        }
      } catch { /* invalid links become plain text */ }
    }
    return createElement("span", { key }, ...children);
  }
  // Imported ATS markup uses lots of generic wrappers and inline styles.
  // Map wrappers to readable paragraphs, without retaining arbitrary HTML props.
  const semanticTag = tag === "h1" || tag === "h2" ? "h3" : tag === "h5" || tag === "h6" ? "h4"
    : tag === "b" ? "strong" : tag === "i" ? "em"
    : tag === "div" || tag === "section" || tag === "article" ? "div"
    : tag === "table" || tag === "tbody" || tag === "thead" ? "div"
    : tag === "tr" ? "p" : tag === "td" || tag === "th" ? "span" : tag;
  if (ALLOWED.has(semanticTag) || semanticTag === "div" || semanticTag === "span") {
    return createElement(semanticTag, { key }, ...children);
  }
  // Unknown elements are flattened, not injected or styled.
  return createElement("span", { key }, ...children);
}

export function JobContent({ text }: { text: string }) {
  if (!text) return <p className="job-copy">No further details were supplied.</p>;
  if (!isFormattedJobText(text) || typeof DOMParser === "undefined") {
    return <p className="job-copy">{text}</p>;
  }
  const doc = new DOMParser().parseFromString(text, "text/html");
  return <div className="job-rich-content">{Array.from(doc.body.childNodes).map((node, i) => convertNode(node, String(i)))}</div>;
}
