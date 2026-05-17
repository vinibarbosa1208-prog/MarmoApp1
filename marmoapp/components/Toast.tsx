'use client'

import { useApp } from '@/contexts/AppContext'

export default function Toast() {
  const { toastMsg } = useApp()

  if (!toastMsg) return null

  return (
    <div
      id="toast"
      className="show"
      style={{
        borderLeftColor:
          toastMsg.type === 'err' ? 'var(--red)'
          : toastMsg.type === 'ok2' ? 'var(--green)'
          : 'var(--gold)',
      }}
    >
      {toastMsg.msg}
    </div>
  )
}
