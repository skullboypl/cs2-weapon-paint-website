import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  dismissToast,
  getConfirmState,
  getToastState,
  resolveConfirm,
  subscribeDialogs,
} from '../lib/dialogs'
import '../styles/AppDialogs.css'

function useDialogStore(getter) {
  return useSyncExternalStore(subscribeDialogs, getter, () => null)
}

export default function AppDialogs() {
  const confirm = useDialogStore(getConfirmState)
  const toast = useDialogStore(getToastState)

  useEffect(() => {
    if (!confirm) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') resolveConfirm(false)
      if (e.key === 'Enter') resolveConfirm(true)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [confirm])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {confirm && (
        <div className="wp-dialog" role="presentation">
          <button
            type="button"
            className="wp-dialog__backdrop"
            aria-label={confirm.cancelLabel}
            onClick={() => resolveConfirm(false)}
          />
          <div
            className={
              confirm.danger ? 'wp-dialog__panel wp-dialog__panel--danger' : 'wp-dialog__panel'
            }
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wp-dialog-title"
            aria-describedby="wp-dialog-body"
          >
            {confirm.title ? (
              <h2 id="wp-dialog-title" className="wp-dialog__title">
                {confirm.title}
              </h2>
            ) : (
              <span id="wp-dialog-title" className="wp-dialog__sr">
                Confirm
              </span>
            )}
            <p id="wp-dialog-body" className="wp-dialog__body">
              {confirm.message}
            </p>
            <div className="wp-dialog__actions">
              <button
                type="button"
                className="wp-dialog__btn"
                onClick={() => resolveConfirm(false)}
              >
                {confirm.cancelLabel}
              </button>
              <button
                type="button"
                className={
                  confirm.danger
                    ? 'wp-dialog__btn wp-dialog__btn--danger'
                    : 'wp-dialog__btn wp-dialog__btn--primary'
                }
                onClick={() => resolveConfirm(true)}
                autoFocus
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="wp-toast" role="status" aria-live="polite">
          <p className="wp-toast__msg">{toast.message}</p>
          <button
            type="button"
            className="wp-toast__x"
            aria-label="OK"
            onClick={dismissToast}
          >
            ×
          </button>
        </div>
      )}
    </>,
    document.body,
  )
}
