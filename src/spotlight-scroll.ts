/** Spotlight may center a verse once when it opens.
 * A later finger pan has to win: cancel the glide, and on a coarse pointer
 * drop the outliner caret so iOS does not pin that verse mid-screen.
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
  return {
    cancelGlide: true,
    releaseCaret: Boolean(input.coarse && input.editorFocused && !input.targetInEditor),
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
