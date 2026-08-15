import { Component } from 'react';
import { captureFrontendError } from '@/lib/monitoring.js';

export default class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    captureFrontendError(error, {
      source: 'react.error-boundary',
      componentStack: errorInfo?.componentStack || ''
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
        <section
          className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          role="alert"
          aria-labelledby="app-error-title"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">FACT</p>
          <h1 id="app-error-title" className="mt-2 text-3xl font-bold text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-3 text-slate-600">
            Your information is safe. Reload the page to try again, or return to the home page.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
            >
              Reload page
            </button>
            <a
              href="/Landing"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Return home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
