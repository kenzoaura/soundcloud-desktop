import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, kind?: 'info' | 'error') => void
  dismiss: (id: number) => void
}

let seq = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    const id = seq++
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function pushToast(message: string, kind: 'info' | 'error' = 'info'): void {
  useToasts.getState().push(message, kind)
}
