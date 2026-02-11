// Global event system for notifying components when data changes
// This allows components to refresh their data without prop drilling

export type DataChangeType = 'topic' | 'record' | 'letter' | 'mom' | 'issue' | 'user' | 'all'

export interface DataChangeEvent {
  type: DataChangeType
  action: 'create' | 'update' | 'delete'
  id?: string
}

// Dispatch this event from any component after mutating data
export function notifyDataChanged(type: DataChangeType, action: 'create' | 'update' | 'delete' = 'update', id?: string): void {
  const event = new CustomEvent('app-data-changed', {
    detail: { type, action, id } as DataChangeEvent
  })
  window.dispatchEvent(event)
}

// Subscribe to data changes
export function onDataChanged(callback: (event: DataChangeEvent) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<DataChangeEvent>
    callback(customEvent.detail)
  }
  window.addEventListener('app-data-changed', handler)
  return () => window.removeEventListener('app-data-changed', handler)
}

// Helper to subscribe to specific types of changes
export function onDataTypeChanged(types: DataChangeType[], callback: (event: DataChangeEvent) => void): () => void {
  return onDataChanged((event) => {
    if (types.includes(event.type) || types.includes('all') || event.type === 'all') {
      callback(event)
    }
  })
}
