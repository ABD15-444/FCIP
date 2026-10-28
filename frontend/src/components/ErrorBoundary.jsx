import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('FCIP Module Error Caught by Boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const moduleName = this.props.moduleName || 'FCIP Platform Module';
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 max-w-2xl mx-auto my-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono tracking-tight">
                Module Rendering Exception: {moduleName}
              </h2>
              <p className="text-xs text-red-300/80 mt-0.5">
                The application caught a runtime error and isolated it to prevent portal collapse.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-red-400 overflow-x-auto">
            {errorMessage}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs text-white font-mono flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Module</span>
            </button>
            {this.props.onFallback && (
              <button
                onClick={this.props.onFallback}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:text-white text-xs text-slate-400 font-mono flex items-center gap-2 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Primary Dashboard</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
