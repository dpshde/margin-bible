// Prefer the browser / password-manager passkey, then phone, then a security key.
// Chrome's modal picker otherwise opens on hybrid (QR) and never offers GPM/iCloud.
export const PASSKEY_HINTS = [ "client-device", "hybrid", "security-key" ]

export async function register(options) {
  const publicKey = prepareCreationOptions(options)
  const credential = await navigator.credentials.create({ publicKey })

  return {
    id: credential.id,
    client_data_json: bufferToBase64url(credential.response.clientDataJSON),
    attestation_object: bufferToBase64url(credential.response.attestationObject),
    transports: credential.response.getTransports?.() || []
  }
}

export async function authenticate(options, { signal, mediation } = {}) {
  const publicKey = prepareRequestOptions(options)
  const request = { publicKey }
  if (signal) request.signal = signal
  if (mediation) request.mediation = mediation

  const credential = await navigator.credentials.get(request)

  return {
    id: credential.id,
    client_data_json: bufferToBase64url(credential.response.clientDataJSON),
    authenticator_data: bufferToBase64url(credential.response.authenticatorData),
    signature: bufferToBase64url(credential.response.signature)
  }
}

export function prepareCreationOptions(options) {
  const withHints = applyPasskeyHints(options)
  return {
    ...withHints,
    challenge: base64urlToBuffer(withHints.challenge),
    user: { ...withHints.user, id: base64urlToBuffer(withHints.user.id) },
    excludeCredentials: (withHints.excludeCredentials || []).map(cred => ({
      ...cred,
      id: base64urlToBuffer(cred.id)
    }))
  }
}

export function prepareRequestOptions(options) {
  const withHints = applyPasskeyHints(options)
  const prepared = {
    ...withHints,
    challenge: base64urlToBuffer(withHints.challenge)
  }

  if (withHints.allowCredentials?.length) {
    prepared.allowCredentials = withHints.allowCredentials.map(cred => ({
      ...cred,
      id: base64urlToBuffer(cred.id)
    }))
  } else {
    delete prepared.allowCredentials
  }

  return prepared
}

function applyPasskeyHints(options) {
  return options.hints?.length ? options : { ...options, hints: PASSKEY_HINTS }
}

function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  const padding = "=".repeat((4 - base64url.length % 4) % 4)
  const binary = atob(base64 + padding)
  return Uint8Array.from(binary, c => c.charCodeAt(0)).buffer
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
