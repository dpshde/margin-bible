/** Spotlight may center a verse once when it opens.
 * A later finger pan has to win. This is the note-focus stick after the
 * outliner opens, not the verse-rail scrub. iOS focus-zoom is already
 * handled by the 16px editor floor; the caret and the glide are what pin
 * the verse mid-screen.
 */

const PAN_SLOP = 10;

export function spotlightTouchAction(input: {
  dx: number;
  dy: number;
  coarse: boolean;
  editorFocused: boolean;
  targetInEditor: boolean;
  slop?: number;
}): { cancelGlide: boolean; releaseCaret: boolean } {
  const slop = input.slop ?? PAN_SLOP;
  const moved = Number.isFinite(input.dx) && Number.isFinite(input.dy)
    && (Math.abs(input.dx) >= slop || Math.abs(input.dy) >= slop);
  if (!moved) return { cancelGlide: false, releaseCaret: false };
  // A vertical drag on the note is a chapter scroll. A sideways drag can
  // still be a text selection, so the caret stays.
  const vertical = Math.abs(input.dy) > Math.abs(input.dx);
  return {
    cancelGlide: true,
    releaseCaret: Boolean(
      input.coarse && input.editorFocused && (!input.targetInEditor || vertical),
    ),
  };
}

/** Desktop still centers the caret line. A phone does not re-center after the open. */
export function spotlightFocusFollow(input: {
  placeInstant: boolean;
  coarse: boolean;
  userScrolling: boolean;
}): "consume-instant" | "hold" | "center" {
  if (input.placeInstant) return "consume-instant";
  if (input.coarse || input.userScrolling) return "hold";
  return "center";
}

const KEYBOARD_DROP = 140;
const KEYBOARD_SETTLE_MS = 500;
const KEYBOARD_CLOSE_RISE = 120;

export type SpotlightKeyboardFrame = {
  baseline: number | null;
  lowest: number | null;
  followed: boolean;
  openedAt: number | null;
  /** True while the soft keyboard is still opening, so the tray can clear it once. */
  opening: boolean;
};

/** Measure a keyboard open from the tall viewport. Later resizes are not a new open. */
export function spotlightKeyboardFrame(input: {
  baseline: number | null;
  lowest: number | null;
  height: number;
  followed: boolean;
  openedAt: number | null;
  now: number;
}): SpotlightKeyboardFrame {
  const height = input.height;
  const now = input.now;
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(now)) {
    return {
      baseline: input.baseline,
      lowest: input.lowest,
      followed: input.followed,
      openedAt: input.openedAt,
      opening: false,
    };
  }
  if (input.baseline == null) {
    return { baseline: height, lowest: null, followed: false, openedAt: null, opening: false };
  }
  if (input.followed && input.lowest != null && height >= input.lowest + KEYBOARD_CLOSE_RISE) {
    return { baseline: height, lowest: null, followed: false, openedAt: null, opening: false };
  }
  if (height > input.baseline) {
    return { baseline: height, lowest: null, followed: false, openedAt: null, opening: false };
  }
  if (input.baseline - height < KEYBOARD_DROP) {
    return {
      baseline: input.baseline,
      lowest: input.lowest,
      followed: input.followed,
      openedAt: input.openedAt,
      opening: false,
    };
  }
  const openedAt = input.openedAt ?? now;
  return {
    baseline: input.baseline,
    lowest: input.lowest == null ? height : Math.min(input.lowest, height),
    followed: true,
    openedAt,
    opening: now - openedAt <= KEYBOARD_SETTLE_MS,
  };
}

/** Spotlight ignores viewport scroll. On a phone, only the keyboard-open resize may move the page. */
export function spotlightViewportFollow(input: {
  spotlight: boolean;
  coarse: boolean;
  eventType: string;
  userScrolling: boolean;
  fingerDown: boolean;
  keyboardOpening: boolean;
}): "keep" | "ignore" {
  if (input.userScrolling) return "ignore";
  if (!input.spotlight) return "keep";
  if (input.eventType !== "resize") return "ignore";
  if (!input.coarse) return "keep";
  if (input.fingerDown || !input.keyboardOpening) return "ignore";
  return "keep";
}
