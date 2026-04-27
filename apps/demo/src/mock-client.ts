import type { RpcClient } from '@use-transaction/core'

export interface Todo {
  id: number
  title: string
  completed: boolean
}

const store: Todo[] = [
  { id: 1, title: 'Set up Supabase project', completed: true },
  { id: 2, title: 'Run: use-transaction compile', completed: false },
  { id: 3, title: 'Apply migrations to Supabase', completed: false },
]
let nextId = 4

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// A mock RpcClient that handles the three RPC patterns used in the demo.
// In production this would be your Supabase client.
export const mockClient: RpcClient = {
  async rpc(_fn, params = {}) {
    await delay(250)

    // INSERT — params has a `title` key
    if ('title' in params) {
      const todo: Todo = { id: nextId++, title: String(params['title']), completed: false }
      store.push(todo)
      return { data: [todo] as unknown, error: null }
    }

    // TOGGLE — params has a `todoId` key
    if ('todoId' in params) {
      const id = Number(params['todoId'])
      const todo = store.find((t) => t.id === id)
      if (todo) todo.completed = !todo.completed
      return { data: null, error: null }
    }

    // SELECT — return all todos
    return { data: [...store] as unknown, error: null }
  },
}
