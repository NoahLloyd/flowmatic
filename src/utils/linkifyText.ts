export interface TextSegment {
  type: "text";
  value: string;
}

export interface LinkSegment {
  type: "link";
  value: string;
  href: string;
}

export type LinkifiedSegment = TextSegment | LinkSegment;

const LINK_PATTERN =
  /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<]+)/gi;
const SIMPLE_TRAILING_PUNCTUATION = /[.,!?;:]+$/;

const normalizeHref = (value: string): string =>
  value.toLowerCase().startsWith("www.") ? `https://${value}` : value;

const hasUnmatchedClosingCharacter = (
  value: string,
  opening: string,
  closing: string,
): boolean =>
  value.split(closing).length - 1 > value.split(opening).length - 1;

const splitTrailingPunctuation = (
  value: string,
): { link: string; trailing: string } => {
  let link = value;
  let trailing = "";

  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  let changed = true;
  while (changed && link) {
    changed = false;

    const simpleMatch = link.match(SIMPLE_TRAILING_PUNCTUATION);
    if (simpleMatch) {
      trailing = simpleMatch[0] + trailing;
      link = link.slice(0, -simpleMatch[0].length);
      changed = true;
      continue;
    }

    for (const [opening, closing] of pairs) {
      if (
        link.endsWith(closing) &&
        hasUnmatchedClosingCharacter(link, opening, closing)
      ) {
        trailing = closing + trailing;
        link = link.slice(0, -1);
        changed = true;
        break;
      }
    }
  }

  return { link, trailing };
};

/**
 * Splits task text into plain text and safe web-link segments.
 * Supports bare http(s) URLs, www. links, and Markdown-style links.
 */
export const linkifyText = (text: string): LinkifiedSegment[] => {
  const segments: LinkifiedSegment[] = [];
  let cursor = 0;
  const matcher = new RegExp(LINK_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    const index = match.index;
    if (index > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, index) });
    }

    const markdownLabel = match[1];
    const matchedUrl = match[2] || match[3];
    const isMarkdownLink = Boolean(match[2]);
    const { link, trailing } = isMarkdownLink
      ? { link: matchedUrl, trailing: "" }
      : splitTrailingPunctuation(matchedUrl);

    if (link) {
      segments.push({
        type: "link",
        value: markdownLabel || link,
        href: normalizeHref(link),
      });
    }
    if (trailing) {
      segments.push({ type: "text", value: trailing });
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
};
