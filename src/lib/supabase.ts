// ==============================================================================
// StarRuby.in Banking System — Supabase Client & Seed Data Repository
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import {
  Company,
  AccessLevel,
  User,
  UserCompany,
  Account,
  AccountSignatory,
  Party,
  PartyAlias,
  PartyDescriptionTemplate,
  UserTransaction,
  BankTransaction,
  TxnBankLink,
  Approval,
  Comment,
  PendingTransaction,
  StatementUpload,
  DocumentRecord,
  RecordVersion,
  AppSetting,
} from '../types/database';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ==============================================================================
// INITIAL SEED DATA (Extracted from Banking Tables.xlsx)
// ==============================================================================

export const initialAccessLevels: AccessLevel[] = [
  { id: 'ACC1', level_type: 'Admin', description: 'Full authority, company assignments, Layer 2/3 approvals' },
  { id: 'ACC2', level_type: 'Accountant', description: 'Global company access, Layer 1 matching/closing' },
  { id: 'ACC3', level_type: 'Manager', description: 'Scoped strictly to assigned companies' },
  { id: 'ACC4', level_type: 'Staff', description: 'Transaction entry (form/CSV), party addition, read-only viewing' },
];

export const initialUsers: User[] = [
  { id: 'USR1', full_name: 'Harshil Zaveri', email: 'harshil@starruby.in', access_level_id: 'ACC1', access_role_ids: ['ACC1'], is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR2', full_name: 'Vismay Zaveri', email: 'vismay@starruby.in', access_level_id: 'ACC1', access_role_ids: ['ACC1'], is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR3', full_name: 'Hetal Gohil', email: 'hetal@starruby.in', access_level_id: 'ACC2', access_role_ids: ['ACC2'], is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR4', full_name: 'Atik Varaiya', email: 'atik@starruby.in', access_level_id: 'ACC3', access_role_ids: ['ACC3'], is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR5', full_name: 'Aaditya Ghag', email: 'aaditya@starruby.in', access_level_id: 'ACC3', access_role_ids: ['ACC3'], is_active: true, created_at: '2026-09-01T10:00:00Z' },
];

export const initialCompanies: Company[] = [
  { id: 'COM1', full_name: 'StarRuby.in Private Limited', email: 'support@starruby.in', created_at: '2026-09-01T10:00:00Z' },
  { id: 'COM2', full_name: 'Star Ruby Gems DMCC', email: 'dubai@starruby.in', created_at: '2026-09-01T10:00:00Z' },
];

export const initialUserCompanies: UserCompany[] = [
  { user_id: 'USR4', company_id: 'COM2', assigned_by: 'USR1', assigned_at: '2026-09-01T10:00:00Z' },
  { user_id: 'USR5', company_id: 'COM1', assigned_by: 'USR1', assigned_at: '2026-09-01T10:00:00Z' },
];

export const initialAccounts: Account[] = [];

export const initialSignatories: AccountSignatory[] = [];

export const initialParties: Party[] = [];

export const initialPartyAliases: PartyAlias[] = [];

export const initialPartyTemplates: PartyDescriptionTemplate[] = [];

export const initialAppSettings: AppSetting[] = [
  { setting_key: 'duplicate_date_window_days', setting_value: '3', description: 'Days tolerance when scanning for duplicates (± 3 days)' },
  { setting_key: 'duplicate_amount_tolerance', setting_value: '5', description: 'Amount tolerance in account currency (± 5)' },
  { setting_key: 'live_check_window_days', setting_value: '7', description: 'Window shown in live duplicate check panel (± 7 days)' },
  { setting_key: 'fuzzy_match_threshold', setting_value: '0.6', description: 'pg_trgm similarity threshold for party alias matching (0.0 to 1.0)' },
  { setting_key: 'r2_bucket_default', setting_value: 'banking-docs-prod', description: 'Default Cloudflare R2 bucket name' },
  { setting_key: 'embedding_model', setting_value: 'text-embedding-3-small', description: 'Model used for document vector embeddings' },
  { setting_key: 'chunk_size_chars', setting_value: '1000', description: 'Maximum characters per document chunk' },
  { setting_key: 'chunk_overlap_chars', setting_value: '150', description: 'Overlap characters between adjacent chunks' },
  { setting_key: 'match_confidence_window_days', setting_value: '7', description: 'Window for candidate bank statement entries in Match tab (± 7 days)' },
  { setting_key: 'match_confidence_party_weight', setting_value: '0.6', description: 'Weight of party similarity in candidate confidence scoring' },
  { setting_key: 'inr_conversion_mode', setting_value: 'optional', description: 'Whether exchange rate and INR calculation are required or optional' },
  { setting_key: 'pending_amount_match_window_days', setting_value: '7', description: 'Date window around expected date to suggest pending match' },
  { setting_key: 'pending_suggest_same_party_only', setting_value: 'No', description: 'Whether pending suggestions require exact party match or amount is sufficient' },
];

export const initialUserTransactions: UserTransaction[] = [];

export const initialBankTransactions: BankTransaction[] = [];

export const initialTxnBankLinks: TxnBankLink[] = [];

export const initialApprovals: Approval[] = [];

export const initialComments: Comment[] = [];

export const initialPendingTransactions: PendingTransaction[] = [];

export const initialStatementUploads: StatementUpload[] = [];

export const initialDocuments: DocumentRecord[] = [];

export const initialRecordVersions: RecordVersion[] = [];

