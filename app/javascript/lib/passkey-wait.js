export const PASSKEY_WAIT_COPY = "Waiting for your passkey…"
export const PASSKEY_SETTLED_COPY = "Nothing popped up? That's okay."

export function passkeyWaitCopy({
  cancelled = false,
  failed = false,
  timedOut = false,
  supported = true
} = {}) {
  if (!supported || cancelled || failed || timedOut) return PASSKEY_SETTLED_COPY
  return PASSKEY_WAIT_COPY
}
