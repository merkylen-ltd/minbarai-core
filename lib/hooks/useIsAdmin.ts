'use client'

import { useState, useEffect } from 'react'

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/auth/is-admin')
      .then(r => r.json())
      .then(d => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [])

  return isAdmin
}
