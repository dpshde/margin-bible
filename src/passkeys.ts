import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  createSession,
  deleteSession,
  ensureWebauthnUserId,
  findPasskey,
  listPasskeyIds,
  readCurrentLibrary,
  saveChallenge,
  savePasskey,
  takeChallenge,
  updatePasskeyCounter,
} from "./auth-store";

/** Bare public suffixes cannot be a WebAuthn relying party id. A host under them can. */
const PUBLIC_SUFFIX = new Set(["workers.dev", "pages.dev"]);

export function passkeySettings(
  env: { WEBAUTHN_RP_ID?: string; WEBAUTHN_ORIGIN?: string },
  requestUrl: string,
): { rpID: string; origin: string } | null {
  let request: URL;
  try {
    request = new URL(requestUrl);
  } catch {
    return null;
  }
  const host = request.hostname.toLowerCase();
  if (!webauthnHost(host, request.protocol)) return null;

  const configuredRp = env.WEBAUTHN_RP_ID?.trim().toLowerCase() ?? "";
  const configuredOrigin = env.WEBAUTHN_ORIGIN?.trim() ?? "";
  if (!configuredRp && !configuredOrigin) return { rpID: host, origin: request.origin };
  if (!configuredRp || !configuredOrigin || PUBLIC_SUFFIX.has(configuredRp)) return null;

  let origin: string;
  let configuredHost: string;
  try {
    const configured = new URL(configuredOrigin);
    origin = configured.origin;
    configuredHost = configured.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (request.origin !== origin || configuredHost !== host) return null;
  if (host !== configuredRp && !host.endsWith(`.${configuredRp}`)) return null;
  return { rpID: configuredRp, origin };
}

function webauthnHost(host: string, protocol: string): boolean {
  if (!host || PUBLIC_SUFFIX.has(host)) return false;
  if (host === "localhost") return protocol === "http:" || protocol === "https:";
  if (protocol !== "https:") return false;
  // An IP address cannot be a relying party id.
  if (host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  return host.includes(".");
}

export function readChallengeCookie(header: string | null): string | null {
  if (!header) return null;
  const match = /(?:^|;\s*)margin_pk=([0-9a-f-]{36})/i.exec(header);
  return match ? match[1].toLowerCase() : null;
}

export function challengeCookie(id: string, secure: boolean): string {
  return pkCookie(`margin_pk=${id}`, 300, secure);
}

export function clearChallengeCookie(secure: boolean): string {
  return pkCookie("margin_pk=", 0, secure);
}

export async function registrationOptions(
  db: D1Database,
  settings: { rpID: string; origin: string },
  libraryId: string,
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }> {
  const library = await readCurrentLibrary(db, libraryId);
  if (!library?.bound) throw new PasskeyError("Sign in with a passphrase before adding a passkey.", 401);
  const userHandle = await ensureWebauthnUserId(db, libraryId);
  const exclude = await listPasskeyIds(db, libraryId);
  const options = await generateRegistrationOptions({
    rpName: "Margin",
    rpID: settings.rpID,
    userName: library.label || "Margin",
    userID: bytesFromHex(userHandle),
    attestationType: "none",
    excludeCredentials: exclude.map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  const challengeId = crypto.randomUUID();
  await saveChallenge(db, { id: challengeId, libraryId, challenge: options.challenge, kind: "register" });
  return { options, challengeId };
}

export async function verifyRegistration(
  db: D1Database,
  settings: { rpID: string; origin: string },
  libraryId: string,
  challengeId: string | null,
  response: RegistrationResponseJSON,
): Promise<void> {
  if (!challengeId) throw new PasskeyError("Passkey challenge expired. Try again.", 422);
  const challenge = await takeChallenge(db, challengeId, "register");
  if (!challenge || challenge.libraryId !== libraryId) {
    throw new PasskeyError("Passkey challenge expired. Try again.", 422);
  }
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: settings.origin,
      expectedRPID: settings.rpID,
      requireUserVerification: true,
    });
  } catch (error) {
    console.error(JSON.stringify({ message: "passkey registration rejected" }));
    throw new PasskeyError("That passkey could not be verified.", 422, error);
  }
  if (!verified.verified) throw new PasskeyError("That passkey could not be verified.", 422);
  await savePasskey(db, {
    credentialId: verified.registrationInfo.credential.id,
    libraryId,
    publicKey: isoBase64URL.fromBuffer(verified.registrationInfo.credential.publicKey),
    signCount: verified.registrationInfo.credential.counter,
  });
}

export async function authenticationOptions(
  db: D1Database,
  settings: { rpID: string },
): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }> {
  const options = await generateAuthenticationOptions({
    rpID: settings.rpID,
    userVerification: "required",
  });
  const challengeId = crypto.randomUUID();
  await saveChallenge(db, { id: challengeId, libraryId: null, challenge: options.challenge, kind: "authenticate" });
  return { options, challengeId };
}

export async function verifyAuthentication(
  db: D1Database,
  settings: { rpID: string; origin: string },
  challengeId: string | null,
  response: AuthenticationResponseJSON,
  currentSessionId: string,
): Promise<string> {
  if (!challengeId) throw new PasskeyError("Passkey challenge expired. Try again.", 422);
  const challenge = await takeChallenge(db, challengeId, "authenticate");
  if (!challenge) throw new PasskeyError("Passkey challenge expired. Try again.", 422);
  const credential = await findPasskey(db, response.id);
  if (!credential) throw new PasskeyError("This passkey is not registered.", 422);
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: settings.origin,
      expectedRPID: settings.rpID,
      requireUserVerification: true,
      credential: {
        id: response.id,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.signCount,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ message: "passkey sign-in rejected" }));
    throw new PasskeyError("That passkey could not be verified.", 422, error);
  }
  if (!verified.verified) throw new PasskeyError("That passkey could not be verified.", 422);
  await updatePasskeyCounter(db, response.id, verified.authenticationInfo.newCounter);
  const sessionId = await createSession(db, credential.libraryId);
  if (sessionId !== currentSessionId) await deleteSession(db, currentSessionId);
  return sessionId;
}

export class PasskeyError extends Error {
  status: 401 | 422;
  constructor(message: string, status: 401 | 422, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.status = status;
  }
}

function pkCookie(pair: string, maxAge: number, secure: boolean): string {
  const parts = [pair, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function bytesFromHex(value: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(value.length / 2);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

type PublicKeyCredentialCreationOptionsJSON = Awaited<ReturnType<typeof generateRegistrationOptions>>;
type PublicKeyCredentialRequestOptionsJSON = Awaited<ReturnType<typeof generateAuthenticationOptions>>;
