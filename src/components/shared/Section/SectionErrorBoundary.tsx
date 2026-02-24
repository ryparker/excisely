'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CircleAlert, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Section Error]', error, info.componentStack)
  }

  private handleRetry = () => {
    this.props.onReset?.()
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center">
          <CircleAlert className="size-8 text-muted-foreground/40" />
          <div className="max-w-xs space-y-1">
            <p className="font-heading text-sm font-semibold">
              This section encountered an issue
            </p>
            <p className="text-xs text-muted-foreground">
              We&apos;re looking into it. Try refreshing to see if the problem
              has been resolved.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={this.handleRetry}>
            <RotateCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
