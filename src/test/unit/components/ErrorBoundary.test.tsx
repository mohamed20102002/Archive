/**
 * ErrorBoundary Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, ErrorFallback } from '@renderer/components/common/ErrorBoundary'

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalError
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child content</div>
      </ErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders error fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows error message in details', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    // Click to show details
    const showDetailsBtn = screen.getByText('Show details')
    fireEvent.click(showDetailsBtn)

    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls[0][0].message).toBe('Test error')
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error UI</div>}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.getByText('Custom Error UI')).toBeInTheDocument()
  })

  it('renders correct UI for page level errors', () => {
    render(
      <ErrorBoundary level="page">
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Page Error')).toBeInTheDocument()
  })

  it('renders correct UI for critical level errors', () => {
    render(
      <ErrorBoundary level="critical">
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Application Error')).toBeInTheDocument()
    expect(screen.getByText('Reload Application')).toBeInTheDocument()
  })

  it('can retry after error', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Click Try Again - this resets the error boundary state
    const retryBtn = screen.getByText('Try Again')
    fireEvent.click(retryBtn)

    // After retry, if we rerender with non-throwing component, it should work
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })
})

describe('ErrorFallback', () => {
  it('renders component level fallback', () => {
    render(
      <ErrorFallback
        error={new Error('Test error')}
        errorInfo={null}
        level="component"
      />
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders page level fallback', () => {
    render(
      <ErrorFallback
        error={new Error('Test error')}
        errorInfo={null}
        level="page"
      />
    )

    expect(screen.getByText('Page Error')).toBeInTheDocument()
  })

  it('renders critical level fallback', () => {
    render(
      <ErrorFallback
        error={new Error('Test error')}
        errorInfo={null}
        level="critical"
      />
    )

    expect(screen.getByText('Application Error')).toBeInTheDocument()
    expect(screen.getByText('A critical error has occurred. Please reload the application.')).toBeInTheDocument()
  })

  it('calls onRetry when Try Again is clicked', () => {
    const onRetry = vi.fn()

    render(
      <ErrorFallback
        error={new Error('Test error')}
        errorInfo={null}
        level="component"
        onRetry={onRetry}
      />
    )

    const retryBtn = screen.getByText('Try Again')
    fireEvent.click(retryBtn)

    expect(onRetry).toHaveBeenCalled()
  })

  it('calls onReload when Reload Application is clicked', () => {
    const onReload = vi.fn()

    render(
      <ErrorFallback
        error={new Error('Test error')}
        errorInfo={null}
        level="critical"
        onReload={onReload}
      />
    )

    const reloadBtn = screen.getByText('Reload Application')
    fireEvent.click(reloadBtn)

    expect(onReload).toHaveBeenCalled()
  })

  it('toggles error details visibility', () => {
    render(
      <ErrorFallback
        error={new Error('Detailed error message')}
        errorInfo={null}
        level="component"
      />
    )

    // Details should be hidden initially
    expect(screen.queryByText('Detailed error message')).not.toBeInTheDocument()

    // Click to show details
    const showBtn = screen.getByText('Show details')
    fireEvent.click(showBtn)

    // Details should now be visible
    expect(screen.getByText('Detailed error message')).toBeInTheDocument()
    expect(screen.getByText('Hide details')).toBeInTheDocument()

    // Click to hide details
    fireEvent.click(screen.getByText('Hide details'))
    expect(screen.queryByText('Detailed error message')).not.toBeInTheDocument()
  })
})
