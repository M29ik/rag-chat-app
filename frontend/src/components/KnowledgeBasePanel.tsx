import { useEffect, useRef, useState } from 'react'
import { deleteDocument, listDocuments, uploadDocument, type DocumentInfo } from '../api'

export function KnowledgeBasePanel() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setDocuments(await listDocuments())
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      await uploadDocument(file)
    }
    await refresh()
  }

  async function handleDelete(id: string) {
    await deleteDocument(id)
    await refresh()
  }

  return (
    <div className="panel kb-panel">
      <div className="panel-header">
        <h2>Knowledge Base</h2>
        <span className="count-badge">{documents.length}</span>
        <button className="refresh-button" onClick={refresh} title="Refresh" aria-label="Refresh">
          &#8635;
        </button>
      </div>

      <div className="kb-list">
        {documents.length === 0 ? (
          <div className="empty-state">No documents yet. Upload files below.</div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="kb-item">
              <span className="kb-filename">{doc.filename}</span>
              <button
                className="kb-delete"
                onClick={() => handleDelete(doc.id)}
                aria-label={`Delete ${doc.filename}`}
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>

      <div
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <p>
          Drag &amp; drop files here, or <span className="browse-link">browse</span>
        </p>
        <p className="upload-hint">.pdf, .txt, .md</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
