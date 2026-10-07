/**
 * Preview-only guest library seed.
 *
 * The preview worker sets PREVIEW_SEED=1. A guest with no verse group yet
 * gets a handful of real notes, each pointing at two or more verses, so the
 * inbox can show webs on first open. Signed-in libraries are left alone.
 * There is no "Save sample" control.
 *
 * A saved title is left as typed. An empty title is named once, automatically,
 * from the verse texts via TypeSafe Jev (TYPESAFE_API_KEY). That pass does
 * not use src/jev-topics.ts, and it does not run again after auto_titled is set.
 */
import type { Attachment } from "./attachments";
import { saveNote } from "./library";
import type { NoteDraft } from "./notes";
import { parsePassage, passageOsis, passageSlug } from "./passage";
import { handleVerseGroupAction } from "./verse-groups-store";
import { realVerseGroups, type GroupNote } from "./verse-groups";

type SeedWeb = {
  hub: string;
  members: string[];
  text: string;
  title?: string;
  description?: string;
};

const PREVIEW_WEBS: readonly SeedWeb[] = [
  {
    hub: "rom.8.28",
    members: ["rom.8.31", "rom.8.32", "rom.8.38", "rom.8.39"],
    text: "All things work together for good.",
    title: "Nothing can separate",
    description: "The love of God holds this chain.",
  },
  {
    hub: "jhn.1.1",
    members: ["jhn.1.3", "jhn.1.14"],
    text: "The Word was with God, and the Word was God.",
    title: "The Word",
  },
  {
    hub: "psa.23.1",
    members: ["psa.23.2", "psa.23.4", "psa.23.6"],
    text: "The Lord is my shepherd.",
    title: "The shepherd",
  },
  {
    hub: "eph.2.8",
    members: ["eph.2.9", "eph.2.10", "rom.3.23", "rom.6.23", "tit.3.5"],
    text: "By grace you have been saved, through faith.",
    title: "By grace",
    description: "Grace, not a wage.",
  },
  {
    hub: "heb.12.6",
    members: ["heb.12.7", "pro.3.12", "rev.3.19"],
    text: "The Lord disciplines the one he loves.",
    title: "The Lord disciplines those he loves",
  },
  {
    hub: "php.4.11",
    members: ["php.4.12", "php.4.13", "1ti.6.6"],
    text: "I have learned to be content.",
    title: "Content in every circumstance",
  },
  {
    hub: "rom.5.3",
    members: ["rom.5.4", "rom.5.5", "jas.1.2", "jas.1.3", "jas.1.4"],
    text: "Suffering produces perseverance.",
    title: "Suffering produces perseverance",
    description: "Suffering, perseverance, character, hope.",
  },
  {
    hub: "est.4.14",
    members: ["gen.50.20", "psa.37.5"],
    text: "For such a time as this.",
    title: "Providence",
  },
  {
    hub: "mat.11.28",
    members: ["mat.11.29", "jhn.7.37"],
    text: "Come to me, all who labor.",
    title: "Come to me",
  },
  {
    hub: "mat.5.3",
    members: ["mat.5.4", "mat.5.6", "mat.5.8"],
    text: "Blessed are the poor in spirit.",
    title: "Poor in spirit",
  },
];

export function previewSeedNotes(): NoteDraft[] {
  return PREVIEW_WEBS.map((web) => noteForWeb(web));
}

function noteForWeb(web: SeedWeb): NoteDraft {
  const passage = parsePassage(web.hub);
  if (!passage || passage.verseStart == null) throw new Error(`seed hub ${web.hub}`);
  const attachments: Attachment[] = web.members.map((slug, index) => ({
    id: seedAttachmentId(web.hub, index),
    kind: "xref",
    slug,
    title: slug,
    source: "manual",
  }));
  return {
    slug: passageSlug(passage),
    osis: passageOsis(passage),
    kind: passage.kind,
    book: passage.book,
    chapter: passage.chapter,
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
    blocks: [{ id: seedBlockId(web.hub), indent: 0, text: web.text, bullet: true }],
    bookmarked: false,
    attachments,
  };
}

function seedAttachmentId(hub: string, index: number): string {
  const compact = hub.replaceAll(".", "").slice(0, 8);
  return `att_${compact}${index}`.slice(0, 20);
}

function seedBlockId(hub: string): string {
  return `b_seed_${hub.replaceAll(".", "")}`;
}

/** True when this library already has a web. Seeding then would add a second mesh. */
export function previewSeedNeeded(notes: readonly GroupNote[]): boolean {
  return realVerseGroups(notes).length === 0;
}

export async function seedPreviewVerseGroups(
  db: D1Database,
  libraryId: string,
  notes: readonly GroupNote[],
): Promise<boolean> {
  if (!previewSeedNeeded(notes)) return false;
  for (const note of previewSeedNotes()) {
    await saveNote(db, libraryId, note);
  }
  for (const web of PREVIEW_WEBS) {
    if (!web.title && !web.description) continue;
    const saved = await handleVerseGroupAction(db, libraryId, {
      action: "save",
      hub: web.hub,
      title: web.title ?? "",
      description: web.description ?? "",
    });
    if (!saved.ok) throw new Error(saved.error);
  }
  return true;
}
