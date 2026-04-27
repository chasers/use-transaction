import { createContext, useContext, type ReactNode } from 'react'
import type { FetcherAdapter } from './types.js'

interface TransactionContextValue {
  adapter: FetcherAdapter
}

const TransactionContext = createContext<TransactionContextValue | null>(null)

export function TransactionProvider({
  adapter,
  children,
}: {
  adapter: FetcherAdapter
  children: ReactNode
}) {
  return (
    <TransactionContext.Provider value={{ adapter }}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactionContext(): TransactionContextValue {
  const ctx = useContext(TransactionContext)
  if (ctx === null) {
    throw new Error(
      '@use-transaction/core: useTransaction was called outside of <TransactionProvider>. ' +
        'Wrap your app with <TransactionProvider adapter={...}>.',
    )
  }
  return ctx
}
