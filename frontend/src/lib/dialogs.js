/**
 * Imperative confirm / toast dialogs (no window.confirm / alert).
 * Mount <AppDialogs /> once near the app root.
 */

let confirmState = null
let toastState = null
const listeners = new Set()

function emit() {
  for (const fn of listeners) fn()
}

export function subscribeDialogs(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getConfirmState() {
  return confirmState
}

export function getToastState() {
  return toastState
}

/**
 * @param {{
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} opts
 * @returns {Promise<boolean>}
 */
export function askConfirm(opts) {
  return new Promise((resolve) => {
    // Replace any pending confirm
    if (confirmState?.resolve) {
      confirmState.resolve(false)
    }
    confirmState = {
      title: opts.title || '',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel || 'OK',
      cancelLabel: opts.cancelLabel || 'Cancel',
      danger: Boolean(opts.danger),
      resolve: (value) => {
        confirmState = null
        emit()
        resolve(Boolean(value))
      },
    }
    emit()
  })
}

export function resolveConfirm(value) {
  if (!confirmState) return
  const { resolve } = confirmState
  confirmState = null
  emit()
  resolve(Boolean(value))
}

/**
 * Non-blocking notice (replaces window.alert).
 * @param {string} message
 * @param {{ durationMs?: number }} [opts]
 */
export function showToast(message, opts = {}) {
  const durationMs = opts.durationMs ?? 3200
  const id = Date.now() + Math.random()
  toastState = { id, message: String(message || '') }
  emit()
  window.setTimeout(() => {
    if (toastState?.id === id) {
      toastState = null
      emit()
    }
  }, durationMs)
}

export function dismissToast() {
  toastState = null
  emit()
}
