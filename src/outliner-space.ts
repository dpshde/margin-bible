/** Rails outliner-blocks shouldIndentOnSpace / applySpaceIndent parity. */

export type IndentBlock = { indent: number; text: string };

export function shouldIndentOnSpace(text: string, offset: number): boolean {
  const value = String(text || "");
  const at = Number(offset);
  if (!Number.isFinite(at) || at < 0) return false;
  if (at === 1 && value.startsWith(" ")) return true;
  if (at === 0 && value.startsWith(" ")) return true;
  return false;
}

export function shouldBulletOnSpace(text: string, offset: number): boolean {
  const value = String(text || "");
  return offset === value.length && /^[-–—*+]$/.test(value);
}

/** Indent one level and strip leading spaces (two-space / space-space parity). */
export function consumeLeadingSpace<T extends IndentBlock>(
  blocks: T[],
  index: number,
  indentSubtree: (blocks: T[], index: number, delta: number) => boolean,
): boolean {
  if (!Array.isArray(blocks) || index < 0 || index >= blocks.length) return false;
  const block = blocks[index];
  const before = String(block.text || "");
  if (!before.startsWith(" ")) return false;
  block.text = before.replace(/^ +/, "");
  indentSubtree(blocks, index, 1);
  return true;
}

/** True when pasted/typed text already has two leading spaces to consume. */
export function hasTwoLeadingSpaces(text: string): boolean {
  return /^ {2}/.test(String(text || ""));
}

/** Rails outliner-blocks arrowBlockNav parity. */

export function arrowDirection(key: string): -1 | 1 | 0 {
  if (key === "ArrowUp") return -1;
  if (key === "ArrowDown") return 1;
  return 0;
}

export function neighborBlockIndex(index: number, direction: number, length: number): number {
  const next = index + direction;
  if (next < 0 || next >= length) return -1;
  return next;
}

export function shouldLeaveBlockOnArrow(input: {
  direction: number;
  atFirstVisualLine: boolean;
  atLastVisualLine: boolean;
  singleVisualLine?: boolean;
}): boolean {
  if (input.singleVisualLine) return true;
  if (input.direction < 0) return Boolean(input.atFirstVisualLine);
  if (input.direction > 0) return Boolean(input.atLastVisualLine);
  return false;
}

export function caretForNeighbor(direction: number, neighborTextLength: number): number {
  return direction < 0 ? neighborTextLength : 0;
}

export function arrowBlockNav(input: {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  index: number;
  length: number;
  atFirstVisualLine: boolean;
  atLastVisualLine: boolean;
  singleVisualLine?: boolean;
}): { action: "within" } | { action: "edge" } | { action: "leave"; index: number; direction: -1 | 1 } | null {
  if (input.shiftKey || input.altKey || input.metaKey || input.ctrlKey) return null;
  const direction = arrowDirection(input.key);
  if (!direction) return null;
  if (
    !shouldLeaveBlockOnArrow({
      direction,
      atFirstVisualLine: input.atFirstVisualLine,
      atLastVisualLine: input.atLastVisualLine,
      singleVisualLine: input.singleVisualLine,
    })
  ) {
    return { action: "within" };
  }
  const next = neighborBlockIndex(input.index, direction, input.length);
  if (next < 0) return { action: "edge" };
  return { action: "leave", index: next, direction };
}
