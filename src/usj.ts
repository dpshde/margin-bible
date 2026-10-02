export type VerseRow = {
  v: number;
  text: string;
  heading?: string;
};

export type ChapterPack = {
  translation: "BSB";
  book: string;
  chapter: number;
  verses: VerseRow[];
  source: string;
  license: "public-domain";
};

export type UsjNode =
  | string
  | {
      type?: string;
      marker?: string;
      number?: string | number;
      content?: UsjNode[];
    };

export type UsjDocument = {
  type: string;
  version?: string;
  content: UsjNode[];
};

const SKIPPED_PARAS = new Set(["r", "b", "h", "mt1", "mt2", "toc1", "toc2", "toc3"]);

type WalkKind = "text" | "verse" | "s1" | "break" | "note";

function walk(nodes: UsjNode[] | UsjNode | undefined, visit: (kind: WalkKind, value: string | number) => void): void {
  const list = Array.isArray(nodes) ? nodes : nodes == null ? [] : [nodes];
  for (const node of list) walkNode(node, visit);
}

function walkNode(node: UsjNode, visit: (kind: WalkKind, value: string | number) => void): void {
  if (typeof node === "string") {
    visit("text", node);
    return;
  }
  const type = node.type;
  const marker = node.marker ?? "";
  if (type === "verse") {
    visit("verse", Number(node.number));
    return;
  }
  if (type === "para" && marker === "s1") {
    visit("s1", plainText(node.content));
    return;
  }
  if (type === "para" && SKIPPED_PARAS.has(marker)) return;
  if (type === "note") {
    visit("note", "");
    return;
  }
  // Poetry and lists are one paragraph per line, and the line break is not a space character.
  if (type === "para") visit("break", "");
  walk(node.content, visit);
}

export function plainText(nodes: UsjNode[] | undefined): string {
  const parts: string[] = [];
  walk(nodes, (kind, value) => {
    if (kind === "text") parts.push(String(value));
  });
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function chapterNodes(doc: UsjDocument, chapter: number): UsjNode[] {
  const nodes = doc.content ?? [];
  const start = nodes.findIndex((node) => chapterMilestone(node, chapter));
  if (start < 0) return [];
  const rest = nodes.slice(start + 1);
  const stop = rest.findIndex((node) => chapterMilestone(node));
  return stop < 0 ? rest : rest.slice(0, stop);
}

function chapterMilestone(node: UsjNode, number?: number): boolean {
  if (typeof node === "string" || node.type !== "chapter") return false;
  if (number == null) return true;
  return Number(node.number) === number;
}

export function verseRows(nodes: UsjNode[]): VerseRow[] {
  let heading: string | null = null;
  let current: VerseRow | null = null;
  let pendingNote = false;
  const rows: VerseRow[] = [];

  const visit = (kind: WalkKind, value: string | number) => {
    if (kind === "s1") {
      pendingNote = false;
      heading = String(value);
      return;
    }
    if (kind === "verse") {
      pendingNote = false;
      current = { v: Number(value), text: "" };
      if (heading) current.heading = heading;
      heading = null;
      rows.push(current);
      return;
    }
    if (kind === "break") {
      pendingNote = false;
      if (current) current.text += " ";
      return;
    }
    if (kind === "note") {
      pendingNote = true;
      return;
    }
    if (kind === "text" && current) {
      let chunk = String(value);
      if (pendingNote && /^[A-Za-z]/.test(chunk) && !/\s$/.test(current.text)) chunk = ` ${chunk}`;
      pendingNote = false;
      current.text += chunk;
    }
  };

  for (const node of nodes) walkNode(node, visit);

  for (const row of rows) {
    // A few BSB text nodes omit the space after punctuation ("sons:This", "LORD,which").
    row.text = row.text.replace(/\s+/g, " ").replace(/([,;:.!?])([A-Za-z])/g, "$1 $2").trim();
    if (!row.heading) delete row.heading;
  }
  return rows.filter((row) => row.v >= 1 && row.text.length > 0);
}

export function packChapter(
  book: string,
  chapter: number,
  doc: UsjDocument,
  source: string,
): ChapterPack | null {
  const nodes = chapterNodes(doc, chapter);
  if (nodes.length === 0) return null;
  return {
    translation: "BSB",
    book: book.toUpperCase(),
    chapter,
    verses: verseRows(nodes),
    source,
    license: "public-domain",
  };
}
