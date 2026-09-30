import { describe, expect, test } from "bun:test";
import {
  arrowBlockNav,
  arrowDirection,
  caretForNeighbor,
  consumeLeadingSpace,
  hasTwoLeadingSpaces,
  shouldBulletOnSpace,
  shouldIndentOnSpace,
  shouldLeaveBlockOnArrow,
} from "../src/outliner-space";

function indentSubtree(
  blocks: { indent: number; text: string }[],
  index: number,
  delta: number,
): boolean {
  if (delta > 0) {
    if (index === 0) return false;
    if (blocks[index].indent >= blocks[index - 1].indent + 1) return false;
  } else if (delta < 0) {
    if (blocks[index].indent <= 0) return false;
  } else return false;
  blocks[index].indent += delta;
  if (index === 0) blocks[index].indent = 0;
  return true;
}

describe("shouldIndentOnSpace (two spaces == indent)", () => {
  test("first space at start does not indent yet", () => {
    expect(shouldIndentOnSpace("", 0)).toBe(false);
    expect(shouldIndentOnSpace("hello", 0)).toBe(false);
    expect(shouldIndentOnSpace("hello", 1)).toBe(false);
  });

  test("second space (or caret in existing leading space) indents", () => {
    expect(shouldIndentOnSpace(" ", 1)).toBe(true);
    expect(shouldIndentOnSpace(" ", 0)).toBe(true);
    expect(shouldIndentOnSpace("  Child", 0)).toBe(true);
  });

  test("list marker space is not indent", () => {
    expect(shouldIndentOnSpace("-", 1)).toBe(false);
    expect(shouldBulletOnSpace("-", 1)).toBe(true);
  });
});

describe("consumeLeadingSpace", () => {
  test("strips leading spaces and nests under previous sibling", () => {
    const blocks = [
      { indent: 0, text: "Parent" },
      { indent: 0, text: "  Child" },
    ];
    expect(consumeLeadingSpace(blocks, 1, indentSubtree)).toBe(true);
    expect(blocks[1].indent).toBe(1);
    expect(blocks[1].text).toBe("Child");
  });

  test("consumes a single pending leading space on the second key", () => {
    const blocks = [
      { indent: 0, text: "Parent" },
      { indent: 0, text: " " },
    ];
    expect(consumeLeadingSpace(blocks, 1, indentSubtree)).toBe(true);
    expect(blocks[1].indent).toBe(1);
    expect(blocks[1].text).toBe("");
  });

  test("root block cannot nest; still strips spaces", () => {
    const blocks = [{ indent: 0, text: "  First" }];
    expect(consumeLeadingSpace(blocks, 0, indentSubtree)).toBe(true);
    expect(blocks[0].indent).toBe(0);
    expect(blocks[0].text).toBe("First");
  });

  test("hasTwoLeadingSpaces detects paste of space-space", () => {
    expect(hasTwoLeadingSpaces("  x")).toBe(true);
    expect(hasTwoLeadingSpaces(" x")).toBe(false);
    expect(hasTwoLeadingSpaces("")).toBe(false);
  });
});

describe("arrowBlockNav (Rails parity)", () => {
  test("directions", () => {
    expect(arrowDirection("ArrowUp")).toBe(-1);
    expect(arrowDirection("ArrowDown")).toBe(1);
    expect(arrowDirection("Enter")).toBe(0);
    expect(caretForNeighbor(-1, 12)).toBe(12);
    expect(caretForNeighbor(1, 12)).toBe(0);
  });

  test("single-line blocks always leave", () => {
    expect(shouldLeaveBlockOnArrow({
      direction: 1, atFirstVisualLine: false, atLastVisualLine: false, singleVisualLine: true,
    })).toBe(true);
  });

  test("leave / within / edge", () => {
    expect(arrowBlockNav({
      key: "ArrowDown", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true,
    })).toEqual({ action: "leave", index: 1, direction: 1 });
    expect(arrowBlockNav({
      key: "ArrowDown", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: false,
    })).toEqual({ action: "within" });
    expect(arrowBlockNav({
      key: "ArrowUp", index: 1, length: 3, atFirstVisualLine: true, atLastVisualLine: false,
    })).toEqual({ action: "leave", index: 0, direction: -1 });
    expect(arrowBlockNav({
      key: "ArrowUp", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true,
    })).toEqual({ action: "edge" });
    expect(arrowBlockNav({
      key: "ArrowDown", shiftKey: true, index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true,
    })).toBeNull();
  });
});
