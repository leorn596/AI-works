/**
 * useInView — IntersectionObserver hook for lazy loading
 * @param {Object} options
 * @param {string} options.rootMargin - margin around root (default '200px')
 * @param {boolean} options.triggerOnce - only trigger once (default true)
 * @returns {{ ref, inView }}
 */
import { useState, useEffect, useRef, useCallback } from 'react'

const useInView = ({ rootMargin = '200px', triggerOnce = true } = {}) => {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  const callbackRef = useCallback(
    (entries) => {
      const [entry] = entries
      if (entry.isIntersecting) {
        setInView(true)
        // If triggerOnce, disconnect after first intersection
        if (triggerOnce && ref.current && observerRef.current) {
          observerRef.current.unobserve(ref.current)
        }
      } else if (!triggerOnce) {
        setInView(false)
      }
    },
    [triggerOnce]
  )

  const observerRef = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    observerRef.current = new IntersectionObserver(callbackRef, {
      rootMargin,
      threshold: 0,
    })

    observerRef.current.observe(node)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [rootMargin, callbackRef])

  return { ref, inView }
}

export default useInView
