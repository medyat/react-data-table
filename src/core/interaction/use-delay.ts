// Yazmayı bırakınca uygulama (04 §3, §5: 250 ms): her çağrı öncekini iptal eder; bileşen sökülünce bekleyen iş düşer.
import { useEffect, useRef } from 'react'

export function useDelay(ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return {
    run: (fn: () => void) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(fn, ms)
    },
    cancel: () => clearTimeout(timer.current),
  }
}
