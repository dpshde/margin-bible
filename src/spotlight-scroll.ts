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
