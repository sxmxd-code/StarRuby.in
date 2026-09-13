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
  addUserTransaction: (txn: Omit<UserTransaction, 'id' | 'date_of_entry' | 'status' | 'created_by' | 'created_at' | 'updated_at'>) => UserTransaction;
  deleteUserTransaction: (id: string, reason: string) => boolean;
  updateUserTransactionCell: (id: string, column: keyof UserTransaction, value: any) => void;
  
  addBankTransaction: (txn: Omit<BankTransaction, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => BankTransaction;
  deleteBankTransaction: (id: string, reason: string) => boolean;
  
  linkTxnBank: (userTxnId: string, bankTxnId: string, method?: 'manual' | 'csv') => void;
  unlinkTxnBank: (userTxnId: string, bankTxnId: string) => void;
  
  closeInMatchTab: (userTxnId: string, linkedBankIds: string[], verifiedWithBank: 'Yes' | 'No', comment?: string) => void;
  submitApproval: (userTxnId: string, layer: 1 | 2 | 3, decision: 'approved' | 'rejected', comment?: string) => { success: boolean; message: string };
  
  addParty: (party: Omit<Party, 'id' | 'created_at'>) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'starruby_banking_system_state_v1';

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
  const [accessLevels] = useState<AccessLevel[]>(initialAccessLevels);
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
        ]);

        if (!isMounted) return;

        if (compRes.data && compRes.data.length > 0) {
          setCompanies(compRes.data);
          save('companies', compRes.data);
        }
        if (usrRes.data && usrRes.data.length > 0) {
          setUsers(usrRes.data);
          save('users', usrRes.data);
        }
        if (ucRes.data && ucRes.data.length > 0) {
          setUserCompanies(ucRes.data);
          save('userCompanies', ucRes.data);
        }
        if (accRes.data && accRes.data.length > 0) {
          setAccounts(accRes.data);
          save('accounts', accRes.data);
        }
        if (sigRes.data && sigRes.data.length > 0) {
          setSignatories(sigRes.data);
          save('signatories', sigRes.data);
        }
        if (ptyRes.data && ptyRes.data.length > 0) {
          setParties(ptyRes.data);
          save('parties', ptyRes.data);
        }
        if (aliasRes.data && aliasRes.data.length > 0) {
          setPartyAliases(aliasRes.data);
          save('partyAliases', aliasRes.data);
        }
        if (tplRes.data && tplRes.data.length > 0) {
          setPartyTemplates(tplRes.data);
          save('partyTemplates', tplRes.data);
        }
        if (uTxnRes.data && uTxnRes.data.length > 0) {
          setUserTransactions(uTxnRes.data);
          save('userTransactions', uTxnRes.data);
        }
        if (bTxnRes.data && bTxnRes.data.length > 0) {
          setBankTransactions(bTxnRes.data);
          save('bankTransactions', bTxnRes.data);
        }
        if (linksRes.data && linksRes.data.length > 0) {
          setTxnBankLinks(linksRes.data);
          save('txnBankLinks', linksRes.data);
        }
        if (apprRes.data && apprRes.data.length > 0) {
          setApprovals(apprRes.data);
          save('approvals', apprRes.data);
        }
        if (cmtRes.data && cmtRes.data.length > 0) {
          setComments(cmtRes.data);
          save('comments', cmtRes.data);
        }
        if (pendRes.data && pendRes.data.length > 0) {
          setPendingTransactions(pendRes.data);
          save('pendingTransactions', pendRes.data);
        }
        if (stmtRes.data && stmtRes.data.length > 0) {
          setStatementUploads(stmtRes.data);
          save('statementUploads', stmtRes.data);
        }
        if (docRes.data && docRes.data.length > 0) {
          setDocuments(docRes.data);
          save('documents', docRes.data);
        }
        if (verRes.data && verRes.data.length > 0) {
          setRecordVersions(verRes.data);
          save('recordVersions', verRes.data);
        }
        if (setRes.data && setRes.data.length > 0) {
          setAppSettings(setRes.data);
          save('appSettings', setRes.data);
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
          const exactParty = parties.find(p => normalizeAlias(p.system_name || p.party_name) === normalizedTyped);
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
        supabase.from('approvals').insert([layer1Approval]).then(() => {});
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
      const updatedApprovals = [...approvals, approvalRecord];
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
        supabase.from('approvals').insert([approvalRecord]).then(() => {});
        supabase.from('transactions_user').update({
          status: 'open',
          updated_at: updatedTxn.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }

      return { success: true, message: `Transaction rejected at Layer ${layer} and reverted to open status for correction.` };
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
        supabase.from('approvals').insert([layer2Approval]).then(() => {});
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
        supabase.from('approvals').insert([layer3Approval]).then(() => {});
        supabase.from('transactions_user').update({
          status: 'approved',
          updated_at: updatedTxn.updated_at,
        }).eq('id', userTxnId).then(() => {});
      }

      return { success: true, message: 'Layer 3 review completed by second Admin! Transaction is now FULLY CLOSED.' };
    }

    return { success: false, message: 'Invalid approval layer specified.' };
  };

  // Operational Action 8: Party Management & Aliases
  const addParty = (data: Omit<Party, 'id' | 'created_at'>): Party => {
    const maxNum = parties.reduce((acc, p) => {
      const num = parseInt(p.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    const newId = `PTY${maxNum + 1}`;
    const newParty: Party = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
    };
    const updated = [...parties, newParty];
    setParties(updated);
    save('parties', updated);
    if (supabase) {
      supabase.from('parties').insert([newParty]).then(() => {});
    }
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
      supabase.from('user_companies').delete().match({ user_id: userId, company_id: companyId }).then(() => {});
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
        addUserTransaction,
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
