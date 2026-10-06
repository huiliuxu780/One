import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** 兜底渲染错误边界：捕获子树渲染异常，提供重试入口，避免整页白屏。 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面渲染出现未处理异常:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid min-h-[60dvh] place-items-center px-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <div className="font-display text-lg font-semibold">页面出现异常</div>
          <p className="break-all text-sm text-muted-foreground">{error.message || '发生了未知错误'}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={this.reset}>
              重试
            </Button>
            <Button onClick={() => window.location.reload()}>刷新页面</Button>
          </div>
        </div>
      </div>
    )
  }
}
