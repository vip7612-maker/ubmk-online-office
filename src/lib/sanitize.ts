import sanitizeHtml from "sanitize-html";

/**
 * 글 본문은 편집기가 만든 HTML이고, 그걸 쓰는 사람은 교직원 누구나가 될 수 있다.
 * 그러므로 저장할 때와 내려보낼 때 두 번 걸러 낸다. 허용 목록에 없는 것은 전부 버린다.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "div", "span",
    "h1", "h2", "h3", "h4",
    "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    "*": ["style", "class"],
  },
  // http/https 와 data: 이미지만. javascript: 같은 것은 통과하지 못한다.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  // 글자색·형광펜·정렬만 남기고 나머지 style 은 버린다.
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(([^)]*)\)$/, /^[a-zA-Z]+$/],
      "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(([^)]*)\)$/, /^[a-zA-Z]+$/],
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  // 바깥 링크는 새 창으로, 그리고 opener 를 끊는다.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
  // 편집기가 남긴 빈 문단은 줄바꿈으로서 의미가 있으므로 지우지 않는다.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** 목록의 미리보기나 검색에 쓸 수 있도록 태그를 걷어낸 평문. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
