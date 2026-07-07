const API_BASE = 'http://127.0.0.1:8000'

export interface DocumentInfo {
  id: string
  filename: string
  size_bytes: number
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/documents`)
  if (!res.ok) throw new Error('Failed to load documents')
  return res.json()
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/documents`, { method: 'POST', body: form })
  if (!res.ok) throw new Error('Failed to upload document')
  return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete document')
}

// The backend streams the answer as Server-Sent Events. fetch() doesn't parse
// SSE for us (that's only built into EventSource, which can't send a POST body),
// so we read the raw bytes and split them into events ourselves.
export async function streamChat(
  message: string,
  onDelta: (text: string) => void,
  onDone: () => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok || !res.body) throw new Error('Chat request failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let separatorIndex
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      const lines = rawEvent.split('\n')
      const eventType = lines.find((l) => l.startsWith('event: '))?.slice('event: '.length)
      const rawData = lines.find((l) => l.startsWith('data: '))?.slice('data: '.length)
      const data = rawData ? JSON.parse(rawData) : {}

      if (eventType === 'delta') onDelta(data.text)
      if (eventType === 'done') onDone()
    }
  }
}
