import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamChat } from '../api'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  function appendToLastMessage(delta: string) {
    setMessages((prev) => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      updated[updated.length - 1] = { ...last, text: last.text + delta }
      return updated
    })
  }

  async function handleSend() {
    const question = input.trim()
    if (!question || sending) return

    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: '' }])
    setInput('')
    setSending(true)

    try {
      await streamChat(question, appendToLastMessage, () => setSending(false))
    } catch {
      appendToLastMessage('Something went wrong — is the backend server running?')
      setSending(false)
    }
  }

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <h2>Chat</h2>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">Ask a question about your uploaded documents</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message message-${m.role}`}>
            {m.role === 'assistant' ? (
              <ReactMarkdown>{m.text}</ReactMarkdown>
            ) : (
              m.text
            )}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} disabled={sending}>
          Send
        </button>
      </div>
    </div>
  )
}
