import { useState, useEffect } from 'react'
import { useTransaction, useTransactionMutation } from '@use-transaction/core'
import { TodoItem } from './TodoItem.js'
import type { Todo } from './mock-client.js'

export function App() {
  const [title, setTitle] = useState('')
  const [todos, setTodos] = useState<Todo[]>([])

  // Compiled to: _useTransactionRpc('ut_<hash>', {})
  const { data, loading, error } = useTransaction<Todo[]>`
    SELECT id, title, completed FROM todos ORDER BY id DESC
  `

  useEffect(() => {
    if (data) setTodos(data)
  }, [data])

  // Compiled to: _useTransactionMutationRpc('ut_<hash>', { title })
  const [addTodo, { loading: adding, error: addError }] = useTransactionMutation<Todo>`
    INSERT INTO todos (title, completed) VALUES (${title}, false) RETURNING id, title, completed
  `

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const result = await addTodo()
    if (result) {
      setTodos((prev) => [result, ...prev])
      setTitle('')
    }
  }

  function handleToggled(id: number) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>use-transaction demo</h1>
        <p style={styles.subtitle}>
          SQL written in React — extracted at build time, executed via PostgREST RPC.
        </p>

        <form onSubmit={handleAdd} style={styles.form}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New todo…"
            style={styles.input}
            disabled={adding}
          />
          <button type="submit" disabled={adding || !title.trim()} style={styles.button}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>

        {addError && <p style={styles.error}>{addError.message}</p>}

        <div style={styles.list}>
          {loading && <p style={styles.muted}>Loading…</p>}
          {error && <p style={styles.error}>{error.message}</p>}
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onToggled={handleToggled} />
          ))}
          {!loading && todos.length === 0 && (
            <p style={styles.muted}>No todos yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '60px 16px',
    background: '#f9fafb',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#fff',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '8px 16px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 500,
  },
  list: {
    minHeight: 40,
  },
  muted: {
    color: '#9ca3af',
    fontSize: 14,
    padding: '8px 0',
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
  },
} satisfies Record<string, React.CSSProperties>
