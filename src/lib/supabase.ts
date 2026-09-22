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

export const initialAccounts: Account[] = [
  {
    id: 'BNK1',
    company_id: 'COM1',
    bank_name: 'ICICI Bank Limited',
    bank_country: 'India',
    account_number: '03213546436',
    account_holder: 'StarRuby.in Private Limited',
    account_currency: 'INR',
    ifsc_code: 'ICIC0000321',
    bank_branch: '701, Level 7, Hubtown Solaris, Andheri East, Mumbai 400069',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'BNK2',
    company_id: 'COM1',
    bank_name: 'Kotak Mahindra Bank',
    bank_country: 'India',
    account_number: '9812401822',
    account_holder: 'StarRuby.in Private Limited',
    account_currency: 'INR',
    ifsc_code: 'KKBK0000669',
    bank_branch: 'BKC Branch, Bandra East, Mumbai 400051',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'BNK3',
    company_id: 'COM2',
    bank_name: 'Emirates NBD',
    bank_country: 'UAE',
    account_number: '10192837465',
    iban_number: 'AE190110656330200019842',
    swift_code: 'BOMLAEAD',
    account_holder: 'Star Ruby Gems DMCC',
    account_currency: 'AED',
    bank_branch: 'Almas Tower, JLT, Dubai, UAE',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'BNK4',
    company_id: 'COM2',
    bank_name: 'Emirates NBD',
    bank_country: 'UAE',
    account_number: '10192837499',
    iban_number: 'AE190110656330200019899',
    swift_code: 'BOMLAEAD',
    account_holder: 'Star Ruby Gems DMCC',
    account_currency: 'USD',
    bank_branch: 'Almas Tower, JLT, Dubai, UAE',
    created_at: '2026-09-01T10:00:00Z',
  },
];

export const initialSignatories: AccountSignatory[] = [
  { account_id: 'BNK1', user_id: 'USR1' },
  { account_id: 'BNK1', user_id: 'USR2' },
  { account_id: 'BNK2', user_id: 'USR1' },
  { account_id: 'BNK3', user_id: 'USR2' },
  { account_id: 'BNK4', user_id: 'USR2' },
];

export const initialParties: Party[] = [
  {
    id: 'PTY101',
    system_name: 'Blue Ocean Trading LLC',
    party_name: 'Blue Ocean Trading',
    group_name: 'Dubai Gem Vendors',
    cid_number: 'CID10001',
    bank_name: 'Mashreq Bank',
    bank_country: 'UAE',
    account_number: '0192837465',
    account_currency: 'AED',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'PTY102',
    system_name: 'Vismay P. Zaveri',
    party_name: 'VismayZaveri',
    group_name: 'Directors & Promoters',
    bank_name: 'ICICI Bank',
    bank_country: 'India',
    account_number: '03213546436',
    account_currency: 'INR',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'PTY103',
    system_name: 'Bangkok Gems & Stones Co.',
    party_name: 'Bangkok Gems',
    group_name: 'Thailand Suppliers',
    cid_number: 'CID10002',
    bank_name: 'Kasikornbank',
    bank_country: 'Thailand',
    account_currency: 'USD',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'PTY104',
    system_name: 'Gemological Institute of America',
    party_name: 'GIA India',
    group_name: 'Certification Labs',
    bank_name: 'HDFC Bank',
    bank_country: 'India',
    account_currency: 'INR',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'PTY105',
    system_name: 'FedEx Express India',
    party_name: 'FedEx Courier',
    group_name: 'Logistics Partners',
    bank_name: 'CitiBank',
    bank_country: 'India',
    account_currency: 'INR',
    created_at: '2026-09-01T10:00:00Z',
  },
];

export const initialPartyAliases: PartyAlias[] = [
  { id: 'PALIAS1', alias_name: 'Blue Ocean Trading', alias_normalized: 'blue ocean trading', party_id: 'PTY101', status: 'mapped', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS2', alias_name: 'Blue Ocean LLC', alias_normalized: 'blue ocean llc', party_id: 'PTY101', status: 'mapped', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS3', alias_name: 'VismayZaveri', alias_normalized: 'vismayzaveri', party_id: 'PTY102', status: 'mapped', created_by: 'USR1', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS4', alias_name: 'Vismay P. Zaveri', alias_normalized: 'vismay p zaveri', party_id: 'PTY102', status: 'mapped', created_by: 'USR1', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS5', alias_name: 'Bangkok Gems', alias_normalized: 'bangkok gems', party_id: 'PTY103', status: 'mapped', created_by: 'USR4', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS6', alias_name: 'GIA India Lab', alias_normalized: 'gia india lab', party_id: 'PTY104', status: 'mapped', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS7', alias_name: 'FedEx Courier', alias_normalized: 'fedex courier', party_id: 'PTY105', status: 'mapped', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  // Unmapped test candidates
  { id: 'PALIAS8', alias_name: 'Blue Ocean Trading Co.', alias_normalized: 'blue ocean trading co', party_id: undefined, status: 'unmapped', suggested_party_id: 'PTY101', created_by: 'USR3', created_at: '2026-09-10T11:00:00Z' },
  { id: 'PALIAS9', alias_name: 'CASH DEPOSIT MUMBAI', alias_normalized: 'cash deposit mumbai', party_id: undefined, status: 'unmapped', created_by: 'USR3', created_at: '2026-09-11T12:00:00Z' },
];

export const initialPartyTemplates: PartyDescriptionTemplate[] = [
  { id: 'TPL1', party_id: 'PTY101', template_text: 'Advance payment for rough ruby lot shipment', use_count: 15, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL2', party_id: 'PTY101', template_text: 'Settlement of Invoice INV-2026-88', use_count: 8, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL3', party_id: 'PTY103', template_text: 'Star Sapphire certified cabochons lot purchase', use_count: 22, source: 'manual', created_by: 'USR4', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL4', party_id: 'PTY104', template_text: 'Diamond grading and certification charges', use_count: 34, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL5', party_id: 'PTY105', template_text: 'International insured courier freight charges', use_count: 19, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
];

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

