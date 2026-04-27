import { useTransactionContext } from './provider.js'
import type { TransactionOptions, QueryResult, MutationTuple } from './types.js'

const COMPILER_TRANSFORM_ERROR =
  '@use-transaction/core: useTransaction template literal was not transformed by ' +
  '@use-transaction/compiler. Make sure the Vite plugin or Babel plugin is configured.'

type TagFn<T> = (strings: TemplateStringsArray, ...values: unknown[]) => QueryResult<T>

export function useTransaction<T = unknown>(options: TransactionOptions): TagFn<T>
export function useTransaction<T = unknown>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): QueryResult<T>
export function useTransaction<T = unknown>(
  optionsOrStrings: TransactionOptions | TemplateStringsArray,
  ..._values: unknown[]
): QueryResult<T> | TagFn<T> {
  if (Array.isArray(optionsOrStrings)) {
    throw new Error(COMPILER_TRANSFORM_ERROR)
  }
  return function (_strings: TemplateStringsArray, ...__values: unknown[]): QueryResult<T> {
    throw new Error(COMPILER_TRANSFORM_ERROR)
  }
}

type MutationTagFn<T> = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => MutationTuple<T>

export function useTransactionMutation<T = unknown>(
  options: TransactionOptions,
): MutationTagFn<T>
export function useTransactionMutation<T = unknown>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): MutationTuple<T>
export function useTransactionMutation<T = unknown>(
  optionsOrStrings: TransactionOptions | TemplateStringsArray,
  ..._values: unknown[]
): MutationTuple<T> | MutationTagFn<T> {
  if (Array.isArray(optionsOrStrings)) {
    throw new Error(COMPILER_TRANSFORM_ERROR)
  }
  return function (_strings: TemplateStringsArray, ...__values: unknown[]): MutationTuple<T> {
    throw new Error(COMPILER_TRANSFORM_ERROR)
  }
}

// Called by compiler-rewritten output only — not part of the public API.
export function _useTransactionRpc<T>(
  rpcName: string,
  params: Record<string, unknown>,
): QueryResult<T> {
  const { adapter } = useTransactionContext()
  return adapter.useQuery<T>(rpcName, params)
}

export function _useTransactionMutationRpc<T>(
  rpcName: string,
  params: Record<string, unknown>,
): MutationTuple<T> {
  const { adapter } = useTransactionContext()
  return adapter.useMutation<T>(rpcName, params)
}
