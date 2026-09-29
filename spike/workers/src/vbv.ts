export function shouldShowExpandedTray({
  expanding = false,
  selected = false,
  collapsed = false,
  hasContent = false,
}: {
  expanding?: boolean;
  selected?: boolean;
  collapsed?: boolean;
  hasContent?: boolean;
} = {}): boolean {
  if (collapsed) return false;
  if (selected) return true;
  if (!hasContent) return false;
  return expanding;
}

export function noteCoversVerse(
  note: { kind: string; verseStart: number | null; verseEnd: number | null },
  verse: number,
): boolean {
  if (note.kind === "chapter" || note.verseStart == null) return false;
  const last = note.verseEnd ?? note.verseStart;
  return verse >= note.verseStart && verse <= last;
}
