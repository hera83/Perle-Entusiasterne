/**
 * Database client abstraction layer.
 *
 * Re-exports the local Supabase-compatible proxy that routes all calls
 * to the local Express/PostgreSQL backend.
 */
import { localClient } from './local-client';

export const db = localClient;
