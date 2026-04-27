import { useTransactionMutation } from '@use-transaction/core'
import type { Todo } from './mock-client.js'

interface Props {
  todo: Todo
  onToggled: (id: number) => void
}

export function TodoItem({ todo, onToggled }: Props) {
  const todoId = todo.id

  const [toggle, { loading }] = useTransactionMutation`
    UPDATE todos SET completed = NOT completed WHERE id = ${todoId}
  `

  async function handleToggle() {
    await toggle()
    onToggled(todo.id)
  }

  return (
    <li style={styles.item}>
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{ ...styles.toggle, opacity: loading ? 0.5 : 1 }}
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.completed ? '✓' : '○'}
      </button>
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', color: todo.completed ? '#888' : '#111' }}>
        {todo.title}
      </span>
    </li>
  )
}

const styles = {
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #e5e7eb',
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '2px solid #6366f1',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#6366f1',
    flexShrink: 0,
  },
} satisfies Record<string, React.CSSProperties>
