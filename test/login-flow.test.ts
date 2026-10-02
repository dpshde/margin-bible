import { describe, expect, test } from "bun:test";
import { decideLogin } from "../src/login-flow";
import { passkeySettings } from "../src/passkeys";

const current = "current-library";

describe("login decision", () => {
  test("a recovery code binds that library and can fold in guest notes", () => {
    expect(
      decideLogin({
        claimLibraryId: "claimed",
        claimBound: false,
        matchedLibraryId: null,
        currentLibraryId: current,
        currentBound: false,
        currentNoteCount: 3,
        confirmCreate: false,
      }),
    ).toEqual({ kind: "claim", libraryId: "claimed", mergeFrom: current });
  });

  test("a recovery code for a bound library is rejected", () => {
    const decision = decideLogin({
      claimLibraryId: "claimed",
      claimBound: true,
      matchedLibraryId: "claimed",
      currentLibraryId: current,
      currentBound: false,
      currentNoteCount: 0,
      confirmCreate: false,
    });
    expect(decision.kind).toBe("reject");
  });

  test("a known passphrase opens that library", () => {
    expect(
      decideLogin({
        claimLibraryId: null,
        claimBound: false,
        matchedLibraryId: "known",
        currentLibraryId: current,
        currentBound: false,
        currentNoteCount: 2,
        confirmCreate: false,
      }),
    ).toEqual({ kind: "open", libraryId: "known", mergeFrom: current });
  });

  test("guest notes bind in place when the phrase is new", () => {
    expect(
      decideLogin({
        claimLibraryId: null,
        claimBound: false,
        matchedLibraryId: null,
        currentLibraryId: current,
        currentBound: false,
        currentNoteCount: 1,
        confirmCreate: false,
      }).kind,
    ).toBe("bind-current");
  });

  test("an empty miss asks before creating a library", () => {
    expect(
      decideLogin({
        claimLibraryId: null,
        claimBound: false,
        matchedLibraryId: null,
        currentLibraryId: current,
        currentBound: false,
        currentNoteCount: 0,
        confirmCreate: false,
      }).kind,
    ).toBe("confirm-create");
    expect(
      decideLogin({
        claimLibraryId: null,
        claimBound: false,
        matchedLibraryId: null,
        currentLibraryId: current,
        currentBound: true,
        currentNoteCount: 4,
        confirmCreate: true,
      }).kind,
    ).toBe("create");
  });
});

describe("passkey host gate", () => {
  test("uses the request host when no relying party is configured", () => {
    expect(passkeySettings({}, "https://margin.bible/login")).toEqual({
      rpID: "margin.bible",
      origin: "https://margin.bible",
    });
    expect(passkeySettings({}, "https://margin-bible.dpshade.workers.dev/login")).toEqual({
      rpID: "margin-bible.dpshade.workers.dev",
      origin: "https://margin-bible.dpshade.workers.dev",
    });
    expect(passkeySettings({}, "http://localhost:8791/login")).toEqual({
      rpID: "localhost",
      origin: "http://localhost:8791",
    });
  });

  test("stays off for a bare public suffix, an IP, and plain http", () => {
    expect(passkeySettings({}, "https://workers.dev/login")).toBeNull();
    expect(passkeySettings({}, "https://pages.dev/login")).toBeNull();
    expect(passkeySettings({}, "https://127.0.0.1/login")).toBeNull();
    expect(passkeySettings({}, "http://margin.bible/login")).toBeNull();
    expect(
      passkeySettings(
        { WEBAUTHN_RP_ID: "workers.dev", WEBAUTHN_ORIGIN: "https://margin-bible.dpshade.workers.dev" },
        "https://margin-bible.dpshade.workers.dev/login",
      ),
    ).toBeNull();
  });

  test("turns on for the configured site origin", () => {
    expect(
      passkeySettings(
        { WEBAUTHN_RP_ID: "margin.bible", WEBAUTHN_ORIGIN: "https://margin.bible" },
        "https://margin.bible/login",
      ),
    ).toEqual({ rpID: "margin.bible", origin: "https://margin.bible" });
    expect(
      passkeySettings(
        { WEBAUTHN_RP_ID: "margin.bible", WEBAUTHN_ORIGIN: "https://margin.bible" },
        "https://margin-bible.dpshade.workers.dev/login",
      ),
    ).toBeNull();
  });
});
