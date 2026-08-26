import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import PwaInstallPrompt from "@/components/PwaInstallPrompt"

function App() {
  return (
    <>
      <Pages />
      <PwaInstallPrompt />
      <Toaster />
    </>
  )
}

export default App
