// ==============================================================================
// StarRuby.in Banking System — Database & Entity Types
// Matches the Supabase PostgreSQL Schema & Banking Tables.xlsx (21 Tables)
// ==============================================================================

export type AccessLevelType = 'Admin' | 'Accountant' | 'Manager' | 'Staff';

export interface Company {
  id: string; // COM1, COM2...
  full_name: string;
  email?: string;
  created_at: string;
}

export interface AccessLevel {
  id: string; // ACC1, ACC2...
  level_type: AccessLevelType;
  description: string;
}

export interface User {
  id: string; // USR1, USR2...
  full_name: string;
  email: string;
  access_level_id: string;
  access_role_ids?: string[]; // Multiple access roles supported (e.g. ACC1, ACC2)
  is_active: boolean;
  created_at: string;
}

export interface UserCompany {
  user_id: string;
  company_id: string;
  assigned_by: string;
  assigned_at: string;
}

export type Currency = 'INR' | 'AED' | 'USD' | 'EUR' | 'GBP';

export interface Account {
  id: string; // BNK1, BNK2...
  company_id: string;
  bank_name: string;
  bank_country: string;
  account_number: string;
  iban_number?: string;
  swift_code?: string;
  ifsc_code?: string;
  account_holder: string;
  account_currency: Currency;
  bank_branch: string;
  account_creation_date?: string;
  account_closing_date?: string;
  created_at: string;
}

export interface AccountSignatory {
  account_id: string;
  user_id: string;
}

export interface Party {
  id: string; // PTY101, PTY102...
  system_name?: string; // Clean source of truth name
  party_name: string; // Clean display name (or first raw alias)
  party_name_raw?: string | string[]; // In updated Excel & brief: array of raw names/aliases mapped to this party
  bank_name?: string;
  bank_country?: string;
  country?: string;
  account_number?: string;
  iban_number?: string;
  swift_code?: string;
  ifsc_code?: string;
  account_holder?: string;
  account_currency?: Currency | string;
  bank_branch?: string;
  account_creation_date?: string;
  account_closing_date?: string;
  group_name?: string; // e.g. "Thailand Suppliers", "Dubai Gem Vendors"
  cid_number?: string; // Optional manual customer tracking number (e.g. CID10001)
  created_at: string;
}

export type AliasStatus = 'unmapped' | 'suggested' | 'mapped' | 'ignored';

export interface PartyAlias {
  id: string; // PALIAS1, PALIAS2...
  alias_name: string; // Exact raw typed string
  alias_normalized: string; // Cleaned string for comparison
  party_id?: string; // FK to parties.id (null until mapped)
  status: AliasStatus;
  suggested_party_id?: string;
  created_by: string;
  created_at: string;
}

export interface PartyDescriptionTemplate {
  id: string; // TPL1, TPL2...
  party_id: string;
  template_text: string;
  use_count: number;
  source: 'manual' | 'ai';
  created_by: string;
  created_at: string;
}

export type TransactionDirection = 'Receipt' | 'Payment';
export type UserTxnStatus = 'open' | 'in_approval' | 'approved' | 'rejected';
export type AmountConfirmedStatus = 'Confirmed' | 'Unconfirmed';
export type VerifiedWithBankStatus = 'Yes' | 'No';

export interface UserTransaction {
  id: string; // UTRN101, UTRN102...
  account_id: string;
  party_id?: string;
  party_name_raw: string;
  description?: string;
  date_of_entry: string; // Today
  date_of_transaction: string;
  currency: Currency | string;
  exchange_rate?: number;
  amount: number;
  amount_confirmed: AmountConfirmedStatus;
  amount_in_inr?: number;
  direction: TransactionDirection;
  status: UserTxnStatus;
  verified_with_bank: VerifiedWithBankStatus; // STRICTLY MANUAL: Never auto-set
  source: 'manual' | 'csv';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string; // BTRN101, BTRN102...
  account_id: string;
  value_date: string;
  narration: string; // Kept verbatim, never aliased
  description?: string; // Our separate note
  reference_no?: string;
  debit: number;
  credit: number;
  currency: Currency | string;
  balance_after?: number;
  source: 'manual' | 'csv';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TxnBankLink {
  id: number;
  user_txn_id: string;
  bank_txn_id: string;
  linked_by: string;
  link_method: 'manual' | 'csv';
  created_at: string;
}

export interface Approval {
  id: number;
  user_txn_id: string;
  layer: 1 | 2 | 3;
  approver_id: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decided_at: string;
}

export interface Comment {
  id: number;
  user_txn_id: string;
  author_id: string;
  message: string;
  created_at: string;
}

export type PendingTxnStatus = 'pending' | 'suggested' | 'done' | 'cancelled';

export interface PendingTransaction {
  id: string; // PEND1, PEND2...
  account_id: string;
  party_id?: string;
  party_name_raw?: string;
  amount: number;
  currency: Currency | string;
  direction: TransactionDirection;
  expected_date: string;
  description?: string;
  status: PendingTxnStatus;
  linked_user_txn_id?: string;
  linked_at?: string;
  created_by: string;
  created_at: string;
}

export type StatementUploadStatus = 'pending' | 'uploaded';

export interface StatementUpload {
  id: string; // STU1, STU2...
  account_id: string;
  statement_month: string; // 'YYYY-MM-01'
  status: StatementUploadStatus;
  r2_bucket?: string;
  r2_object_key?: string;
  file_name?: string;
  file_size_bytes?: number;
  uploaded_by?: string;
  uploaded_at?: string;
}

export type DocumentType = 'invoice' | 'receipt' | 'statement' | 'other';

export interface DocumentRecord {
  id: string; // DOC1, DOC2...
  file_name: string;
  r2_bucket: string;
  r2_object_key: string;
  content_type: string;
  size_bytes: number;
  doc_type: DocumentType;
  user_txn_id?: string;
  bank_txn_id?: string;
  uploaded_by: string;
  created_at: string;
  download_url?: string; // Presigned URL
}

export interface DocumentChunk {
  id: number;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  fts_vector?: string;
  created_at: string;
}

export interface RecordVersion {
  id: number;
  table_name: string;
  record_id: string;
  column_name: string;
  old_value?: string;
  new_value?: string;
  version_no: number;
  changed_by: string;
  changed_at: string;
}

export interface AppSetting {
  setting_key: string;
  setting_value: string;
  description: string;
}

export interface PasswordResetRequest {
  id: string;
  email: string;
  user_id?: string;
  reset_code: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  temporary_password?: string;
  approved_by?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}
