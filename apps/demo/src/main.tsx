import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TransactionProvider, defaultAdapter } from '@use-transaction/core'
import { mockClient } from './mock-client.js'
import { App } from './App.js'

const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <TransactionProvider adapter={defaultAdapter(mockClient)}>
      <App />
    </TransactionProvider>
  </StrictMode>,
)
