// Default adapter stub — full implementation in Phase 4
import type { MigrationAdapter, SqlFunction } from './types.js'

export interface DefaultAdapterOptions {
  outputDir: string
}

export class DefaultAdapter implements MigrationAdapter {
  constructor(private options: DefaultAdapterOptions) {}

  async emit(_fn: SqlFunction): Promise<void> {
    // TODO: Phase 4
  }
}
