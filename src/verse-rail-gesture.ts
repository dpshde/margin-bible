/** Touch vs mouse on the verse rail.
 * A finger pan must keep scrolling the chapter. Mouse scrubbing stays immediate.
 */

export const RAIL_TOUCH_SLOP = 10;

export function railDownAction(pointerType: string): "scrub" | "watch" {
  return pointerType === "touch" ? "watch" : "scrub";
}

/** While a touch is only being watched: stay pending inside the slop.
 * Any real move is a chapter drag — vertical pan or a finger leaving the rail.
 * Callers scroll that drag with the finger (railPanScrollDelta). They must not
 * preventDefault, capture the pointer, or scrub to the verse under the finger.
 */
export function railWatchMove(dx: number, dy: number, slop = RAIL_TOUCH_SLOP): "pending" | "chapter" {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return "pending";
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return "pending";
  return "chapter";
}

/** Finger-down is a negative scroll delta so the chapter follows the finger.
 * A fixed rail does not receive the document pan, so the caller applies this.
 */
export function railPanScrollDelta(previousY: number, clientY: number): number {
  if (!Number.isFinite(previousY) || !Number.isFinite(clientY)) return 0;
  return previousY - clientY;
}

/** A touch that ends without becoming a chapter drag jumps to that verse.
 * If the page moved, the finger was scrolling — never turn that into a jump.
 */
export function railWatchEnd(input: {
  type: string;
  dx: number;
  dy: number;
  decided: boolean;
  scrolled?: boolean;
  slop?: number;
}): "jump" | "ignore" {
  if (input.decided || input.scrolled) return "ignore";
  if (input.type !== "pointerup") return "ignore";
  const slop = input.slop ?? RAIL_TOUCH_SLOP;
  if (!Number.isFinite(input.dx) || !Number.isFinite(input.dy)) return "ignore";
  if (Math.abs(input.dx) < slop && Math.abs(input.dy) < slop) return "jump";
  return "ignore";
}
