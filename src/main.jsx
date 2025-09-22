import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { auth } from '@/api/databaseClient.js'

// Initialize auth system on app start
auth.init().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
) 