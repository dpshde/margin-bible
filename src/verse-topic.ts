/**
 * Title suggestion for one verse group: BSB text of the hub and members,
 * then one Jev Choice. The starred chip is unchanged.
 */
import { nearestVerseTopic } from "./jev";
import { listNotes } from "./library";
import { canonSlug, cleanGroupTitle, type VerseGroupView } from "./verse-groups";
import { loadVerseGroups, saveJevTitle } from "./verse-groups-store";
import { bsbLinesForSlugs, type AssetFetch } from "./verse-text";

export type TopicSuggestion =
  | { ok: true; topic: string; group: VerseGroupView }
  | { ok: false; status: 422 | 502 | 503; error: string };

export async function suggestVerseGroupTopic(input: {
  db: D1Database;
  assets: AssetFetch;
  libraryId: string;
  hub: string;
  /** Title currently in the field. When it still matches Jev's title, TypeSafe is not called. */
  postedTitle?: unknown;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<TopicSuggestion> {
  const hub = canonSlug(input.hub);
  if (!hub) return { ok: false, status: 422, error: "unresolvable hub" };
  const notes = await listNotesSafe(input.db, input.libraryId);
  const group = notes.groups.find((row) => row.hub === hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  const posted = input.postedTitle === undefined ? group.title : cleanGroupTitle(input.postedTitle);
  if (group.titleFromJev && posted === group.title) {
    return { ok: true, topic: group.title, group };
  }
  const lines = await bsbLinesForSlugs(
    input.assets,
    group.members.map((member) => member.slug),
  );
  if (!lines.length) return { ok: false, status: 422, error: "Those verses have no text to read." };
  const takenTitles = notes.groups
    .filter((row) => row.hub !== hub)
    .map((row) => row.title);
  if (group.title.trim()) takenTitles.push(group.title);
  if (posted && posted !== group.title) takenTitles.push(posted);
  const topic = await nearestVerseTopic(lines, {
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
    takenTitles,
  });
  if (!topic.ok) return topic;
  await saveJevTitle(input.db, input.libraryId, hub, topic.topic);
  return { ok: true, topic: topic.topic, group: { ...group, title: topic.topic, titleFromJev: true } };
}

async function listNotesSafe(db: D1Database, libraryId: string): Promise<{ groups: VerseGroupView[] }> {
  const notes = await listNotes(db, libraryId);
  const groups = await loadVerseGroups(db, libraryId, notes);
  return { groups };
}
