import React, { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0a0a0a] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-[#111111] border border-red-500/20 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-3 tracking-tight">Playground Encountered an Error</h1>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              FloatGPT encountered an unexpected error. Please reload the application to restore your session.
            </p>
            <div className="w-full flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors shadow-lg shadow-indigo-500/25"
              >
                <RefreshCcw className="w-4 h-4" /> Reload Playground
              </button>
            </div>
            {this.state.error && (
               <div className="mt-8 w-full text-left bg-black/50 border border-gray-800 rounded-lg p-4 overflow-auto max-h-32">
                 <p className="text-xs font-mono text-red-400 break-words">{this.state.error.toString()}</p>
               </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
