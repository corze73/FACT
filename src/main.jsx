import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from '@/App.jsx'
import '@/index.css'
import { auth } from '@/api/databaseClient.js'
import { queryClient } from '@/lib/queryClient.js'
import { initFrontendMonitoring, captureFrontendError } from '@/lib/monitoring.js'

// Initialize auth system on app start
auth.init().catch(console.error);
initFrontendMonitoring();

window.addEventListener('error', (event) => {
  if (event?.error) {
    captureFrontendError(event.error, { source: 'window.error' });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  captureFrontendError(event?.reason || new Error('Unhandled promise rejection'), { source: 'window.unhandledrejection' });
});

try {
  const query = new URLSearchParams(window.location.search);
  const shouldTriggerSentryTest = query.get('sentry_test') === '1';
  const hasTriggered = sessionStorage.getItem('sentry_test_triggered') === '1';
  if (shouldTriggerSentryTest && !hasTriggered) {
    sessionStorage.setItem('sentry_test_triggered', '1');
    setTimeout(() => {
      throw new Error('Phase 4 frontend monitoring test error');
    }, 0);
  }
} catch {
  // Ignore query/sessionStorage access failures
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    {/* Show React Query devtools in development */}
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </QueryClientProvider>
) 