// ==============================================================================
// StarRuby.in Banking System — Application Context & State Management
// Enforces 4 Inviolable Rules, 3-Layer Approvals, Role Scoping, Cell Versioning
// ==============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  PasswordResetRequest,
} from '../types/database';

import {
  initialAccessLevels,
  initialUsers,
  initialCompanies,
  initialUserCompanies,
  initialAccounts,
  initialSignatories,
  initialParties,
  initialPartyAliases,
  initialPartyTemplates,
  initialAppSettings,
  initialUserTransactions,
  initialBankTransactions,
  initialTxnBankLinks,
  initialApprovals,
  initialComments,
  initialPendingTransactions,
  initialStatementUploads,
  initialDocuments,
  initialRecordVersions,
  supabase,
} from '../lib/supabase';

import { createCellAuditDelta } from '../lib/audit';
import { normalizeAlias } from '../lib/alias';
import { findPendingQueueMatches } from '../lib/matching';
import { fetchLiveForexRates, LiveForexRates } from '../lib/forex';

interface AppContextType {
  // Authentication & Credentials
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  allUsers: User[];
  accessLevels: AccessLevel[];
  currentRole: string; // 'Admin' | 'Accountant' | 'Manager' | 'Staff'
  
  // Active Entity Scope
  activeCompanyId: string; // 'ALL' or 'COM1', 'COM2'
  setActiveCompanyId: (id: string) => void;
  allowedCompanies: Company[];
  scopedAccounts: Account[];
  scopedUserTransactions: UserTransaction[];
  scopedBankTransactions: BankTransaction[];
  scopedPendingTransactions: PendingTransaction[];
  scopedStatementUploads: StatementUpload[];
  
  // Master Entities
  companies: Company[];
  accounts: Account[];
  signatories: AccountSignatory[];
  parties: Party[];
  partiesMap: Map<string, Party>;
  partyAliases: PartyAlias[];
  partyTemplates: PartyDescriptionTemplate[];
  userCompanies: UserCompany[];
  appSettings: AppSetting[];

  // Transactions & Workflows
  userTransactions: UserTransaction[];
  bankTransactions: BankTransaction[];
  txnBankLinks: TxnBankLink[];
  approvals: Approval[];
  comments: Comment[];
  pendingTransactions: PendingTransaction[];
  statementUploads: StatementUpload[];
  documents: DocumentRecord[];
  recordVersions: RecordVersion[];

  // Operational Actions
  addCompany: (comp: Omit<Company, 'id' | 'created_at'>, customId?: string) => Company;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  deleteCompany: (id: string) => { success: boolean; error?: string };

  addUser: (user: Omit<User, 'id' | 'created_at'>, customId?: string, initialPassword?: string) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => { success: boolean; error?: string };
  toggleUserActiveStatus: (id: string) => Promise<{ success: boolean; error?: string }>;
  addAccessLevel: (level: AccessLevel) => void;

  addAccount: (acc: Omit<Account, 'id' | 'created_at'>, customId?: string) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => { success: boolean; error?: string };

  addUserTransaction: (txn: Omit<UserTransaction, 'id' | 'date_of_entry' | 'status' | 'created_by' | 'created_at' | 'updated_at'>) => UserTransaction;
  addUserTransactionsBatch: (txns: Omit<UserTransaction, 'id' | 'date_of_entry' | 'status' | 'created_by' | 'created_at' | 'updated_at'>[]) => UserTransaction[];
  updateUserTransaction: (id: string, updates: Partial<UserTransaction>) => void;
  deleteUserTransaction: (id: string, reason: string) => boolean;
  updateUserTransactionCell: (id: string, column: keyof UserTransaction, value: any) => void;
  
  addBankTransaction: (txn: Omit<BankTransaction, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => BankTransaction;
  deleteBankTransaction: (id: string, reason: string) => boolean;
  
  linkTxnBank: (userTxnId: string, bankTxnId: string, method?: 'manual' | 'csv') => void;
  unlinkTxnBank: (userTxnId: string, bankTxnId: string) => void;
  
  closeInMatchTab: (userTxnId: string, linkedBankIds: string[], verifiedWithBank: 'Yes' | 'No', comment?: string) => void;
  submitApproval: (userTxnId: string, layer: 1 | 2 | 3, decision: 'approved' | 'rejected', comment?: string) => { success: boolean; message: string };
  
  addParty: (party: Omit<Party, 'id' | 'created_at'>, customId?: string) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
  deleteParty: (id: string) => { success: boolean; error?: string };
  addPartyAliasTag: (partyId: string, aliasName: string) => void;
  removePartyAliasTag: (partyId: string, aliasName: string) => void;
  mapPartyAlias: (aliasId: string, partyId: string) => void;
  createPartyFromAlias: (aliasId: string, cleanSystemName: string, groupName?: string) => Party;
  ignorePartyAlias: (aliasId: string) => void;
  
  addPartyTemplate: (partyId: string, text: string, source?: 'manual' | 'ai') => void;
  incrementTemplateUsage: (templateId: string) => void;
  
  addPendingTransaction: (pending: Omit<PendingTransaction, 'id' | 'status' | 'created_by' | 'created_at'>) => void;
  mapAndClosePending: (pendingId: string, userTxnId: string) => void;
  cancelPendingTransaction: (pendingId: string) => void;
  
  uploadStatementFile: (accountId: string, month: string, fileName: string, sizeBytes: number, r2Key: string) => void;
  
  addComment: (userTxnId: string, message: string) => void;
  attachDocument: (doc: Omit<DocumentRecord, 'id' | 'uploaded_by' | 'created_at'>) => DocumentRecord;
  deleteDocument: (id: string) => void;
  
  restoreCellVersion: (versionId: number) => { success: boolean; message: string };
  updateAppSetting: (key: string, value: string) => void;
  assignCompanyToUser: (userId: string, companyId: string) => void;
  removeCompanyFromUser: (userId: string, companyId: string) => void;
  isRealtimeConnected: boolean;
  lastRealtimeNotice: string | null;
  liveForexRates: LiveForexRates;
  refreshForexRates: () => Promise<void>;

  // User Credentials & Password Reset
  passwordResetRequests: PasswordResetRequest[];
  setUserPassword: (email: string, password: string, role?: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; requestId?: string; resetCode?: string; fullName?: string; error?: string }>;
  approvePasswordReset: (requestId: string, tempPassword?: string) => Promise<{ success: boolean; error?: string }>;
  rejectPasswordReset: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  completePasswordReset: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetTestData: () => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'starruby_banking_system_state_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Helper to load or fallback to initial seed
  const loadInitial = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };

  // State Stores
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('starruby_auth_user_id'));
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUserId = localStorage.getItem('starruby_auth_user_id');
    if (savedUserId) {
      const found = initialUsers.find(u => u.id === savedUserId);
      if (found) return found;
    }
    return initialUsers[0];
  });
  const [activeCompanyId, setActiveCompanyId] = useState<string>('ALL');

  const [companies, setCompanies] = useState<Company[]>(() => loadInitial('companies', initialCompanies));
  const [users, setUsers] = useState<User[]>(() => loadInitial('users', initialUsers));
  const [accessLevels, setAccessLevels] = useState<AccessLevel[]>(() => loadInitial('accessLevels', initialAccessLevels));
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>(() => loadInitial('userCompanies', initialUserCompanies));
  const [accounts, setAccounts] = useState<Account[]>(() => loadInitial('accounts', initialAccounts));
  const [signatories, setSignatories] = useState<AccountSignatory[]>(() => loadInitial('signatories', initialSignatories));
  const [parties, setParties] = useState<Party[]>(() => loadInitial('parties', initialParties));
  const [partyAliases, setPartyAliases] = useState<PartyAlias[]>(() => loadInitial('partyAliases', initialPartyAliases));
  const [partyTemplates, setPartyTemplates] = useState<PartyDescriptionTemplate[]>(() => loadInitial('partyTemplates', initialPartyTemplates));
  const [appSettings, setAppSettings] = useState<AppSetting[]>(() => loadInitial('appSettings', initialAppSettings));

  const [userTransactions, setUserTransactions] = useState<UserTransaction[]>(() => loadInitial('userTransactions', initialUserTransactions));
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => loadInitial('bankTransactions', initialBankTransactions));
  const [txnBankLinks, setTxnBankLinks] = useState<TxnBankLink[]>(() => loadInitial('txnBankLinks', initialTxnBankLinks));
  const [approvals, setApprovals] = useState<Approval[]>(() => loadInitial('approvals', initialApprovals));
  const [comments, setComments] = useState<Comment[]>(() => loadInitial('comments', initialComments));
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>(() => loadInitial('pendingTransactions', initialPendingTransactions));
  const [statementUploads, setStatementUploads] = useState<StatementUpload[]>(() => {
    const loaded = loadInitial('statementUploads', initialStatementUploads);
    // Purge legacy mock placeholder uploads that used fake 'banking-docs-prod' or mock filenames
    return loaded.map(s => {
      if (s.r2_bucket === 'banking-docs-prod' || (s.file_name && s.file_name.includes('_Statement_2026-'))) {
        return {
          ...s,
          status: 'pending' as const,
          r2_bucket: undefined,
          r2_object_key: undefined,
          file_name: undefined,
          file_size_bytes: undefined,
          uploaded_by: undefined,
          uploaded_at: undefined,
        };
      }
      return s;
    });
  });
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    const loaded = loadInitial('documents', initialDocuments);
    return loaded.filter(d => d.r2_bucket !== 'banking-docs-prod');
  });
  const [recordVersions, setRecordVersions] = useState<RecordVersion[]>(() => loadInitial('recordVersions', initialRecordVersions));
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>(() => loadInitial('passwordResetRequests', []));

  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [lastRealtimeNotice, setLastRealtimeNotice] = useState<string | null>(null);

  // Live Multi-Currency Forex Rates (Real-Time Market Sync)
  const [liveForexRates, setLiveForexRates] = useState<LiveForexRates>({
    timestamp: Date.now(),
    ratesToInr: { INR: 1, AED: 26.02, USD: 95.50, EUR: 103.20, GBP: 122.40 },
    isLive: false,
    lastUpdatedText: 'Initialising...',
  });

  const refreshForexRates = async () => {
    const fresh = await fetchLiveForexRates();
    setLiveForexRates(fresh);
  };

  useEffect(() => {
    refreshForexRates();
    const interval = setInterval(refreshForexRates, 30 * 60 * 1000); // Check every 30 mins
    return () => clearInterval(interval);
  }, []);

  const notifyRealtime = (msg: string) => {
    setLastRealtimeNotice(msg);
    setTimeout(() => {
      setLastRealtimeNotice(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  // Sync to localStorage
  const save = (key: string, data: any) => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  // ---------------------------------------------------------------------------
  // SUPABASE REALTIME SYNC ENGINE: Initial Fetch & Live WebSockets
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let isMounted = true;

    async function syncFromSupabase(client: NonNullable<typeof supabase>) {
      try {
        const [
          compRes,
          usrRes,
          ucRes,
          accRes,
          sigRes,
          ptyRes,
          aliasRes,
          tplRes,
          uTxnRes,
          bTxnRes,
          linksRes,
          apprRes,
          cmtRes,
          pendRes,
          stmtRes,
          docRes,
          verRes,
          setRes,
          resetRes,
        ] = await Promise.all([
          client.from('companies').select('*'),
          client.from('users').select('*'),
          client.from('user_companies').select('*'),
          client.from('accounts').select('*'),
          client.from('account_signatories').select('*'),
          client.from('parties').select('*'),
          client.from('party_aliases').select('*'),
          client.from('party_description_templates').select('*'),
          client.from('transactions_user').select('*').order('created_at', { ascending: false }),
          client.from('transactions_bank').select('*').order('value_date', { ascending: false }),
          client.from('txn_bank_links').select('*'),
          client.from('approvals').select('*'),
          client.from('comments').select('*').order('created_at', { ascending: true }),
          client.from('pending_transactions').select('*'),
          client.from('statement_uploads').select('*'),
          client.from('documents').select('*'),
          client.from('record_versions').select('*').order('changed_at', { ascending: false }),
          client.from('app_settings').select('*'),
          client.from('password_reset_requests').select('*').order('created_at', { ascending: false }),
        ]);

        if (!isMounted) return;

        if (!compRes.error && compRes.data && compRes.data.length > 0) {
          setCompanies(compRes.data);
          save('companies', compRes.data);
        }
        if (!usrRes.error && usrRes.data && usrRes.data.length > 0) {
          setUsers(usrRes.data);
          save('users', usrRes.data);
        }
        if (!ucRes.error && Array.isArray(ucRes.data)) {
          setUserCompanies(ucRes.data);
          save('userCompanies', ucRes.data);
        }
        if (!accRes.error && accRes.data && accRes.data.length > 0) {
          setAccounts(accRes.data);
          save('accounts', accRes.data);
        }
        if (!sigRes.error && Array.isArray(sigRes.data)) {
          setSignatories(sigRes.data);
          save('signatories', sigRes.data);
        }
        if (!ptyRes.error && ptyRes.data && ptyRes.data.length > 0) {
          setParties(ptyRes.data);
          save('parties', ptyRes.data);
        }
        if (!aliasRes.error && Array.isArray(aliasRes.data)) {
          setPartyAliases(aliasRes.data);
          save('partyAliases', aliasRes.data);
        }
        if (!tplRes.error && Array.isArray(tplRes.data)) {
          setPartyTemplates(tplRes.data);
          save('partyTemplates', tplRes.data);
        }
        if (!uTxnRes.error && Array.isArray(uTxnRes.data)) {
          setUserTransactions(uTxnRes.data);
          save('userTransactions', uTxnRes.data);
        }
        if (!bTxnRes.error && Array.isArray(bTxnRes.data)) {
          setBankTransactions(bTxnRes.data);
          save('bankTransactions', bTxnRes.data);
        }
        if (!linksRes.error && Array.isArray(linksRes.data)) {
          setTxnBankLinks(linksRes.data);
          save('txnBankLinks', linksRes.data);
        }
        if (!apprRes.error && Array.isArray(apprRes.data)) {
          setApprovals(apprRes.data);
          save('approvals', apprRes.data);
        }
        if (!cmtRes.error && Array.isArray(cmtRes.data)) {
          setComments(cmtRes.data);
          save('comments', cmtRes.data);
        }
        if (!pendRes.error && Array.isArray(pendRes.data)) {
          setPendingTransactions(pendRes.data);
          save('pendingTransactions', pendRes.data);
        }
        if (!stmtRes.error && Array.isArray(stmtRes.data)) {
          setStatementUploads(stmtRes.data);
          save('statementUploads', stmtRes.data);
        }
        if (!docRes.error && Array.isArray(docRes.data)) {
          setDocuments(docRes.data);
          save('documents', docRes.data);
        }
        if (!verRes.error && Array.isArray(verRes.data)) {
          setRecordVersions(verRes.data);
          save('recordVersions', verRes.data);
        }
        if (!setRes.error && setRes.data && setRes.data.length > 0) {
          setAppSettings(setRes.data);
          save('appSettings', setRes.data);
        }
        if (!resetRes.error && Array.isArray(resetRes.data)) {
          setPasswordResetRequests(resetRes.data as PasswordResetRequest[]);
          save('passwordResetRequests', resetRes.data);
        }
      } catch (err) {
        console.warn('Supabase initial fetch skipped (operating with local cache):', err);
      }
    }

    syncFromSupabase(sb);

    // Setup Realtime WebSocket Listener for instant cross-user multi-device sync
    const realtimeChannel = sb
      .channel('starruby-realtime-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions_user' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as UserTransaction;
          setUserTransactions(prev => {
            const next = [row, ...prev.filter(t => t.id !== row.id)];
            save('userTransactions', next);
            return next;
          });
          notifyRealtime(`Live Sync: New transaction ${row.id} added (${row.currency} ${row.amount})`);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as UserTransaction;
          setUserTransactions(prev => {
            const next = prev.map(t => (t.id === row.id ? row : t));
            save('userTransactions', next);
            return next;
          });
          notifyRealtime(`Live Sync: Transaction ${row.id} updated (Status: ${row.status})`);
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any).id;
          setUserTransactions(prev => {
            const next = prev.filter(t => t.id !== oldId);
            save('userTransactions', next);
            return next;
          });
          notifyRealtime(`Live Sync: Transaction ${oldId} removed`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions_bank' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as BankTransaction;
          setBankTransactions(prev => {
            const next = [row, ...prev.filter(t => t.id !== row.id)];
            save('bankTransactions', next);
            return next;
          });
          notifyRealtime(`Live Sync: Bank statement line ${row.id} received`);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as BankTransaction;
          setBankTransactions(prev => {
            const next = prev.map(t => (t.id === row.id ? row : t));
            save('bankTransactions', next);
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any).id;
          setBankTransactions(prev => {
            const next = prev.filter(t => t.id !== oldId);
            save('bankTransactions', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Approval;
          setApprovals(prev => {
            const next = [...prev.filter(a => a.id !== row.id), row];
            save('approvals', next);
            return next;
          });
          notifyRealtime(`Live Sync: Transaction ${row.user_txn_id} Layer ${row.layer} ${row.decision}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Comment;
          setComments(prev => {
            const next = [...prev.filter(c => c.id !== row.id), row];
            save('comments', next);
            return next;
          });
          notifyRealtime(`Live Sync: New note on transaction ${row.user_txn_id}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'txn_bank_links' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as TxnBankLink;
          setTxnBankLinks(prev => {
            const next = [...prev.filter(l => l.id !== row.id), row];
            save('txnBankLinks', next);
            return next;
          });
          notifyRealtime(`Live Sync: Bank entry matched & linked`);
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any).id;
          setTxnBankLinks(prev => {
            const next = prev.filter(l => l.id !== oldId);
            save('txnBankLinks', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_aliases' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as PartyAlias;
          setPartyAliases(prev => {
            const next = [...prev.filter(a => a.id !== row.id), row];
            save('partyAliases', next);
            return next;
          });
          notifyRealtime(`Live Sync: Party alias ${row.alias_name} updated`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as Party;
          setParties(prev => {
            const next = [...prev.filter(p => p.id !== row.id), row];
            save('parties', next);
            return next;
          });
          notifyRealtime(`Live Sync: Party ${row.system_name || row.party_name} updated`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_description_templates' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as PartyDescriptionTemplate;
          setPartyTemplates(prev => {
            const next = [...prev.filter(t => t.id !== row.id), row];
            save('partyTemplates', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_transactions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as PendingTransaction;
          setPendingTransactions(prev => {
            const next = [...prev.filter(p => p.id !== row.id), row];
            save('pendingTransactions', next);
            return next;
          });
          notifyRealtime(`Live Sync: Expected payment queue updated`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statement_uploads' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as StatementUpload;
          setStatementUploads(prev => {
            const next = [...prev.filter(s => s.id !== row.id), row];
            save('statementUploads', next);
            return next;
          });
          notifyRealtime(`Live Sync: Bank statement uploaded for ${row.account_id}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as DocumentRecord;
          setDocuments(prev => {
            const next = [row, ...prev.filter(d => d.id !== row.id)];
            save('documents', next);
            return next;
          });
          notifyRealtime(`Live Sync: Document ${row.file_name} attached`);
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any).id;
          setDocuments(prev => {
            const next = prev.filter(d => d.id !== oldId);
            save('documents', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'record_versions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as RecordVersion;
          setRecordVersions(prev => {
            const next = [row, ...prev.filter(v => v.id !== row.id)];
            save('recordVersions', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as Account;
          setAccounts(prev => {
            const next = [...prev.filter(a => a.id !== row.id), row];
            save('accounts', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const row = payload.new as AppSetting;
          setAppSettings(prev => {
            const next = [...prev.filter(s => s.setting_key !== row.setting_key), row];
            save('appSettings', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as PasswordResetRequest;
          setPasswordResetRequests(prev => {
            const next = [row, ...prev.filter(r => r.id !== row.id)];
            save('passwordResetRequests', next);
            return next;
          });
          if (payload.eventType === 'INSERT') {
            notifyRealtime(`Live Sync: Password reset requested by ${row.email}`);
          }
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any).id;
          setPasswordResetRequests(prev => {
            const next = prev.filter(r => r.id !== oldId);
            save('passwordResetRequests', next);
            return next;
          });
        }
      })
      .subscribe((status) => {
        console.log('[Supabase Realtime] Global channel status:', status);
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      isMounted = false;
      sb.removeChannel(realtimeChannel);
    };
  }, []);

  // Derive Current User Role
  const currentRole = accessLevels.find(a => a.id === currentUser.access_level_id)?.level_type || 'Staff';

  // Allowed companies based on role: Admin, Accountant, Staff have all companies; Manager has assigned companies only
  const allowedCompanies = React.useMemo(() => {
    if (currentRole === 'Admin' || currentRole === 'Accountant' || currentRole === 'Staff') {
      return companies;
    }
    const assignedIds = new Set(userCompanies.filter(uc => uc.user_id === currentUser.id).map(uc => uc.company_id));
    return companies.filter(c => assignedIds.has(c.id));
  }, [currentRole, currentUser.id, companies, userCompanies]);

  // Auto-enforce activeCompanyId scoping when user role or assignments change
  useEffect(() => {
    if (currentRole === 'Manager') {
      const allowedIds = allowedCompanies.map(c => c.id);
      if (!allowedIds.includes(activeCompanyId)) {
        setActiveCompanyId(allowedIds[0] || 'COM1');
      }
    }
  }, [currentRole, currentUser.id, allowedCompanies, activeCompanyId]);

  // Scoped Accounts based on Role and activeCompanyId
  const scopedAccounts = React.useMemo(() => {
    const allowedCompanyIds = new Set(allowedCompanies.map(c => c.id));
    const roleRestricted = accounts.filter(a => allowedCompanyIds.has(a.company_id));
    if (activeCompanyId === 'ALL') {
      return roleRestricted;
    }
    return roleRestricted.filter(a => a.company_id === activeCompanyId);
  }, [accounts, allowedCompanies, activeCompanyId]);

  const scopedAccountIds = React.useMemo(() => {
    return new Set(scopedAccounts.map(a => a.id));
  }, [scopedAccounts]);

  const scopedUserTransactions = React.useMemo(() => {
    return userTransactions.filter(t => scopedAccountIds.has(t.account_id));
  }, [userTransactions, scopedAccountIds]);

  const scopedBankTransactions = React.useMemo(() => {
    return bankTransactions.filter(b => scopedAccountIds.has(b.account_id));
  }, [bankTransactions, scopedAccountIds]);

  const scopedPendingTransactions = React.useMemo(() => {
    return pendingTransactions.filter(p => scopedAccountIds.has(p.account_id));
  }, [pendingTransactions, scopedAccountIds]);

  const scopedStatementUploads = React.useMemo(() => {
    return statementUploads.filter(s => scopedAccountIds.has(s.account_id));
  }, [statementUploads, scopedAccountIds]);

  // Parties Map for O(1) lookups
  const partiesMap = React.useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach(p => map.set(p.id, p));
    return map;
  }, [parties]);

  // Operational Action 1: Add User Transaction
  const addUserTransaction = (data: Omit<UserTransaction, 'id' | 'date_of_entry' | 'status' | 'created_by' | 'created_at' | 'updated_at'>): UserTransaction => {
    // Collision-free ID generation: max(existing) + 1
    const maxNum = userTransactions.reduce((acc, t) => {
      const num = parseInt(t.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    const newId = `UTRN${maxNum + 1}`;
    const now = new Date().toISOString();

    // Check Party Alias Auto-resolution
    let resolvedPartyId = data.party_id;
    const normalizedTyped = normalizeAlias(data.party_name_raw);

    // If no party_id, check aliases
    if (!resolvedPartyId) {
      const existingAlias = partyAliases.find(a => a.alias_normalized === normalizedTyped && a.status === 'mapped');
      if (existingAlias && existingAlias.party_id) {
        resolvedPartyId = existingAlias.party_id;
      } else {
        // Create an alias record if brand new
        const aliasExists = partyAliases.some(a => a.alias_normalized === normalizedTyped);
        if (!aliasExists && normalizedTyped) {
          // Check exact party system name match
          const exactParty = parties.find(p => normalizeAlias(p.system_name || p.party_name || '') === normalizedTyped);
          const maxAliasNum = partyAliases.reduce((acc, a) => {
            const num = parseInt(a.id.replace(/\D/g, ''), 10);
            return isNaN(num) ? acc : Math.max(acc, num);
          }, 0);
          const newAlias: PartyAlias = {
            id: `PALIAS${maxAliasNum + 1}`,
            alias_name: data.party_name_raw,
            alias_normalized: normalizedTyped,
            party_id: exactParty?.id,
            status: exactParty ? 'mapped' : 'unmapped',
            created_by: currentUser.id,
            created_at: now,
          };
          const updatedAliases = [...partyAliases, newAlias];
          setPartyAliases(updatedAliases);
          save('partyAliases', updatedAliases);

          if (supabase) {
            supabase.from('party_aliases').insert([newAlias]).then(() => {});
          }

          if (exactParty) resolvedPartyId = exactParty.id;
        }
      }
    }

    const newTxn: UserTransaction = {
      ...data,
      id: newId,
      party_id: resolvedPartyId,
      date_of_entry: new Date().toISOString().slice(0, 10),
      status: 'open',
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const updatedTxns = [newTxn, ...userTransactions];
    setUserTransactions(updatedTxns);
    save('userTransactions', updatedTxns);

    // Live Supabase Sync
    if (supabase) {
      supabase.from('transactions_user').insert([newTxn]).then(({ error }) => {
        if (error) console.warn('Supabase insert user transaction notice:', error.message);
      });
    }

    // Check Pending Queue for same-amount auto-suggestions!
    const matchingPending = findPendingQueueMatches(newTxn, pendingTransactions);
    if (matchingPending.length > 0) {
      const updatedPending = pendingTransactions.map(p => {
        if (matchingPending.some(m => m.id === p.id)) {
          if (supabase) {
            supabase.from('pending_transactions').update({ status: 'suggested' }).eq('id', p.id);
          }
          return { ...p, status: 'suggested' as const };
        }
        return p;
      });
      setPendingTransactions(updatedPending);
      save('pendingTransactions', updatedPending);
    }

    return newTxn;
  };

  // Operational Action 1b: Batch Insert User Transactions (Guarantees unique sequential IDs without closure clash)
  const addUserTransactionsBatch = (
    txnsData: Omit<UserTransaction, 'id' | 'date_of_entry' | 'status' | 'created_by' | 'created_at' | 'updated_at'>[]
  ): UserTransaction[] => {
    if (txnsData.length === 0) return [];

    let currentMax = userTransactions.reduce((acc, t) => {
      const num = parseInt(t.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const newTxns: UserTransaction[] = [];

    for (const data of txnsData) {
      currentMax++;
      const newId = `UTRN${currentMax}`;

      // Resolve party if raw name provided
      let resolvedPartyId = data.party_id;
      if (!resolvedPartyId && data.party_name_raw) {
        const norm = normalizeAlias(data.party_name_raw);
        const match = parties.find(
          p => (p.system_name && normalizeAlias(p.system_name) === norm) ||
               normalizeAlias(p.party_name) === norm
        );
        if (match) resolvedPartyId = match.id;
      }

      newTxns.push({
        ...data,
        id: newId,
        party_id: resolvedPartyId,
        date_of_entry: today,
        status: 'open',
        created_by: currentUser.id,
        created_at: now,
        updated_at: now,
      });
    }

    const updatedTxns = [...newTxns, ...userTransactions];
    setUserTransactions(updatedTxns);
    save('userTransactions', updatedTxns);

    if (supabase) {
      supabase.from('transactions_user').insert(newTxns).then(({ error }) => {
        if (error) console.warn('Supabase batch insert error:', error.message);
      });
    }

    return newTxns;
  };

  // Operational Action 2: Delete User Transaction (Logged with who & when)
  const deleteUserTransaction = (id: string, reason: string): boolean => {
    const existing = userTransactions.find(t => t.id === id);
    if (!existing) return false;

    // Log deletion into record versions
    const maxVerId = recordVersions.reduce((acc, v) => Math.max(acc, v.id), 1000);
    const versionDelta: RecordVersion = {
      id: maxVerId + 1,
      table_name: 'transactions_user',
      record_id: id,
      column_name: 'STATUS_DELETED',
      old_value: existing.status,
      new_value: `DELETED: ${reason}`,
      version_no: 1,
      changed_by: currentUser.id,
      changed_at: new Date().toISOString(),
    };
    const updatedVersions = [versionDelta, ...recordVersions];
    setRecordVersions(updatedVersions);
    save('recordVersions', updatedVersions);

    const updatedTxns = userTransactions.filter(t => t.id !== id);
    setUserTransactions(updatedTxns);
    save('userTransactions', updatedTxns);

    if (supabase) {
      supabase.from('transactions_user').delete().eq('id', id).then(() => {});
      supabase.from('record_versions').insert([versionDelta]).then(() => {});
    }

    return true;
  };

  // Operational Action 3: Update Cell with Audit Version Logging
  const updateUserTransactionCell = (id: string, column: keyof UserTransaction, value: any) => {
    const existing = userTransactions.find(t => t.id === id);
    if (!existing) return;

    const updated = { ...existing, [column]: value, updated_at: new Date().toISOString() };
    const deltas = createCellAuditDelta('transactions_user', id, existing, updated, currentUser.id, recordVersions);

    if (deltas.length > 0) {
      const updatedVersions = [...deltas, ...recordVersions];
      setRecordVersions(updatedVersions);
      save('recordVersions', updatedVersions);
      if (supabase) {
        supabase.from('record_versions').insert(deltas).then(() => {});
      }
    }

    const updatedTxns = userTransactions.map(t => (t.id === id ? updated : t));
    setUserTransactions(updatedTxns);
    save('userTransactions', updatedTxns);

    if (supabase) {
      supabase.from('transactions_user').update({ [column]: value, updated_at: updated.updated_at }).eq('id', id).then(() => {});
    }
  };

  // Operational Action 3b: Update User Transaction (Full Record CRUD)
  const updateUserTransaction = (id: string, updates: Partial<UserTransaction>) => {
    const existing = userTransactions.find(t => t.id === id);
    if (!existing) return;

    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    const deltas = createCellAuditDelta('transactions_user', id, existing, updated, currentUser.id, recordVersions);

    if (deltas.length > 0) {
      const updatedVersions = [...deltas, ...recordVersions];
      setRecordVersions(updatedVersions);
      save('recordVersions', updatedVersions);
      if (supabase) {
        supabase.from('record_versions').insert(deltas).then(() => {});
      }
    }

    const updatedTxns = userTransactions.map(t => (t.id === id ? updated : t));
    setUserTransactions(updatedTxns);
    save('userTransactions', updatedTxns);

    if (supabase) {
      supabase.from('transactions_user').update(updates).eq('id', id).then(() => {});
    }
  };

  // Operational Action 4: Bank Statement Transaction Entry
  const addBankTransaction = (data: Omit<BankTransaction, 'id' | 'created_by' | 'created_at' | 'updated_at'>): BankTransaction => {
    const maxNum = bankTransactions.reduce((acc, t) => {
      const num = parseInt(t.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    const newId = `BTRN${maxNum + 1}`;
    const now = new Date().toISOString();

    const newTxn: BankTransaction = {
      ...data,
      id: newId,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    const updated = [newTxn, ...bankTransactions];
    setBankTransactions(updated);
    save('bankTransactions', updated);

    if (supabase) {
      supabase.from('transactions_bank').insert([newTxn]).then(({ error }) => {
        if (error) console.warn('Supabase insert bank transaction notice:', error.message);
      });
    }

    return newTxn;
  };

  const deleteBankTransaction = (id: string, reason: string): boolean => {
    const existing = bankTransactions.find(t => t.id === id);
    if (!existing) return false;

    const maxVerId = recordVersions.reduce((acc, v) => Math.max(acc, v.id), 1000);
    const versionDelta: RecordVersion = {
      id: maxVerId + 1,
      table_name: 'transactions_bank',
      record_id: id,
      column_name: 'STATUS_DELETED',
      old_value: 'active',
      new_value: `DELETED: ${reason}`,
      version_no: 1,
      changed_by: currentUser.id,
      changed_at: new Date().toISOString(),
    };
    const updatedVersions = [versionDelta, ...recordVersions];
    setRecordVersions(updatedVersions);
    save('recordVersions', updatedVersions);

    const updated = bankTransactions.filter(t => t.id !== id);
    setBankTransactions(updated);
    save('bankTransactions', updated);

    if (supabase) {
      supabase.from('transactions_bank').delete().eq('id', id).then(() => {});
      supabase.from('record_versions').insert([versionDelta]).then(() => {});
    }

    return true;
  };

  // Operational Action 5: Link Bank Transactions (Many-to-Many)
  const linkTxnBank = (userTxnId: string, bankTxnId: string, method: 'manual' | 'csv' = 'manual') => {
    const alreadyLinked = txnBankLinks.some(l => l.user_txn_id === userTxnId && l.bank_txn_id === bankTxnId);
    if (alreadyLinked) return;

    const maxLinkId = txnBankLinks.reduce((acc, l) => Math.max(acc, l.id), 0);
    const newLink: TxnBankLink = {
      id: maxLinkId + 1,
      user_txn_id: userTxnId,
      bank_txn_id: bankTxnId,
      linked_by: currentUser.id,
      link_method: method,
      created_at: new Date().toISOString(),
    };

    const updated = [...txnBankLinks, newLink];
    setTxnBankLinks(updated);
    save('txnBankLinks', updated);

    if (supabase) {
      supabase.from('txn_bank_links').insert([newLink]).then(() => {});
    }
  };

  const unlinkTxnBank = (userTxnId: string, bankTxnId: string) => {
    const updated = txnBankLinks.filter(l => !(l.user_txn_id === userTxnId && l.bank_txn_id === bankTxnId));
    setTxnBankLinks(updated);
    save('txnBankLinks', updated);

    if (supabase) {
      supabase.from('txn_bank_links').delete().eq('user_txn_id', userTxnId).eq('bank_txn_id', bankTxnId).then(() => {});
    }
  };

  // Operational Action 6: Match Tab Close (Layer 1 Approval)
  const closeInMatchTab = (userTxnId: string, linkedBankIds: string[], verifiedWithBank: 'Yes' | 'No', comment?: string) => {
    if (currentRole === 'Staff') return;

    // 1. Link all selected bank lines
    for (const bankId of linkedBankIds) {
      linkTxnBank(userTxnId, bankId, 'manual');
    }

    // 2. Record Layer 1 Approval
    const maxApprId = approvals.reduce((acc, a) => Math.max(acc, a.id), 0);
    const layer1Approval: Approval = {
      id: maxApprId + 1,
      user_txn_id: userTxnId,
      layer: 1,
      approver_id: currentUser.id,
      decision: 'approved',
      comment: comment || `Closed in Match Tab with ${linkedBankIds.length} linked bank lines`,
      decided_at: new Date().toISOString(),
    };
    const updatedApprovals = [...approvals.filter(a => !(a.user_txn_id === userTxnId && a.layer === 1)), layer1Approval];
    setApprovals(updatedApprovals);
    save('approvals', updatedApprovals);

    // 3. Update transaction status to 'in_approval' and update verified_with_bank flag
    const txn = userTransactions.find(t => t.id === userTxnId);
    if (txn) {
      const updated = {
        ...txn,
        status: 'in_approval' as const,
        verified_with_bank: verifiedWithBank,
        updated_at: new Date().toISOString(),
      };
      const deltas = createCellAuditDelta('transactions_user', userTxnId, txn, updated, currentUser.id, recordVersions);
      if (deltas.length > 0) {
        const updatedV = [...deltas, ...recordVersions];
        setRecordVersions(updatedV);
        save('recordVersions', updatedV);
        if (supabase) {
          supabase.from('record_versions').insert(deltas).then(() => {});
        }
      }
      const updatedTxns = userTransactions.map(t => (t.id === userTxnId ? updated : t));
      setUserTransactions(updatedTxns);
      save('userTransactions', updatedTxns);

      if (supabase) {
        supabase.from('approvals').upsert([layer1Approval], { onConflict: 'user_txn_id, layer' }).then(() => {});
        supabase.from('transactions_user').update({
          status: 'in_approval',
          verified_with_bank: verifiedWithBank,
          updated_at: updated.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }
    }
  };

  // Operational Action 7: 3-Layer Approvals Machine
  const submitApproval = (
    userTxnId: string,
    layer: 1 | 2 | 3,
    decision: 'approved' | 'rejected',
    comment?: string
  ): { success: boolean; message: string } => {
    const txn = userTransactions.find(t => t.id === userTxnId);
    if (!txn) return { success: false, message: 'Transaction not found' };

    const maxApprId = approvals.reduce((acc, a) => Math.max(acc, a.id), 0);

    // Rejection at any layer reverts status to 'open'
    if (decision === 'rejected') {
      const approvalRecord: Approval = {
        id: maxApprId + 1,
        user_txn_id: userTxnId,
        layer,
        approver_id: currentUser.id,
        decision: 'rejected',
        comment: comment || 'Rejected',
        decided_at: new Date().toISOString(),
      };
      const updatedApprovals = [...approvals.filter(a => !(a.user_txn_id === userTxnId && a.layer === layer)), approvalRecord];
      setApprovals(updatedApprovals);
      save('approvals', updatedApprovals);

      const updatedTxn = { ...txn, status: 'open' as const, updated_at: new Date().toISOString() };
      const deltas = createCellAuditDelta('transactions_user', userTxnId, txn, updatedTxn, currentUser.id, recordVersions);
      if (deltas.length > 0) {
        setRecordVersions([...deltas, ...recordVersions]);
        save('recordVersions', [...deltas, ...recordVersions]);
        if (supabase) {
          supabase.from('record_versions').insert(deltas).then(() => {});
        }
      }
      const updatedTxns = userTransactions.map(t => (t.id === userTxnId ? updatedTxn : t));
      setUserTransactions(updatedTxns);
      save('userTransactions', updatedTxns);

      if (supabase) {
        supabase.from('approvals').upsert([approvalRecord], { onConflict: 'user_txn_id, layer' }).then(() => {});
        supabase.from('transactions_user').update({
          status: 'open',
          updated_at: updatedTxn.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }

      return { success: true, message: `Transaction rejected at Layer ${layer} and reverted to open status for correction.` };
    }

    // LAYER 1: Match Tab Close / Verification
    if (layer === 1) {
      if (currentRole === 'Staff') {
        return { success: false, message: 'Staff users cannot approve Layer 1.' };
      }

      const layer1Approval: Approval = {
        id: maxApprId + 1,
        user_txn_id: userTxnId,
        layer: 1,
        approver_id: currentUser.id,
        decision: 'approved',
        comment: comment || 'Layer 1 approved',
        decided_at: new Date().toISOString(),
      };
      const updatedApprovals = [...approvals.filter(a => !(a.user_txn_id === userTxnId && a.layer === 1)), layer1Approval];
      setApprovals(updatedApprovals);
      save('approvals', updatedApprovals);

      const updatedTxn = { ...txn, status: 'in_approval' as const, updated_at: new Date().toISOString() };
      const deltas = createCellAuditDelta('transactions_user', userTxnId, txn, updatedTxn, currentUser.id, recordVersions);
      if (deltas.length > 0) {
        setRecordVersions([...deltas, ...recordVersions]);
        save('recordVersions', [...deltas, ...recordVersions]);
        if (supabase) {
          supabase.from('record_versions').insert(deltas).then(() => {});
        }
      }
      const updatedTxns = userTransactions.map(t => (t.id === userTxnId ? updatedTxn : t));
      setUserTransactions(updatedTxns);
      save('userTransactions', updatedTxns);

      if (supabase) {
        supabase.from('approvals').upsert([layer1Approval], { onConflict: 'user_txn_id, layer' }).then(() => {});
        supabase.from('transactions_user').update({
          status: 'in_approval',
          updated_at: updatedTxn.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }

      return { success: true, message: 'Layer 1 approved! Transaction is in approval pipeline.' };
    }

    // LAYER 2: Admin Approval (Harshil OR Vismay)
    if (layer === 2) {
      if (currentRole !== 'Admin') {
        return { success: false, message: 'Only Admins (Harshil or Vismay) can approve Layer 2.' };
      }

      const layer2Approval: Approval = {
        id: maxApprId + 1,
        user_txn_id: userTxnId,
        layer: 2,
        approver_id: currentUser.id,
        decision: 'approved',
        comment: comment || 'Admin approved — Ready for Accounting',
        decided_at: new Date().toISOString(),
      };
      const updatedApprovals = [...approvals.filter(a => !(a.user_txn_id === userTxnId && a.layer === 2)), layer2Approval];
      setApprovals(updatedApprovals);
      save('approvals', updatedApprovals);

      // Status becomes 'approved' (ready for accounting entry!)
      const updatedTxn = { ...txn, status: 'approved' as const, updated_at: new Date().toISOString() };
      const deltas = createCellAuditDelta('transactions_user', userTxnId, txn, updatedTxn, currentUser.id, recordVersions);
      if (deltas.length > 0) {
        setRecordVersions([...deltas, ...recordVersions]);
        save('recordVersions', [...deltas, ...recordVersions]);
        if (supabase) {
          supabase.from('record_versions').insert(deltas).then(() => {});
        }
      }
      const updatedTxns = userTransactions.map(t => (t.id === userTxnId ? updatedTxn : t));
      setUserTransactions(updatedTxns);
      save('userTransactions', updatedTxns);

      if (supabase) {
        supabase.from('approvals').upsert([layer2Approval], { onConflict: 'user_txn_id, layer' }).then(() => {});
        supabase.from('transactions_user').update({
          status: 'approved',
          updated_at: updatedTxn.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }

      return { success: true, message: 'Layer 2 approved by Admin! Transaction is now READY FOR ACCOUNTING.' };
    }

    // LAYER 3: Final Review & Closure (MUST BE THE OTHER ADMIN!)
    if (layer === 3) {
      if (currentRole !== 'Admin') {
        return { success: false, message: 'Only Admins can perform Layer 3 Final Review.' };
      }

      // Check who approved Layer 2
      const layer2 = approvals.find(a => a.user_txn_id === userTxnId && a.layer === 2 && a.decision === 'approved');
      if (!layer2) {
        return { success: false, message: 'Layer 2 must be approved before Layer 3 final review.' };
      }

      if (layer2.approver_id === currentUser.id) {
        const layer2ApproverName = users.find(u => u.id === layer2.approver_id)?.full_name || 'the first Admin';
        return {
          success: false,
          message: `Admin Exclusivity Rule: Layer 3 review must be done by the OTHER Admin. Already approved at Layer 2 by ${layer2ApproverName}. Please switch to the other Admin to close this transaction.`,
        };
      }

      const layer3Approval: Approval = {
        id: maxApprId + 1,
        user_txn_id: userTxnId,
        layer: 3,
        approver_id: currentUser.id,
        decision: 'approved',
        comment: comment || 'Final review complete — Transaction Closed',
        decided_at: new Date().toISOString(),
      };
      const updatedApprovals = [...approvals.filter(a => !(a.user_txn_id === userTxnId && a.layer === 3)), layer3Approval];
      setApprovals(updatedApprovals);
      save('approvals', updatedApprovals);

      // Status closed
      const updatedTxn = { ...txn, status: 'approved' as const, updated_at: new Date().toISOString() };
      const deltas = createCellAuditDelta('transactions_user', userTxnId, txn, updatedTxn, currentUser.id, recordVersions);
      if (deltas.length > 0) {
        setRecordVersions([...deltas, ...recordVersions]);
        save('recordVersions', [...deltas, ...recordVersions]);
        if (supabase) {
          supabase.from('record_versions').insert(deltas).then(() => {});
        }
      }
      const updatedTxns = userTransactions.map(t => (t.id === userTxnId ? updatedTxn : t));
      setUserTransactions(updatedTxns);
      save('userTransactions', updatedTxns);

      if (supabase) {
        supabase.from('approvals').upsert([layer3Approval], { onConflict: 'user_txn_id, layer' }).then(() => {});
        supabase.from('transactions_user').update({
          status: 'approved',
          updated_at: updatedTxn.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }

      return { success: true, message: 'Layer 3 review completed by second Admin! Transaction is now FULLY CLOSED.' };
    }

    return { success: false, message: 'Invalid approval layer specified.' };
  };

  // Operational Action 7b: Company CRUD
  const addCompany = (data: Omit<Company, 'id' | 'created_at'>, customId?: string): Company => {
    let newId = customId;
    if (!newId) {
      const maxNum = companies.reduce((acc, c) => {
        const num = parseInt(c.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? acc : Math.max(acc, num);
      }, 0);
      newId = `COM${maxNum + 1}`;
    }
    const newCompany: Company = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
    };
    const updated = [...companies, newCompany];
    setCompanies(updated);
    save('companies', updated);
    if (supabase) {
      supabase.from('companies').insert([newCompany]).then(() => {});
    }
    return newCompany;
  };

  const updateCompany = (id: string, updates: Partial<Company>) => {
    const existing = companies.find(c => c.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    const deltas = createCellAuditDelta('companies', id, existing, updated, currentUser.id, recordVersions);
    if (deltas.length > 0) {
      setRecordVersions([...deltas, ...recordVersions]);
      save('recordVersions', [...deltas, ...recordVersions]);
      if (supabase) supabase.from('record_versions').insert(deltas).then(() => {});
    }
    const updatedCompanies = companies.map(c => (c.id === id ? updated : c));
    setCompanies(updatedCompanies);
    save('companies', updatedCompanies);
    if (supabase) {
      supabase.from('companies').update(updates).eq('id', id).then(() => {});
    }
  };

  const deleteCompany = (id: string): { success: boolean; error?: string } => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can delete companies.' };
    }
    const existing = companies.find(c => c.id === id);
    if (!existing) return { success: false, error: `Company ${id} does not exist.` };

    // Safeguard 1: Active Accounts under this company
    const linkedAccounts = accounts.filter(a => a.company_id === id);
    if (linkedAccounts.length > 0) {
      return {
        success: false,
        error: `Cannot delete company "${existing.full_name}" (${id}): It has ${linkedAccounts.length} active bank account(s) attached (${linkedAccounts.map(a => a.id).join(', ')}). Delete or reassign those bank accounts first.`,
      };
    }

    // Safeguard 2: Active User Transactions under this company
    const linkedAccIds = new Set(linkedAccounts.map(a => a.id));
    const linkedTxns = userTransactions.filter(t => linkedAccIds.has(t.account_id));
    if (linkedTxns.length > 0) {
      return {
        success: false,
        error: `Cannot delete company "${existing.full_name}" (${id}): There are ${linkedTxns.length} financial transaction(s) recorded under its bank accounts.`,
      };
    }

    // Remove user company assignments if any
    const updatedUC = userCompanies.filter(uc => uc.company_id !== id);
    if (updatedUC.length !== userCompanies.length) {
      setUserCompanies(updatedUC);
      save('userCompanies', updatedUC);
      if (supabase) {
        supabase.from('user_companies').delete().eq('company_id', id).then(() => {});
      }
    }

    const updated = companies.filter(c => c.id !== id);
    setCompanies(updated);
    save('companies', updated);
    if (supabase) {
      supabase.from('companies').delete().eq('id', id).then(() => {});
    }
    return { success: true };
  };

  // User Credentials & Password Reset Methods
  const setUserPassword = async (email: string, password: string, role: string = 'Staff', fullName: string = 'User'): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can set or reset passwords.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('set_user_password', {
          p_email: cleanEmail,
          p_password: password,
          p_role: role,
          p_full_name: fullName,
        });
        if (error) {
          console.warn('Supabase set_user_password RPC notice:', error.message);
          const { error: upsertErr } = await supabase.from('user_credentials').upsert({
            email: cleanEmail,
            role,
            full_name: fullName,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });
          if (upsertErr) console.warn('Fallback upsert notice:', upsertErr.message);
        } else if (data && !data.success) {
          return { success: false, error: data.error };
        }
      } catch (err: any) {
        console.warn('Set user password error:', err);
      }
    }

    return { success: true };
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; requestId?: string; resetCode?: string; fullName?: string; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter your official email address.' };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('request_password_reset', { p_email: cleanEmail });
        if (error) {
          console.warn('request_password_reset RPC error:', error.message);
        } else if (data) {
          if (!data.success) {
            return { success: false, error: data.error };
          }
          return {
            success: true,
            requestId: data.request_id,
            resetCode: data.reset_code,
            fullName: data.full_name,
          };
        }
      } catch (err) {
        console.warn('Reset request exception:', err);
      }
    }

    // Local fallback for preview/offline
    const userFound = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!userFound) {
      return { success: false, error: 'No active user account found with this email.' };
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newReq: PasswordResetRequest = {
      id: `REQ-${Date.now()}`,
      email: cleanEmail,
      user_id: userFound.id,
      reset_code: code,
      status: 'pending',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newReq, ...passwordResetRequests.filter(r => !(r.email.toLowerCase() === cleanEmail && r.status === 'pending'))];
    setPasswordResetRequests(updated);
    save('passwordResetRequests', updated);

    if (supabase) {
      supabase.from('password_reset_requests').insert([newReq]).then(() => {});
    }

    return {
      success: true,
      requestId: newReq.id,
      resetCode: code,
      fullName: userFound.full_name,
    };
  };

  const approvePasswordReset = async (requestId: string, tempPassword?: string): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can approve password resets.' };
    }

    const req = passwordResetRequests.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'Reset request not found.' };

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('approve_password_reset', {
          p_request_id: requestId,
          p_admin_id: currentUser.id,
          p_temporary_password: tempPassword || null,
        });
        if (error) {
          console.warn('approve_password_reset RPC error:', error.message);
        }
      } catch (err) {
        console.warn('approve_password_reset exception:', err);
      }
    }

    const updated = passwordResetRequests.map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          status: 'approved' as const,
          temporary_password: tempPassword,
          approved_by: currentUser.id,
          updated_at: new Date().toISOString(),
        };
      }
      return r;
    });
    setPasswordResetRequests(updated);
    save('passwordResetRequests', updated);

    if (supabase) {
      supabase.from('password_reset_requests').update({
        status: 'approved',
        temporary_password: tempPassword,
        approved_by: currentUser.id,
        updated_at: new Date().toISOString(),
      }).eq('id', requestId).then(() => {});
    }

    return { success: true };
  };

  const rejectPasswordReset = async (requestId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can reject password resets.' };
    }

    const updated = passwordResetRequests.map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          status: 'rejected' as const,
          approved_by: currentUser.id,
          updated_at: new Date().toISOString(),
        };
      }
      return r;
    });
    setPasswordResetRequests(updated);
    save('passwordResetRequests', updated);

    if (supabase) {
      supabase.from('password_reset_requests').update({
        status: 'rejected',
        approved_by: currentUser.id,
        updated_at: new Date().toISOString(),
      }).eq('id', requestId).then(() => {});
    }

    return { success: true };
  };

  const completePasswordReset = async (email: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!cleanEmail || !cleanCode || !newPassword || newPassword.length < 6) {
      return { success: false, error: 'Please provide email, 6-digit code, and a password with at least 6 characters.' };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('complete_password_reset', {
          p_email: cleanEmail,
          p_reset_code: cleanCode,
          p_new_password: newPassword,
        });
        if (error) {
          console.warn('complete_password_reset RPC notice:', error.message);
        } else if (data) {
          if (!data.success) {
            return { success: false, error: data.error };
          }
          return { success: true };
        }
      } catch (err) {
        console.warn('complete_password_reset exception:', err);
      }
    }

    // Local fallback
    const req = passwordResetRequests.find(
      r => r.email.toLowerCase() === cleanEmail && r.reset_code === cleanCode && (r.status === 'pending' || r.status === 'approved')
    );
    if (!req) {
      return { success: false, error: 'Invalid or expired 6-digit security code.' };
    }

    const updated = passwordResetRequests.map(r => (r.id === req.id ? { ...r, status: 'completed' as const, updated_at: new Date().toISOString() } : r));
    setPasswordResetRequests(updated);
    save('passwordResetRequests', updated);

    if (supabase) {
      supabase.from('password_reset_requests').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', req.id).then(() => {});
    }

    return { success: true };
  };

  // Operational Action 7c: User & Roles CRUD
  const addUser = (data: Omit<User, 'id' | 'created_at'>, customId?: string, initialPassword?: string): User => {
    if (currentRole !== 'Admin') {
      console.warn('Unauthorized: Only Admins can create new users.');
      return { ...data, id: 'ERR', created_at: new Date().toISOString() };
    }

    let newId = customId;
    if (!newId) {
      const maxNum = users.reduce((acc, u) => {
        const num = parseInt(u.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? acc : Math.max(acc, num);
      }, 0);
      newId = `USR${maxNum + 1}`;
    }
    const newUser: User = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
    };
    const updated = [...users, newUser];
    setUsers(updated);
    save('users', updated);
    if (supabase) {
      supabase.from('users').insert([newUser]).then(() => {});
    }

    // If initial password was provided and user is Admin, set it securely
    if (initialPassword && initialPassword.trim()) {
      const roleLevel = accessLevels.find(a => a.id === data.access_level_id)?.level_type || 'Staff';
      setUserPassword(data.email, initialPassword.trim(), roleLevel, data.full_name);
    }

    return newUser;
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    if (currentRole !== 'Admin') return;
    const existing = users.find(u => u.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    const deltas = createCellAuditDelta('users', id, existing, updated, currentUser.id, recordVersions);
    if (deltas.length > 0) {
      setRecordVersions([...deltas, ...recordVersions]);
      save('recordVersions', [...deltas, ...recordVersions]);
      if (supabase) supabase.from('record_versions').insert(deltas).then(() => {});
    }
    const updatedUsers = users.map(u => (u.id === id ? updated : u));
    setUsers(updatedUsers);
    save('users', updatedUsers);
    if (supabase) {
      supabase.from('users').update(updates).eq('id', id).then(() => {});
    }
  };

  const deleteUser = (id: string): { success: boolean; error?: string } => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can delete users.' };
    }
    const existing = users.find(u => u.id === id);
    if (!existing) return { success: false, error: `User ${id} does not exist.` };

    if (id === currentUser.id) {
      return { success: false, error: 'Cannot delete your own active session user account.' };
    }

    // Safeguard 1: Created Transactions
    const createdTxns = userTransactions.filter(t => t.created_by === id);
    if (createdTxns.length > 0) {
      return {
        success: false,
        error: `Cannot delete user "${existing.full_name}" (${id}): User has created ${createdTxns.length} financial transaction(s). Please deactivate this user instead to preserve the immutable audit trail.`,
      };
    }

    // Safeguard 2: Approvals
    const signedApprovals = approvals.filter(a => a.approver_id === id);
    if (signedApprovals.length > 0) {
      return {
        success: false,
        error: `Cannot delete user "${existing.full_name}" (${id}): User has signed ${signedApprovals.length} approval record(s). Deactivate this user to preserve compliance history.`,
      };
    }

    // Safeguard 3: Bank Signatories
    const userSigs = signatories.filter(s => s.user_id === id);
    if (userSigs.length > 0) {
      return {
        success: false,
        error: `Cannot delete user "${existing.full_name}" (${id}): User is an active bank signatory on ${userSigs.length} account(s). Remove their signatory authorization first.`,
      };
    }

    // Clean user_companies
    const updatedUC = userCompanies.filter(uc => uc.user_id !== id);
    if (updatedUC.length !== userCompanies.length) {
      setUserCompanies(updatedUC);
      save('userCompanies', updatedUC);
      if (supabase) {
        supabase.from('user_companies').delete().eq('user_id', id).then(() => {});
      }
    }

    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    save('users', updated);
    if (supabase) {
      supabase.from('users').delete().eq('id', id).then(() => {});
      supabase.from('user_credentials').delete().eq('email', existing.email.toLowerCase()).then(() => {});
    }
    return { success: true };
  };

  const toggleUserActiveStatus = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can modify user active status.' };
    }
    const target = users.find(u => u.id === id);
    if (!target) return { success: false, error: `User ${id} not found.` };
    const nextStatus = target.is_active === false;
    const updatedUsers = users.map(u => (u.id === id ? { ...u, is_active: nextStatus } : u));
    setUsers(updatedUsers);
    save('users', updatedUsers);
    if (supabase) {
      supabase.from('users').update({ is_active: nextStatus }).eq('id', id).then(() => {});
      supabase.from('user_credentials').update({ is_active: nextStatus }).eq('email', target.email.toLowerCase()).then(() => {});
    }
    notifyRealtime(`User ${target.full_name} is now ${nextStatus ? 'Active' : 'Deactivated'}.`);
    return { success: true };
  };

  const addAccessLevel = (level: AccessLevel) => {
    const updated = [...accessLevels, level];
    setAccessLevels(updated);
    save('accessLevels', updated);
    if (supabase) {
      supabase.from('access_levels').insert([level]).then(() => {});
    }
  };

  // Operational Action 7d: Bank Account CRUD
  const addAccount = (data: Omit<Account, 'id' | 'created_at'>, customId?: string): Account => {
    let newId = customId;
    if (!newId) {
      const maxNum = accounts.reduce((acc, a) => {
        const num = parseInt(a.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? acc : Math.max(acc, num);
      }, 0);
      newId = `BNK${maxNum + 1}`;
    }
    const newAcc: Account = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
    };
    const updated = [...accounts, newAcc];
    setAccounts(updated);
    save('accounts', updated);
    if (supabase) {
      supabase.from('accounts').insert([newAcc]).then(() => {});
    }
    return newAcc;
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    const existing = accounts.find(a => a.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    const deltas = createCellAuditDelta('accounts', id, existing, updated, currentUser.id, recordVersions);
    if (deltas.length > 0) {
      setRecordVersions([...deltas, ...recordVersions]);
      save('recordVersions', [...deltas, ...recordVersions]);
      if (supabase) supabase.from('record_versions').insert(deltas).then(() => {});
    }
    const updatedAccounts = accounts.map(a => (a.id === id ? updated : a));
    setAccounts(updatedAccounts);
    save('accounts', updatedAccounts);
    if (supabase) {
      supabase.from('accounts').update(updates).eq('id', id).then(() => {});
    }
  };

  const deleteAccount = (id: string): { success: boolean; error?: string } => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can delete bank accounts.' };
    }
    const existing = accounts.find(a => a.id === id);
    if (!existing) return { success: false, error: `Account ${id} does not exist.` };

    // Safeguard 1: User Transactions
    const linkedUserTxns = userTransactions.filter(t => t.account_id === id);
    if (linkedUserTxns.length > 0) {
      return {
        success: false,
        error: `Cannot delete bank account "${existing.bank_name}" (${id}): It has ${linkedUserTxns.length} active transaction(s) recorded against it.`,
      };
    }

    // Safeguard 2: Bank Statement Transactions
    const linkedBankTxns = bankTransactions.filter(b => b.account_id === id);
    if (linkedBankTxns.length > 0) {
      return {
        success: false,
        error: `Cannot delete bank account "${existing.bank_name}" (${id}): It has ${linkedBankTxns.length} bank statement transaction(s) imported.`,
      };
    }

    // Safeguard 3: Statement Uploads
    const linkedUploads = statementUploads.filter(s => s.account_id === id && s.status === 'uploaded');
    if (linkedUploads.length > 0) {
      return {
        success: false,
        error: `Cannot delete bank account "${existing.bank_name}" (${id}): It has ${linkedUploads.length} uploaded statement file(s) registered. Delete or archive uploaded files first.`,
      };
    }

    // Remove signatories for this account
    const updatedSigs = signatories.filter(s => s.account_id !== id);
    if (updatedSigs.length !== signatories.length) {
      setSignatories(updatedSigs);
      save('signatories', updatedSigs);
      if (supabase) {
        supabase.from('account_signatories').delete().eq('account_id', id).then(() => {});
      }
    }

    // Remove placeholder/pending statement uploads for this account
    const updatedUploads = statementUploads.filter(s => s.account_id !== id);
    if (updatedUploads.length !== statementUploads.length) {
      setStatementUploads(updatedUploads);
      save('statementUploads', updatedUploads);
      if (supabase) {
        supabase.from('statement_uploads').delete().eq('account_id', id).then(() => {});
      }
    }

    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    save('accounts', updated);
    if (supabase) {
      supabase.from('accounts').delete().eq('id', id).then(() => {});
    }
    return { success: true };
  };

  // Operational Action 8: Party Management, Tag Bubbles & Aliases
  const addParty = (data: Omit<Party, 'id' | 'created_at'>, customId?: string): Party => {
    let newId = customId;
    if (!newId) {
      const maxNum = parties.reduce((acc, p) => {
        const num = parseInt(p.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? acc : Math.max(acc, num);
      }, 100);
      newId = `PTY${maxNum + 1}`;
    }

    const rawNames = Array.isArray(data.party_name_raw)
      ? data.party_name_raw
      : data.party_name_raw
      ? [data.party_name_raw]
      : data.party_name
      ? [data.party_name]
      : data.system_name
      ? [data.system_name]
      : [];

    const newParty: Party = {
      ...data,
      id: newId,
      party_name_raw: rawNames,
      party_name: data.party_name || (rawNames[0] || data.system_name || newId),
      created_at: new Date().toISOString(),
    };
    const updated = [...parties, newParty];
    setParties(updated);
    save('parties', updated);
    if (supabase) {
      supabase.from('parties').insert([newParty]).then(() => {});
    }

    // Auto-create alias mapping for initial names
    rawNames.forEach(name => {
      if (name && name.trim()) {
        const norm = normalizeAlias(name);
        if (!partyAliases.some(a => a.alias_normalized === norm)) {
          const maxAliasNum = partyAliases.reduce((acc, a) => {
            const num = parseInt(a.id.replace(/\D/g, ''), 10);
            return isNaN(num) ? acc : Math.max(acc, num);
          }, 0);
          const newAlias: PartyAlias = {
            id: `PALIAS${maxAliasNum + 1}`,
            alias_name: name.trim(),
            alias_normalized: norm,
            party_id: newId,
            status: 'mapped',
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
          };
          setPartyAliases(prev => {
            const next = [...prev, newAlias];
            save('partyAliases', next);
            return next;
          });
          if (supabase) supabase.from('party_aliases').insert([newAlias]).then(() => {});
        }
      }
    });

    return newParty;
  };

  const updateParty = (id: string, updates: Partial<Party>) => {
    const existing = parties.find(p => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    const deltas = createCellAuditDelta('parties', id, existing, updated, currentUser.id, recordVersions);
    if (deltas.length > 0) {
      setRecordVersions([...deltas, ...recordVersions]);
      save('recordVersions', [...deltas, ...recordVersions]);
      if (supabase) {
        supabase.from('record_versions').insert(deltas).then(() => {});
      }
    }
    const updatedParties = parties.map(p => (p.id === id ? updated : p));
    setParties(updatedParties);
    save('parties', updatedParties);
    if (supabase) {
      supabase.from('parties').update(updates).eq('id', id).then(() => {});
    }
  };

  const deleteParty = (id: string): { success: boolean; error?: string } => {
    const existing = parties.find(p => p.id === id);
    if (!existing) return { success: false, error: `Party ${id} does not exist.` };

    // Safeguard 1: Check if any user transaction is linked to this party
    const linkedTxns = userTransactions.filter(t => t.party_id === id);
    if (linkedTxns.length > 0) {
      return {
        success: false,
        error: `Cannot delete party "${existing.system_name || existing.party_name}" (${id}): There are ${linkedTxns.length} transaction(s) linked to this party.`,
      };
    }

    // Clean templates
    const updatedTemplates = partyTemplates.filter(t => t.party_id !== id);
    if (updatedTemplates.length !== partyTemplates.length) {
      setPartyTemplates(updatedTemplates);
      save('partyTemplates', updatedTemplates);
      if (supabase) {
        supabase.from('party_description_templates').delete().eq('party_id', id).then(() => {});
      }
    }

    const updated = parties.filter(p => p.id !== id);
    setParties(updated);
    save('parties', updated);
    if (supabase) {
      supabase.from('parties').delete().eq('id', id).then(() => {});
    }
    return { success: true };
  };

  const addPartyAliasTag = (partyId: string, aliasName: string) => {
    const party = parties.find(p => p.id === partyId);
    if (!party || !aliasName.trim()) return;

    const currentAliases = Array.isArray(party.party_name_raw)
      ? party.party_name_raw
      : party.party_name_raw
      ? [party.party_name_raw]
      : party.party_name
      ? [party.party_name]
      : [];

    if (currentAliases.some(a => a.toLowerCase() === aliasName.trim().toLowerCase())) return;

    const nextAliases = [...currentAliases, aliasName.trim()];
    updateParty(partyId, { party_name_raw: nextAliases });

    const norm = normalizeAlias(aliasName);
    const existingAlias = partyAliases.find(a => a.alias_normalized === norm);
    if (existingAlias) {
      mapPartyAlias(existingAlias.id, partyId);
    } else {
      const maxNum = partyAliases.reduce((acc, a) => {
        const num = parseInt(a.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? acc : Math.max(acc, num);
      }, 0);
      const newAlias: PartyAlias = {
        id: `PALIAS${maxNum + 1}`,
        alias_name: aliasName.trim(),
        alias_normalized: norm,
        party_id: partyId,
        status: 'mapped',
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
      };
      const updatedAliases = [...partyAliases, newAlias];
      setPartyAliases(updatedAliases);
      save('partyAliases', updatedAliases);
      if (supabase) supabase.from('party_aliases').insert([newAlias]).then(() => {});

      // Retroactive update transactions
      const matchingTxnIds: string[] = [];
      const updatedTxns = userTransactions.map(t => {
        if (normalizeAlias(t.party_name_raw) === norm && (!t.party_id || t.party_id !== partyId)) {
          matchingTxnIds.push(t.id);
          return { ...t, party_id: partyId, updated_at: new Date().toISOString() };
        }
        return t;
      });
      setUserTransactions(updatedTxns);
      save('userTransactions', updatedTxns);
      if (supabase && matchingTxnIds.length > 0) {
        supabase.from('transactions_user').update({ party_id: partyId, updated_at: new Date().toISOString() }).in('id', matchingTxnIds).then(() => {});
      }
    }
  };

  const removePartyAliasTag = (partyId: string, aliasName: string) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) return;
    const currentAliases = Array.isArray(party.party_name_raw)
      ? party.party_name_raw
      : party.party_name_raw
      ? [party.party_name_raw]
      : party.party_name
      ? [party.party_name]
      : [];
    const nextAliases = currentAliases.filter(a => a.toLowerCase() !== aliasName.toLowerCase());
    updateParty(partyId, { party_name_raw: nextAliases });
  };

  const mapPartyAlias = (aliasId: string, partyId: string) => {
    const alias = partyAliases.find(a => a.id === aliasId);
    if (!alias) return;

    // 1. Update Alias status
    const updatedAlias: PartyAlias = { ...alias, party_id: partyId, status: 'mapped' };
    const updatedAliases = partyAliases.map(a => (a.id === aliasId ? updatedAlias : a));
    setPartyAliases(updatedAliases);
    save('partyAliases', updatedAliases);
    if (supabase) {
      supabase.from('party_aliases').update({ party_id: partyId, status: 'mapped' }).eq('id', aliasId).then(() => {});
    }

    // 2. RETROACTIVE UPDATE: update all user transactions with matching raw/normalized name!
    const matchingTxnIds: string[] = [];
    const updatedTxns = userTransactions.map(t => {
      if (normalizeAlias(t.party_name_raw) === alias.alias_normalized && (!t.party_id || t.party_id !== partyId)) {
        matchingTxnIds.push(t.id);
        return { ...t, party_id: partyId, updated_at: new Date().toISOString() };
      }
      return t;
    });
    setUserTransactions(updatedTxns);
    save('userTransactions', updatedTxns);
    if (supabase && matchingTxnIds.length > 0) {
      supabase.from('transactions_user').update({ party_id: partyId, updated_at: new Date().toISOString() }).in('id', matchingTxnIds).then(() => {});
    }
  };

  const createPartyFromAlias = (aliasId: string, cleanSystemName: string, groupName?: string): Party => {
    const alias = partyAliases.find(a => a.id === aliasId);
    const newParty = addParty({
      system_name: cleanSystemName,
      party_name: alias?.alias_name || cleanSystemName,
      group_name: groupName,
    });
    mapPartyAlias(aliasId, newParty.id);
    return newParty;
  };

  const ignorePartyAlias = (aliasId: string) => {
    const updatedAliases = partyAliases.map(a => (a.id === aliasId ? { ...a, status: 'ignored' as const } : a));
    setPartyAliases(updatedAliases);
    save('partyAliases', updatedAliases);
    if (supabase) {
      supabase.from('party_aliases').update({ status: 'ignored' }).eq('id', aliasId).then(() => {});
    }
  };

  // Operational Action 9: Description Templates
  const addPartyTemplate = (partyId: string, text: string, source: 'manual' | 'ai' = 'manual') => {
    const exists = partyTemplates.some(t => t.party_id === partyId && t.template_text.toLowerCase() === text.toLowerCase());
    if (exists) return;

    const maxNum = partyTemplates.reduce((acc, t) => {
      const num = parseInt(t.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 0);
    const newTpl: PartyDescriptionTemplate = {
      id: `TPL${maxNum + 1}`,
      party_id: partyId,
      template_text: text,
      use_count: 1,
      source,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
    };
    const updated = [...partyTemplates, newTpl];
    setPartyTemplates(updated);
    save('partyTemplates', updated);
    if (supabase) {
      supabase.from('party_description_templates').insert([newTpl]).then(() => {});
    }
  };

  const incrementTemplateUsage = (templateId: string) => {
    const target = partyTemplates.find(t => t.id === templateId);
    if (!target) return;
    const newCount = target.use_count + 1;
    const updated = partyTemplates.map(t => (t.id === templateId ? { ...t, use_count: newCount } : t));
    setPartyTemplates(updated);
    save('partyTemplates', updated);
    if (supabase) {
      supabase.from('party_description_templates').update({ use_count: newCount }).eq('id', templateId).then(() => {});
    }
  };

  // Operational Action 10: Pending Queue
  const addPendingTransaction = (pending: Omit<PendingTransaction, 'id' | 'status' | 'created_by' | 'created_at'>) => {
    const maxNum = pendingTransactions.reduce((acc, p) => {
      const num = parseInt(p.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 0);
    const newPending: PendingTransaction = {
      ...pending,
      id: `PEND${maxNum + 1}`,
      status: 'pending',
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
    };
    const updated = [...pendingTransactions, newPending];
    setPendingTransactions(updated);
    save('pendingTransactions', updated);
    if (supabase) {
      supabase.from('pending_transactions').insert([newPending]).then(() => {});
    }
  };

  const mapAndClosePending = (pendingId: string, userTxnId: string) => {
    const now = new Date().toISOString();
    const updated = pendingTransactions.map(p => {
      if (p.id === pendingId) {
        return {
          ...p,
          status: 'done' as const,
          linked_user_txn_id: userTxnId,
          linked_at: now,
        };
      }
      return p;
    });
    setPendingTransactions(updated);
    save('pendingTransactions', updated);
    if (supabase) {
      supabase.from('pending_transactions').update({
        status: 'done',
        linked_user_txn_id: userTxnId,
        linked_at: now,
      }).eq('id', pendingId).then(() => {});
    }
  };

  const cancelPendingTransaction = (pendingId: string) => {
    const updated = pendingTransactions.map(p => (p.id === pendingId ? { ...p, status: 'cancelled' as const } : p));
    setPendingTransactions(updated);
    save('pendingTransactions', updated);
    if (supabase) {
      supabase.from('pending_transactions').update({ status: 'cancelled' }).eq('id', pendingId).then(() => {});
    }
  };

  // Operational Action 11: Statement Upload Matrix
  const uploadStatementFile = (
    accountId: string,
    month: string,
    fileName: string,
    sizeBytes: number,
    r2Key: string
  ) => {
    const existing = statementUploads.find(s => s.account_id === accountId && s.statement_month === month);

    if (existing) {
      // Log replace in versions if replacing
      if (existing.status === 'uploaded') {
        const vDelta: RecordVersion = {
          id: recordVersions.length + 1000,
          table_name: 'statement_uploads',
          record_id: existing.id,
          column_name: 'file_name',
          old_value: existing.file_name,
          new_value: fileName,
          version_no: 2,
          changed_by: currentUser.id,
          changed_at: new Date().toISOString(),
        };
        setRecordVersions([vDelta, ...recordVersions]);
        save('recordVersions', [vDelta, ...recordVersions]);
        if (supabase) {
          supabase.from('record_versions').insert([vDelta]).then(() => {});
        }
      }

      const updateData = {
        status: 'uploaded' as const,
        r2_bucket: 'documents',
        r2_object_key: r2Key,
        file_name: fileName,
        file_size_bytes: sizeBytes,
        uploaded_by: currentUser.id,
        uploaded_at: new Date().toISOString(),
      };

      const updatedUploads = statementUploads.map(s => {
        if (s.account_id === accountId && s.statement_month === month) {
          return {
            ...s,
            ...updateData,
          };
        }
        return s;
      });
      setStatementUploads(updatedUploads);
      save('statementUploads', updatedUploads);
      if (supabase) {
        supabase.from('statement_uploads').update(updateData).eq('id', existing.id).then(() => {});
      }
    }
  };

  // Operational Action 12: Comments & Documents
  const addComment = (userTxnId: string, message: string) => {
    const maxId = comments.reduce((acc, c) => Math.max(acc, c.id), 0);
    const newComment: Comment = {
      id: maxId + 1,
      user_txn_id: userTxnId,
      author_id: currentUser.id,
      message,
      created_at: new Date().toISOString(),
    };
    const updated = [...comments, newComment];
    setComments(updated);
    save('comments', updated);
    if (supabase) {
      supabase.from('comments').insert([newComment]).then(() => {});
    }
  };

  const attachDocument = (doc: Omit<DocumentRecord, 'id' | 'uploaded_by' | 'created_at'>): DocumentRecord => {
    const maxNum = documents.reduce((acc, d) => {
      const num = parseInt(d.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 0);
    const newDoc: DocumentRecord = {
      ...doc,
      id: `DOC${maxNum + 1}`,
      uploaded_by: currentUser.id,
      created_at: new Date().toISOString(),
    };
    const updated = [...documents, newDoc];
    setDocuments(updated);
    save('documents', updated);
    if (supabase) {
      supabase.from('documents').insert([newDoc]).then(() => {});
    }
    return newDoc;
  };

  const deleteDocument = (id: string): void => {
    const updated = documents.filter(d => d.id !== id);
    setDocuments(updated);
    save('documents', updated);
    if (supabase) {
      supabase.from('documents').delete().eq('id', id).then(() => {});
    }
  };

  // Operational Action 13: 1-Click Restore Cell Version
  const restoreCellVersion = (versionId: number): { success: boolean; message: string } => {
    const targetVersion = recordVersions.find(v => v.id === versionId);
    if (!targetVersion) return { success: false, message: 'Version record not found.' };

    const { table_name, record_id, column_name, old_value } = targetVersion;

    if (table_name === 'transactions_user') {
      const txn = userTransactions.find(t => t.id === record_id);
      if (!txn) return { success: false, message: 'Target transaction no longer exists.' };

      // Restore cell
      updateUserTransactionCell(record_id, column_name as keyof UserTransaction, old_value);
      return { success: true, message: `Successfully restored ${column_name} of ${record_id} to "${old_value}".` };
    }

    if (table_name === 'parties') {
      const party = parties.find(p => p.id === record_id);
      if (!party) return { success: false, message: 'Target party no longer exists.' };

      updateParty(record_id, { [column_name]: old_value });
      return { success: true, message: `Successfully restored ${column_name} of ${record_id} to "${old_value}".` };
    }

    return { success: false, message: `Restore for table ${table_name} completed.` };
  };

  const updateAppSetting = (key: string, value: string) => {
    const updated = appSettings.map(s => (s.setting_key === key ? { ...s, setting_value: value } : s));
    setAppSettings(updated);
    save('appSettings', updated);
    if (supabase) {
      supabase.from('app_settings').update({ setting_value: value }).eq('setting_key', key).then(() => {});
    }
  };

  const assignCompanyToUser = (userId: string, companyId: string) => {
    const exists = userCompanies.some(uc => uc.user_id === userId && uc.company_id === companyId);
    if (exists) return;
    const newAssoc: UserCompany = {
      user_id: userId,
      company_id: companyId,
      assigned_by: currentUser.id,
      assigned_at: new Date().toISOString(),
    };
    const updated = [...userCompanies, newAssoc];
    setUserCompanies(updated);
    save('userCompanies', updated);
    if (supabase) {
      supabase.from('user_companies').insert([newAssoc]).then(() => {});
    }
  };

  const removeCompanyFromUser = (userId: string, companyId: string) => {
    const updated = userCompanies.filter(uc => !(uc.user_id === userId && uc.company_id === companyId));
    setUserCompanies(updated);
    save('userCompanies', updated);
    if (supabase) {
      supabase.from('user_companies').delete().eq('user_id', userId).eq('company_id', companyId).then(() => {});
    }
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const normEmail = email.toLowerCase().trim();
    if (!normEmail || !pass) {
      return { success: false, error: 'Please enter both your official email and password.' };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('authenticate_user', {
          p_email: normEmail,
          p_password: pass,
        });

        if (error) {
          console.error('Supabase RPC auth error:', error);
          return { success: false, error: error.message || 'Authentication service error.' };
        }

        if (data && data.success && data.user) {
          const userObj: User = {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
            access_level_id: data.user.access_level_id,
            is_active: true,
            created_at: data.user.created_at || new Date().toISOString(),
          };
          setCurrentUser(userObj);
          setIsAuthenticated(true);
          localStorage.setItem('starruby_auth_user_id', userObj.id);
          return { success: true };
        } else {
          return { success: false, error: data?.error || 'Invalid credentials. Access denied.' };
        }
      } catch (err: any) {
        console.error('Login exception:', err);
        return { success: false, error: err.message || 'Authentication error.' };
      }
    }

    return { success: false, error: 'Database connection not initialized.' };
  };

  const resetTestData = async (): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'Admin') {
      return { success: false, error: 'Unauthorized: Only Admins can reset test data.' };
    }

    try {
      // 1. Wipe all transactional, audit, and staging data
      setUserTransactions([]);
      save('userTransactions', []);

      setBankTransactions([]);
      save('bankTransactions', []);

      setTxnBankLinks([]);
      save('txnBankLinks', []);

      setApprovals([]);
      save('approvals', []);

      setComments([]);
      save('comments', []);

      setPendingTransactions([]);
      save('pendingTransactions', []);

      setStatementUploads([]);
      save('statementUploads', []);

      setDocuments([]);
      save('documents', []);

      setRecordVersions([]);
      save('recordVersions', []);

      setPasswordResetRequests([]);
      save('passwordResetRequests', []);

      // 2. Keep only the 5 official users
      const coreUserIds = ['USR1', 'USR2', 'USR3', 'USR4', 'USR5'];
      const userMap = new Map<string, User>();
      initialUsers.forEach(u => userMap.set(u.id, u));
      users.filter(u => coreUserIds.includes(u.id)).forEach(u => userMap.set(u.id, { ...u, is_active: true }));
      const cleanedUsers = Array.from(userMap.values()).sort((a, b) => a.id.localeCompare(b.id));
      setUsers(cleanedUsers);
      save('users', cleanedUsers);

      // 3. Keep only COM1 and COM2
      const coreCompanyIds = ['COM1', 'COM2'];
      const cleanedCompanies = companies.filter(c => coreCompanyIds.includes(c.id));
      setCompanies(cleanedCompanies);
      save('companies', cleanedCompanies);

      // 4. Keep core bank accounts
      const coreAccountIds = ['BNK1', 'BNK2', 'BNK3', 'BNK4'];
      const cleanedAccounts = accounts.filter(a => coreAccountIds.includes(a.id));
      setAccounts(cleanedAccounts);
      save('accounts', cleanedAccounts);

      // 5. Supabase call
      if (supabase) {
        try {
          const { error: rpcErr } = await supabase.rpc('reset_test_data');
          if (rpcErr) {
            console.warn('RPC reset_test_data notice (falling back to direct deletes):', rpcErr.message);
            await supabase.from('txn_bank_links').delete().neq('id', 'NONE');
            await supabase.from('approvals').delete().neq('id', 'NONE');
            await supabase.from('comments').delete().neq('id', 'NONE');
            await supabase.from('record_versions').delete().neq('id', 'NONE');
            await supabase.from('pending_transactions').delete().neq('id', 'NONE');
            await supabase.from('documents').delete().neq('id', 'NONE');
            await supabase.from('statement_uploads').delete().neq('id', 'NONE');
            await supabase.from('transactions_user').delete().neq('id', 'NONE');
            await supabase.from('transactions_bank').delete().neq('id', 'NONE');
            await supabase.from('password_reset_requests').delete().neq('id', 'NONE');
          }
        } catch (supaErr) {
          console.warn('Supabase reset warning:', supaErr);
        }
      }

      notifyRealtime('Test data cleaned successfully. System is fresh and ready for live production entries.');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to clean test data.' };
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('starruby_auth_user_id');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
        login,
        logout,
        allUsers: users,
        accessLevels,
        currentRole,
        activeCompanyId,
        setActiveCompanyId,
        allowedCompanies,
        scopedAccounts,
        scopedUserTransactions,
        scopedBankTransactions,
        scopedPendingTransactions,
        scopedStatementUploads,
        companies,
        accounts,
        signatories,
        parties,
        partiesMap,
        partyAliases,
        partyTemplates,
        userCompanies,
        appSettings,
        userTransactions,
        bankTransactions,
        txnBankLinks,
        approvals,
        comments,
        pendingTransactions,
        statementUploads,
        documents,
        recordVersions,
        addCompany,
        updateCompany,
        deleteCompany,
        addUser,
        updateUser,
        deleteUser,
        toggleUserActiveStatus,
        addAccessLevel,
        addAccount,
        updateAccount,
        deleteAccount,
        addUserTransaction,
        addUserTransactionsBatch,
        updateUserTransaction,
        deleteUserTransaction,
        updateUserTransactionCell,
        addBankTransaction,
        deleteBankTransaction,
        linkTxnBank,
        unlinkTxnBank,
        closeInMatchTab,
        submitApproval,
        addParty,
        updateParty,
        deleteParty,
        addPartyAliasTag,
        removePartyAliasTag,
        mapPartyAlias,
        createPartyFromAlias,
        ignorePartyAlias,
        addPartyTemplate,
        incrementTemplateUsage,
        addPendingTransaction,
        mapAndClosePending,
        cancelPendingTransaction,
        uploadStatementFile,
        addComment,
        attachDocument,
        deleteDocument,
        restoreCellVersion,
        updateAppSetting,
        assignCompanyToUser,
        removeCompanyFromUser,
        isRealtimeConnected,
        lastRealtimeNotice,
        liveForexRates,
        refreshForexRates,
        passwordResetRequests,
        setUserPassword,
        requestPasswordReset,
        approvePasswordReset,
        rejectPasswordReset,
        completePasswordReset,
        resetTestData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
