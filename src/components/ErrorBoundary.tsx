import { Component, type ReactNode } from 'react';
import i18n from 'i18next';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <h1 className="text-lg font-semibold text-red-700 mb-2">{i18n.t('common.ui.errorBoundary.title', { defaultValue: 'Something went wrong' })}</h1>
          <p className="text-sm text-slate-600 mb-4">
            {i18n.t('common.ui.errorBoundary.body', { defaultValue: 'This page failed to render. Reload the page or open the browser console for details.' })}
          </p>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-auto max-h-64 text-slate-700">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              {i18n.t('common.ui.errorBoundary.reload', { defaultValue: 'Reload' })}
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
            >
              {i18n.t('common.ui.errorBoundary.tryAgain', { defaultValue: 'Try again' })}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
