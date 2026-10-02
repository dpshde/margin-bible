/**
 * How a passphrase submit resolves.
 * A matching phrase opens that library. A guest library with notes binds in place.
 * An empty miss asks the person to confirm before a typo becomes a new library.
 * A recovery code binds the phrase onto that library once.
 */
export type LoginDecision =
  | { kind: "claim"; libraryId: string; mergeFrom: string | null }
  | { kind: "open"; libraryId: string; mergeFrom: string | null }
  | { kind: "bind-current" }
  | { kind: "create" }
  | { kind: "confirm-create" }
  | { kind: "reject"; error: string };

export function decideLogin(input: {
  claimLibraryId: string | null;
  claimBound: boolean;
  matchedLibraryId: string | null;
  currentLibraryId: string;
  currentBound: boolean;
  currentNoteCount: number;
  confirmCreate: boolean;
}): LoginDecision {
  if (input.claimLibraryId) {
    if (input.claimBound) {
      return { kind: "reject", error: "That library already has a passphrase. Sign in with it." };
    }
    return {
      kind: "claim",
      libraryId: input.claimLibraryId,
      mergeFrom: guestMerge(input, input.claimLibraryId),
    };
  }
  if (input.matchedLibraryId) {
    return {
      kind: "open",
      libraryId: input.matchedLibraryId,
      mergeFrom: guestMerge(input, input.matchedLibraryId),
    };
  }
  if (!input.currentBound && input.currentNoteCount > 0) return { kind: "bind-current" };
  if (!input.confirmCreate) return { kind: "confirm-create" };
  if (!input.currentBound) return { kind: "bind-current" };
  return { kind: "create" };
}

function guestMerge(
  input: { currentLibraryId: string; currentBound: boolean; currentNoteCount: number },
  targetId: string,
): string | null {
  if (input.currentLibraryId === targetId) return null;
  if (input.currentBound || input.currentNoteCount < 1) return null;
  return input.currentLibraryId;
}
