import './App.css'
import { ChatPanel } from './components/ChatPanel'
import { KnowledgeBasePanel } from './components/KnowledgeBasePanel'

function App() {
  return (
    <div className="app-layout">
      <ChatPanel />
      <KnowledgeBasePanel />
    </div>
  )
}

export default App
