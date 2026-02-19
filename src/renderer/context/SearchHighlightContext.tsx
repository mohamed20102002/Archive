import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface SearchHighlight {
  type: 'topic' | 'record' | 'letter' | 'mom' | 'mom_action' | 'issue' | 'credential' | 'secure_reference' | 'contact' | 'authority' | null
  id: string | null
  parentId?: string | null
}

interface SearchHighlightContextType {
  highlight: SearchHighlight
  setHighlight: (highlight: SearchHighlight) => void
  clearHighlight: () => void
  isHighlighted: (type: string, id: string) => boolean
}

const SearchHighlightContext = createContext<SearchHighlightContextType | null>(null)

export function SearchHighlightProvider({ children }: { children: React.ReactNode }) {
  const [highlight, setHighlightState] = useState<SearchHighlight>({ type: null, id: null })
  const location = useLocation()

  // Read highlight from location state when navigation occurs
  useEffect(() => {
    const state = location.state as any
    if (state?.highlightType && state?.highlightId) {
      setHighlightState({
        type: state.highlightType,
        id: state.highlightId,
        parentId: state.highlightParentId
      })

      // Auto-clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightState({ type: null, id: null })
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [location.state])

  const setHighlight = useCallback((newHighlight: SearchHighlight) => {
    setHighlightState(newHighlight)
  }, [])

  const clearHighlight = useCallback(() => {
    setHighlightState({ type: null, id: null })
  }, [])

  const isHighlighted = useCallback((type: string, id: string) => {
    return highlight.type === type && highlight.id === id
  }, [highlight])

  return (
    <SearchHighlightContext.Provider value={{ highlight, setHighlight, clearHighlight, isHighlighted }}>
      {children}
    </SearchHighlightContext.Provider>
  )
}

export function useSearchHighlight() {
  const context = useContext(SearchHighlightContext)
  if (!context) {
    throw new Error('useSearchHighlight must be used within a SearchHighlightProvider')
  }
  return context
}
