import {
  burnPassphraseTime,
  hashClaimToken,
  hashPassphrase,
  passphraseLookup,
  validatePassphrase,
  verifyPassphrase,
} from "./auth";
import {
  bindPassphrase,
  copyNotes,
  createSession,
  deleteOtherSessions,
  deleteSession,
  deleteUnboundLibrary,
  findLibraryByClaim,
  findLibraryByLookup,
  insertBoundLibrary,
  loginBlocked,
  readCurrentLibrary,
  recordLoginFailure,
  replacePassphrase,
} from "./auth-store";
import { decideLogin, type LoginDecision } from "./login-flow";

export type LoginSuccess = { ok: true; sessionId: string; libraryId: string };
export type LoginFailure = { ok: false; status: 422 | 429 | 500; error: string; confirmCreate?: boolean };

export async function performLogin(
  db: D1Database,
  input: {
    pepper: string;
    passphrase: string;
    label: string | null;
    claimToken: string;
    confirmCreate: boolean;
    currentLibraryId: string;
    currentSessionId: string;
    ip: string;
  },
): Promise<LoginSuccess | LoginFailure> {
  if (!input.pepper) return { ok: false, status: 500, error: "Sign-in is not configured." };
  if (await loginBlocked(db, input.ip)) {
    return { ok: false, status: 429, error: "Too many attempts. Wait a few minutes and try again." };
  }

  const current = await readCurrentLibrary(db, input.currentLibraryId);
  if (!current) return { ok: false, status: 500, error: "This browser session has no library." };

  const claimToken = input.claimToken.trim();
  const claim = claimToken ? await findLibraryByClaim(db, await hashClaimToken(input.pepper, claimToken)) : null;
  if (claimToken && !claim) {
    await recordLoginFailure(db, input.ip);
    return { ok: false, status: 422, error: "Recovery code was not recognized." };
  }

  const lookup = await passphraseLookup(input.pepper, input.passphrase);
  const matched = await findLibraryByLookup(db, lookup);
  if (matched) {
    const valid = await verifyPassphrase(input.passphrase, matched.salt, matched.hash, matched.iterations);
    if (!valid) {
      await recordLoginFailure(db, input.ip);
      return { ok: false, status: 422, error: "Passphrase did not match." };
    }
  } else {
    await burnPassphraseTime(input.passphrase);
  }

  if (claim && matched && matched.id !== claim.id) {
    return { ok: false, status: 422, error: "That passphrase already opens a different library." };
  }

  const decision = decideLogin({
    claimLibraryId: claim?.id ?? null,
    claimBound: claim?.bound ?? false,
    matchedLibraryId: matched?.id ?? null,
    currentLibraryId: current.id,
    currentBound: current.bound,
    currentNoteCount: current.noteCount,
    confirmCreate: input.confirmCreate,
  });

  if (decision.kind === "reject") {
    await recordLoginFailure(db, input.ip);
    return { ok: false, status: 422, error: decision.error };
  }
  if (decision.kind === "confirm-create") {
    await recordLoginFailure(db, input.ip);
    return {
      ok: false,
      status: 422,
      confirmCreate: true,
      error: "No library uses that passphrase. Enter it again to create a new library.",
    };
  }

  let libraryId: string;
  try {
    libraryId =
      decision.kind === "open"
        ? decision.libraryId
        : await applyDecision(db, decision, current.id, await passphraseFields(input.passphrase, lookup), input.label);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const existing = await findLibraryByLookup(db, lookup);
    if (!existing) return { ok: false, status: 422, error: "That passphrase is already in use." };
    libraryId = existing.id;
  }

  const mergeFrom = decision.kind === "claim" || decision.kind === "open" ? decision.mergeFrom : null;
  if (mergeFrom) {
    await copyNotes(db, mergeFrom, libraryId);
    await deleteUnboundLibrary(db, mergeFrom);
  } else if (current.id !== libraryId && !current.bound && current.noteCount === 0) {
    await deleteUnboundLibrary(db, current.id);
  }

  const sessionId = await createSession(db, libraryId);
  if (sessionId !== input.currentSessionId) await deleteSession(db, input.currentSessionId);
  return { ok: true, sessionId, libraryId };
}

export async function performPassphraseChange(
  db: D1Database,
  input: {
    pepper: string;
    currentPassphrase: string;
    passphrase: string;
    confirmPassphrase: string;
    libraryId: string;
    currentSessionId: string;
    ip: string;
  },
): Promise<LoginSuccess | LoginFailure> {
  if (!input.pepper) return { ok: false, status: 500, error: "Sign-in is not configured." };
  if (await loginBlocked(db, input.ip)) {
    return { ok: false, status: 429, error: "Too many attempts. Wait a few minutes and try again." };
  }

  const next = validatePassphrase(input.passphrase);
  if (!next.ok) return { ok: false, status: 422, error: next.error };
  const confirm = validatePassphrase(input.confirmPassphrase);
  if (!confirm.ok) return { ok: false, status: 422, error: "Enter the new passphrase again." };
  if (next.passphrase !== confirm.passphrase) {
    return { ok: false, status: 422, error: "Enter the new passphrase the same way in both fields." };
  }

  const current = validatePassphrase(input.currentPassphrase);
  if (!current.ok) {
    await recordLoginFailure(db, input.ip);
    return { ok: false, status: 422, error: "Current passphrase did not match." };
  }
  if (current.passphrase === next.passphrase) {
    return { ok: false, status: 422, error: "Choose a different passphrase." };
  }

  const currentLookup = await passphraseLookup(input.pepper, current.passphrase);
  const currentMatch = await findLibraryByLookup(db, currentLookup);
  if (!currentMatch || currentMatch.id !== input.libraryId) {
    await burnPassphraseTime(current.passphrase);
    await recordLoginFailure(db, input.ip);
    return { ok: false, status: 422, error: "Current passphrase did not match." };
  }
  const valid = await verifyPassphrase(
    current.passphrase,
    currentMatch.salt,
    currentMatch.hash,
    currentMatch.iterations,
  );
  if (!valid) {
    await recordLoginFailure(db, input.ip);
    return { ok: false, status: 422, error: "Current passphrase did not match." };
  }

  const lookup = await passphraseLookup(input.pepper, next.passphrase);
  const taken = await findLibraryByLookup(db, lookup);
  if (taken) {
    await recordLoginFailure(db, input.ip);
    return {
      ok: false,
      status: 422,
      error: taken.id === input.libraryId
        ? "Choose a different passphrase."
        : "Another library already uses that passphrase.",
    };
  }

  const fields = await passphraseFields(next.passphrase, lookup);
  let replaced = false;
  try {
    replaced = await replacePassphrase(db, input.libraryId, currentLookup, fields);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    await recordLoginFailure(db, input.ip);
    return { ok: false, status: 422, error: "Another library already uses that passphrase." };
  }
  if (!replaced) {
    return {
      ok: false,
      status: 422,
      error: "The passphrase changed while this was saving. Sign in again and retry.",
    };
  }
  const sessionId = await createSession(db, input.libraryId);
  await deleteOtherSessions(db, input.libraryId, sessionId);
  return { ok: true, sessionId, libraryId: input.libraryId };
}

async function applyDecision(
  db: D1Database,
  decision: Exclude<LoginDecision, { kind: "reject" } | { kind: "confirm-create" } | { kind: "open" }>,
  currentLibraryId: string,
  fields: { lookup: string; salt: string; hash: string; iterations: number },
  label: string | null,
): Promise<string> {
  if (decision.kind === "create") return insertBoundLibrary(db, { ...fields, label });
  const target = decision.kind === "claim" ? decision.libraryId : currentLibraryId;
  const bound = await bindPassphrase(db, target, { ...fields, label });
  if (!bound) throw new Error("UNIQUE library already bound");
  return target;
}

async function passphraseFields(passphrase: string, lookup: string) {
  const hashed = await hashPassphrase(passphrase);
  return { lookup, salt: hashed.salt, hash: hashed.hash, iterations: hashed.iterations };
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE/i.test(error.message);
}
