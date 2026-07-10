import { useLocation } from 'react-router-dom'
import { useReducedMotion } from './useReducedMotion'

export default function ViewTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const reduced = useReducedMotion()
  return (
    <div key={location.pathname} className={reduced ? '' : 'anim-page'}>
      {children}
    </div>
  )
}
