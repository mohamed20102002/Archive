import React, { useState, useEffect, useCallback } from 'react'
import { ProcessFlowNode, ProcessFlowEdge, ProcessFlowData, ReferenceType } from '../../types'

interface ProcessFlowGraphProps {
  letterId: string
  onNodeClick?: (nodeId: string, nodeType: 'letter' | 'draft') => void
}

export function ProcessFlowGraph({ letterId, onNodeClick }: ProcessFlowGraphProps) {
  const [data, setData] = useState<ProcessFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([letterId]))

  useEffect(() => {
    loadData()
  }, [letterId])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.letterReferences.getProcessFlow(letterId)
      setData(result as ProcessFlowData | null)
      // Auto-expand root node
      setExpandedNodes(new Set([letterId]))
    } catch (error) {
      console.error('Error loading process flow:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const getNodeColor = (node: ProcessFlowNode): string => {
    if (node.type === 'draft') {
      if (node.is_final) return 'bg-green-100 border-green-400'
      if (node.status === 'approved') return 'bg-blue-100 border-blue-400'
      if (node.status === 'sent') return 'bg-purple-100 border-purple-400'
      return 'bg-gray-100 border-gray-300'
    }

    // Letter node
    switch (node.letter_type) {
      case 'incoming': return 'bg-blue-50 border-blue-400'
      case 'outgoing': return 'bg-green-50 border-green-400'
      case 'internal': return 'bg-purple-50 border-purple-400'
      default: return 'bg-gray-50 border-gray-300'
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      replied: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      archived: 'bg-purple-100 text-purple-800',
      draft: 'bg-gray-100 text-gray-800',
      review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      sent: 'bg-blue-100 text-blue-800',
      superseded: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getEdgeLabel = (type: ReferenceType | 'has_draft'): string => {
    switch (type) {
      case 'reply_to': return 'replies to'
      case 'related': return 'related to'
      case 'supersedes': return 'supersedes'
      case 'amends': return 'amends'
      case 'attachment_to': return 'attached to'
      case 'has_draft': return 'draft'
      default: return type
    }
  }

  const getNodeIcon = (node: ProcessFlowNode) => {
    if (node.type === 'draft') {
      return (
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    }

    switch (node.letter_type) {
      case 'incoming':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'outgoing':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )
      case 'internal':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p>No process flow data available</p>
      </div>
    )
  }

  // Group nodes by type for layout
  const rootNode = data.nodes.find(n => n.id === data.rootId)
  const draftNodes = data.nodes.filter(n => n.type === 'draft')
  const relatedLetters = data.nodes.filter(n => n.type === 'letter' && n.id !== data.rootId)

  // Get edges for the root node
  const outgoingEdges = data.edges.filter(e => e.source === data.rootId && e.type !== 'has_draft')
  const incomingEdges = data.edges.filter(e => e.target === data.rootId)

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-50 border border-blue-400 rounded" />
          <span>Incoming</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-50 border border-green-400 rounded" />
          <span>Outgoing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-50 border border-purple-400 rounded" />
          <span>Internal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded" />
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-400 rounded" />
          <span>Final Draft</span>
        </div>
      </div>

      {/* Main Letter Node */}
      {rootNode && (
        <div className="flex flex-col items-center">
          <div
            className={`border-2 rounded-lg p-4 min-w-[300px] cursor-pointer transition-shadow hover:shadow-md ${getNodeColor(rootNode)} ${rootNode.id === letterId ? 'ring-2 ring-primary-500' : ''}`}
            onClick={() => toggleNode(rootNode.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getNodeIcon(rootNode)}
                <span className="font-medium capitalize">{rootNode.letter_type || 'Letter'}</span>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(rootNode.status)}`}>
                {rootNode.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-900 font-medium line-clamp-2">{rootNode.subject}</p>
            {rootNode.reference_number && (
              <p className="text-xs font-mono text-gray-500 mt-1">{rootNode.reference_number}</p>
            )}
            {rootNode.date && (
              <p className="text-xs text-gray-400 mt-1">{new Date(rootNode.date).toLocaleDateString()}</p>
            )}
            <div className="flex items-center justify-center mt-2 text-xs text-gray-500">
              {expandedNodes.has(rootNode.id) ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span>Click to collapse</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>Click to expand</span>
                </>
              )}
            </div>
          </div>

          {/* Expanded content */}
          {expandedNodes.has(rootNode.id) && (
            <div className="mt-4 w-full">
              {/* Drafts Section */}
              {draftNodes.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Drafts ({draftNodes.length})
                  </h4>
                  <div className="flex flex-wrap gap-3 pl-4 border-l-2 border-gray-200">
                    {draftNodes.map((draft) => (
                      <div
                        key={draft.id}
                        className={`border rounded-lg p-3 min-w-[200px] cursor-pointer transition-shadow hover:shadow-md ${getNodeColor(draft)}`}
                        onClick={() => onNodeClick?.(draft.id, 'draft')}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">v{draft.version}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(draft.status)}`}>
                            {draft.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 line-clamp-1">{draft.subject}</p>
                        {draft.is_final && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Final
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referenced Letters (outgoing references) */}
              {outgoingEdges.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    References ({outgoingEdges.length})
                  </h4>
                  <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                    {outgoingEdges.map((edge) => {
                      const targetNode = data.nodes.find(n => n.id === edge.target)
                      if (!targetNode) return null
                      return (
                        <div key={edge.target} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 capitalize whitespace-nowrap">
                            {getEdgeLabel(edge.type)}
                          </span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <div
                            className={`flex-1 border rounded-lg p-2 cursor-pointer transition-shadow hover:shadow-md ${getNodeColor(targetNode)}`}
                            onClick={() => onNodeClick?.(targetNode.id, targetNode.type)}
                          >
                            <div className="flex items-center gap-2">
                              {getNodeIcon(targetNode)}
                              <span className="text-sm text-gray-900 line-clamp-1">{targetNode.subject}</span>
                            </div>
                            {targetNode.reference_number && (
                              <span className="text-xs font-mono text-gray-500">{targetNode.reference_number}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Referenced By (incoming references) */}
              {incomingEdges.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                    Referenced By ({incomingEdges.length})
                  </h4>
                  <div className="space-y-2 pl-4 border-l-2 border-green-200">
                    {incomingEdges.map((edge) => {
                      const sourceNode = data.nodes.find(n => n.id === edge.source)
                      if (!sourceNode) return null
                      return (
                        <div key={edge.source} className="flex items-center gap-3">
                          <div
                            className={`flex-1 border rounded-lg p-2 cursor-pointer transition-shadow hover:shadow-md ${getNodeColor(sourceNode)}`}
                            onClick={() => onNodeClick?.(sourceNode.id, sourceNode.type)}
                          >
                            <div className="flex items-center gap-2">
                              {getNodeIcon(sourceNode)}
                              <span className="text-sm text-gray-900 line-clamp-1">{sourceNode.subject}</span>
                            </div>
                            {sourceNode.reference_number && (
                              <span className="text-xs font-mono text-gray-500">{sourceNode.reference_number}</span>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="text-xs text-gray-500 capitalize whitespace-nowrap">
                            {getEdgeLabel(edge.type)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {draftNodes.length === 0 && outgoingEdges.length === 0 && incomingEdges.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No drafts or references for this letter
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
