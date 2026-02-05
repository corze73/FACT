import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from '@/App.jsx'
import '@/index.css'
import { auth } from '@/api/databaseClient.js'
import { queryClient } from '@/lib/queryClient.js'

// Initialize auth system on app start
auth.init().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    {/* Show React Query devtools in development */}
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </QueryClientProvider>
) 