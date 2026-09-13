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
  { id: 'USR1', full_name: 'Harshil Zaveri', email: 'harshil@starruby.in', access_level_id: 'ACC1', is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR2', full_name: 'Vismay Zaveri', email: 'vismay@starruby.in', access_level_id: 'ACC1', is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR3', full_name: 'Kavita Mehta', email: 'accountant@starruby.in', access_level_id: 'ACC2', is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR4', full_name: 'Rahul Shah', email: 'rahul@starruby.in', access_level_id: 'ACC3', is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR5', full_name: 'Pooja Patel', email: 'pooja@starruby.in', access_level_id: 'ACC3', is_active: true, created_at: '2026-09-01T10:00:00Z' },
  { id: 'USR6', full_name: 'Aniket Verma', email: 'staff@starruby.in', access_level_id: 'ACC4', is_active: true, created_at: '2026-09-01T10:00:00Z' },
];

export const initialCompanies: Company[] = [
  { id: 'COM1', full_name: 'StarRuby.in Private Limited', email: 'support@starruby.in', created_at: '2026-09-01T10:00:00Z' },
  { id: 'COM2', 'full_name': 'Star Ruby Gems DMCC', email: 'dubai@starruby.in', created_at: '2026-09-01T10:00:00Z' },
];

export const initialUserCompanies: UserCompany[] = [
  { user_id: 'USR4', company_id: 'COM1', assigned_by: 'USR1', assigned_at: '2026-09-01T10:00:00Z' },
  { user_id: 'USR5', company_id: 'COM2', assigned_by: 'USR2', assigned_at: '2026-09-01T10:00:00Z' },
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
  { id: 'PALIAS2', alias_name: 'Blue Ocean LLC', alias_normalized: 'blue ocean llc', party_id: 'PTY101', status: 'mapped', created_by: 'USR6', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS3', alias_name: 'VismayZaveri', alias_normalized: 'vismayzaveri', party_id: 'PTY102', status: 'mapped', created_by: 'USR1', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS4', alias_name: 'Vismay P. Zaveri', alias_normalized: 'vismay p zaveri', party_id: 'PTY102', status: 'mapped', created_by: 'USR1', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS5', alias_name: 'Bangkok Gems', alias_normalized: 'bangkok gems', party_id: 'PTY103', status: 'mapped', created_by: 'USR4', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS6', alias_name: 'GIA India Lab', alias_normalized: 'gia india lab', party_id: 'PTY104', status: 'mapped', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'PALIAS7', alias_name: 'FedEx Courier', alias_normalized: 'fedex courier', party_id: 'PTY105', status: 'mapped', created_by: 'USR6', created_at: '2026-09-01T10:00:00Z' },
  // Unmapped test candidates
  { id: 'PALIAS8', alias_name: 'Blue Ocean Trading Co.', alias_normalized: 'blue ocean trading co', party_id: undefined, status: 'unmapped', suggested_party_id: 'PTY101', created_by: 'USR6', created_at: '2026-09-10T11:00:00Z' },
  { id: 'PALIAS9', alias_name: 'CASH DEPOSIT MUMBAI', alias_normalized: 'cash deposit mumbai', party_id: undefined, status: 'unmapped', created_by: 'USR6', created_at: '2026-09-11T12:00:00Z' },
];

export const initialPartyTemplates: PartyDescriptionTemplate[] = [
  { id: 'TPL1', party_id: 'PTY101', template_text: 'Advance payment for rough ruby lot shipment', use_count: 15, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL2', party_id: 'PTY101', template_text: 'Settlement of Invoice INV-2026-88', use_count: 8, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL3', party_id: 'PTY103', template_text: 'Star Sapphire certified cabochons lot purchase', use_count: 22, source: 'manual', created_by: 'USR4', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL4', party_id: 'PTY104', template_text: 'Diamond grading and certification charges', use_count: 34, source: 'manual', created_by: 'USR3', created_at: '2026-09-01T10:00:00Z' },
  { id: 'TPL5', party_id: 'PTY105', template_text: 'International insured courier freight charges', use_count: 19, source: 'manual', created_by: 'USR6', created_at: '2026-09-01T10:00:00Z' },
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

export const initialUserTransactions: UserTransaction[] = [
  {
    id: 'UTRN101',
    account_id: 'BNK1',
    party_id: 'PTY101',
    party_name_raw: 'Blue Ocean Trading LLC',
    description: 'Payment for rough ruby lot shipment per INV-223',
    date_of_entry: '2026-09-08',
    date_of_transaction: '2026-09-08',
    currency: 'INR',
    amount: 125000,
    amount_confirmed: 'Confirmed',
    direction: 'Payment',
    status: 'approved',
    verified_with_bank: 'Yes',
    source: 'manual',
    created_by: 'USR3',
    created_at: '2026-09-08T10:30:00Z',
    updated_at: '2026-09-08T10:30:00Z',
  },
  {
    id: 'UTRN102',
    account_id: 'BNK1',
    party_id: 'PTY104',
    party_name_raw: 'GIA India Lab',
    description: 'Diamond grading and certification charges',
    date_of_entry: '2026-09-09',
    date_of_transaction: '2026-09-09',
    currency: 'INR',
    amount: 45000,
    amount_confirmed: 'Confirmed',
    direction: 'Payment',
    status: 'in_approval', // Closed at Layer 1, awaiting Admin approval
    verified_with_bank: 'Yes',
    source: 'manual',
    created_by: 'USR4',
    created_at: '2026-09-09T11:00:00Z',
    updated_at: '2026-09-09T11:00:00Z',
  },
  {
    id: 'UTRN103',
    account_id: 'BNK1',
    party_id: 'PTY105',
    party_name_raw: 'FedEx Courier',
    description: 'International insured courier freight charges',
    date_of_entry: '2026-09-10',
    date_of_transaction: '2026-09-10',
    currency: 'INR',
    amount: 18500,
    amount_confirmed: 'Unconfirmed', // Attention needed
    direction: 'Payment',
    status: 'open',
    verified_with_bank: 'No',
    source: 'manual',
    created_by: 'USR6',
    created_at: '2026-09-10T09:15:00Z',
    updated_at: '2026-09-10T09:15:00Z',
  },
  {
    id: 'UTRN104',
    account_id: 'BNK3',
    party_id: 'PTY101',
    party_name_raw: 'Blue Ocean Trading',
    description: 'Advance payment for rough ruby lot shipment',
    date_of_entry: '2026-09-11',
    date_of_transaction: '2026-09-11',
    currency: 'AED',
    exchange_rate: 22.85,
    amount: 50000,
    amount_confirmed: 'Confirmed',
    amount_in_inr: 1142500,
    direction: 'Payment',
    status: 'open',
    verified_with_bank: 'No',
    source: 'manual',
    created_by: 'USR5',
    created_at: '2026-09-11T14:20:00Z',
    updated_at: '2026-09-11T14:20:00Z',
  },
  {
    id: 'UTRN105',
    account_id: 'BNK1',
    party_id: undefined,
    party_name_raw: 'Raw Gem Importer Surat',
    description: 'Surat consignment partial payment',
    date_of_entry: '2026-09-12',
    date_of_transaction: '2026-09-12',
    currency: 'INR',
    amount: 75000,
    amount_confirmed: 'Unconfirmed',
    direction: 'Payment',
    status: 'open',
    verified_with_bank: 'No',
    source: 'manual',
    created_by: 'USR6',
    created_at: '2026-09-12T16:00:00Z',
    updated_at: '2026-09-12T16:00:00Z',
  },
];

export const initialBankTransactions: BankTransaction[] = [
  {
    id: 'BTRN101',
    account_id: 'BNK1',
    value_date: '2026-09-08',
    narration: 'NEFT-BLUE OCEAN TRADING LLC-MASHREQ-00192',
    description: 'Matched supplier payment',
    reference_no: 'NEFT99018241',
    debit: 125000,
    credit: 0,
    currency: 'INR',
    balance_after: 1845000,
    source: 'csv',
    created_by: 'USR3',
    created_at: '2026-09-08T18:00:00Z',
    updated_at: '2026-09-08T18:00:00Z',
  },
  {
    id: 'BTRN102',
    account_id: 'BNK1',
    value_date: '2026-09-09',
    narration: 'RTGS-GIA INDIA LABORATORY PRIVATE LIMITED',
    description: 'Lab test fees',
    reference_no: 'RTGS44019283',
    debit: 45000,
    credit: 0,
    currency: 'INR',
    balance_after: 1800000,
    source: 'manual',
    created_by: 'USR3',
    created_at: '2026-09-09T18:00:00Z',
    updated_at: '2026-09-09T18:00:00Z',
  },
  {
    id: 'BTRN103',
    account_id: 'BNK1',
    value_date: '2026-09-10',
    narration: 'IMPS-FEDEX EXPRESS COURIER SERVICES',
    reference_no: 'IMPS11029384',
    debit: 18500,
    credit: 0,
    currency: 'INR',
    balance_after: 1781500,
    source: 'csv',
    created_by: 'USR3',
    created_at: '2026-09-10T18:00:00Z',
    updated_at: '2026-09-10T18:00:00Z',
  },
  {
    id: 'BTRN104',
    account_id: 'BNK1',
    value_date: '2026-09-11',
    narration: 'INTEREST CREDIT BY ICICI BANK Q2',
    reference_no: 'INT992019',
    debit: 0,
    credit: 14250,
    currency: 'INR',
    balance_after: 1795750,
    source: 'csv',
    created_by: 'USR3',
    created_at: '2026-09-11T18:00:00Z',
    updated_at: '2026-09-11T18:00:00Z',
  },
];

export const initialTxnBankLinks: TxnBankLink[] = [
  { id: 1, user_txn_id: 'UTRN101', bank_txn_id: 'BTRN101', linked_by: 'USR3', link_method: 'manual', created_at: '2026-09-08T18:15:00Z' },
  { id: 2, user_txn_id: 'UTRN102', bank_txn_id: 'BTRN102', linked_by: 'USR4', link_method: 'manual', created_at: '2026-09-09T18:30:00Z' },
];

export const initialApprovals: Approval[] = [
  // UTRN101: Fully closed (Layer 1 closed, Layer 2 Harshil, Layer 3 Vismay)
  { id: 1, user_txn_id: 'UTRN101', layer: 1, approver_id: 'USR3', decision: 'approved', comment: 'Matched with bank line BTRN101', decided_at: '2026-09-08T18:20:00Z' },
  { id: 2, user_txn_id: 'UTRN101', layer: 2, approver_id: 'USR1', decision: 'approved', comment: 'Verified against PO and shipment slip', decided_at: '2026-09-08T19:00:00Z' },
  { id: 3, user_txn_id: 'UTRN101', layer: 3, approver_id: 'USR2', decision: 'approved', comment: 'Final reviewed and closed', decided_at: '2026-09-08T19:30:00Z' },
  
  // UTRN102: Closed at Layer 1 in Match Tab, waiting for Admin Layer 2
  { id: 4, user_txn_id: 'UTRN102', layer: 1, approver_id: 'USR4', decision: 'approved', comment: 'Linked with BTRN102', decided_at: '2026-09-09T18:35:00Z' },
];

export const initialComments: Comment[] = [
  { id: 1, user_txn_id: 'UTRN101', author_id: 'USR3', message: 'Invoice INV-223 verified and bank statement line matched.', created_at: '2026-09-08T18:10:00Z' },
  { id: 2, user_txn_id: 'UTRN102', author_id: 'USR4', message: 'GIA certification receipt attached to board.', created_at: '2026-09-09T11:05:00Z' },
  { id: 3, user_txn_id: 'UTRN103', author_id: 'USR3', message: 'Please confirm the amount once original courier docket arrives.', created_at: '2026-09-10T10:00:00Z' },
];

export const initialPendingTransactions: PendingTransaction[] = [
  {
    id: 'PEND1',
    account_id: 'BNK1',
    party_id: 'PTY105',
    party_name_raw: 'FedEx Courier',
    amount: 18500,
    currency: 'INR',
    direction: 'Payment',
    expected_date: '2026-09-10',
    description: 'Estimated monthly freight bill',
    status: 'suggested', // Suggested match with UTRN103!
    created_by: 'USR3',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'PEND2',
    account_id: 'BNK1',
    party_name_raw: 'Hubtown Office Rent',
    amount: 85000,
    currency: 'INR',
    direction: 'Payment',
    expected_date: '2026-09-15',
    description: 'Office rent for September 2026',
    status: 'pending',
    created_by: 'USR3',
    created_at: '2026-09-01T10:00:00Z',
  },
];

// Pre-fill monthly upload matrix for 2026 (Jan to Dec for each account)
export const initialStatementUploads: StatementUpload[] = (() => {
  const uploads: StatementUpload[] = [];
  const accounts = ['BNK1', 'BNK2', 'BNK3', 'BNK4'];
  const months = [
    '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
    '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
    '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
  ];

  let idCounter = 1;
  for (const acc of accounts) {
    for (const m of months) {
      uploads.push({
        id: `STU${idCounter++}`,
        account_id: acc,
        statement_month: m,
        status: 'pending',
        r2_bucket: undefined,
        r2_object_key: undefined,
        file_name: undefined,
        file_size_bytes: undefined,
        uploaded_by: undefined,
        uploaded_at: undefined,
      });
    }
  }
  return uploads;
})();

export const initialDocuments: DocumentRecord[] = [];

export const initialRecordVersions: RecordVersion[] = [
  {
    id: 1,
    table_name: 'transactions_user',
    record_id: 'UTRN101',
    column_name: 'amount_confirmed',
    old_value: 'Unconfirmed',
    new_value: 'Confirmed',
    version_no: 1,
    changed_by: 'USR3',
    changed_at: '2026-09-08T12:00:00Z',
  },
  {
    id: 2,
    table_name: 'parties',
    record_id: 'PTY101',
    column_name: 'system_name',
    old_value: 'Blue Ocean Trading',
    new_value: 'Blue Ocean Trading LLC',
    version_no: 1,
    changed_by: 'USR1',
    changed_at: '2026-09-02T10:00:00Z',
  },
];
