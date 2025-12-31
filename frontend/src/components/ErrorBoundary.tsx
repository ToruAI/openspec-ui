import { Component, type ReactNode, type ComponentType } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ComponentType<{ error: Error; retry: () => void }>;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { children, fallback: Fallback } = this.props;
    const { error } = this.state;

    if (error) {
      if (Fallback) {
        return <Fallback error={error} retry={this.handleRetry} />;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="text-center max-w-md">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
            <Button onClick={this.handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return children;
  }
}
