import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileSpreadsheet,
  Landmark,
  Scale,
  CheckCircle2,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Shield,
  Clock,
  AlertCircle,
  Eye,
  GitMerge,
  ExternalLink,
  ChevronsUpDown,
  Filter,
  Building,
} from 'lucide-react';
import { formatDisplayDate, formatDisplayDateTime, formatCurrencyAmount } from '../../lib/formatters';
import { TransactionBoardModal } from './TransactionBoardModal';
import { BankTransactionBoardModal } from './BankTransactionBoardModal';
import { BankTransaction, UserTransaction } from '../../types/database';

export const StatementReconciliationModule: React.FC = () => {
  const {
    accounts,
    bankTransactions,
    scopedAccounts,
    userTransactions,
    txnBankLinks,
    approvals,
    partiesMap,
    allUsers,
    hasHarshilApproved,
    hasVismayApproved,
  } = useApp();

  const [selectedAccountId, setSelectedAccountId] = useState(scopedAccounts[0]?.id || '');
  const [ledgerMode, setLedgerMode] = useState<'bank_statement' | 'user_book'>('bank_statement');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'in_approval' | 'unlinked'>('all');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Deep inspect modal states
  const [inspectingUserTxn, setInspectingUserTxn] = useState<UserTransaction | null>(null);
  const [inspectingBankTxn, setInspectingBankTxn] = useState<BankTransaction | null>(null);

  // Sync selectedAccountId when scopedAccounts change
  React.useEffect(() => {
    if (scopedAccounts.length > 0 && !scopedAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(scopedAccounts[0].id);
      setExpandedRowIds(new Set());
    }
  }, [scopedAccounts, selectedAccountId]);

  // Clear expanded rows when switching accounts or ledger mode
  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    setExpandedRowIds(new Set());
  };

  const handleModeChange = (mode: 'bank_statement' | 'user_book') => {
    setLedgerMode(mode);
    setExpandedRowIds(new Set());
    setStatusFilter('all');
  };

  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  // =========================================================================
  // 1. BANK STATEMENT RUNNING LEDGER (Passbook Feed)
  // Excludes lines linked to user transactions with 'open' or 'queried' status
  // =========================================================================
  const bankAccountEntries = useMemo(() => {
    return bankTransactions
      .filter(b => b.account_id === selectedAccountId)
      .sort((a, b) => new Date(a.value_date).getTime() - new Date(b.value_date).getTime());
  }, [bankTransactions, selectedAccountId]);

  const bankLedgerRows = useMemo(() => {
    let running = 0;
    const rows = [];

    for (const entry of bankAccountEntries) {
      if (entry.balance_after !== undefined && entry.balance_after !== null) {
        running = entry.balance_after;
      } else {
        running = running + (entry.credit || 0) - (entry.debit || 0);
      }

      // Check linked user transaction & 3-layer approvals
      const links = txnBankLinks.filter(l => l.bank_txn_id === entry.id);
      const linkedUserTxns = userTransactions.filter(u => links.some(l => l.user_txn_id === u.id));
      const primaryLinkedTxn = linkedUserTxns[0] || null;

      // EXCLUSION RULE: Exclude statement lines linked to user transactions with 'open' or 'queried' status
      if (primaryLinkedTxn && (primaryLinkedTxn.status === 'open' || primaryLinkedTxn.status === 'queried')) {
        continue;
      }

      let l1Status = 'No';
      let harshilStatus = 'No';
      let vismayStatus = 'No';
      let adminStatus = 'Unlinked';
      let approvedBy = '—';
      let l1Approval = null;
      let harshilApproval = null;
      let vismayApproval = null;

      if (primaryLinkedTxn) {
        adminStatus = primaryLinkedTxn.status;
        const txnApprs = approvals.filter(a => a.user_txn_id === primaryLinkedTxn.id && a.decision === 'approved');
        l1Approval = txnApprs.find(a => a.layer === 1) || null;
        harshilApproval = txnApprs.find(a => a.approver_id === 'USR1' || allUsers.find(u => u.id === a.approver_id)?.full_name?.toLowerCase().includes('harshil')) || null;
        vismayApproval = txnApprs.find(a => a.approver_id === 'USR2' || allUsers.find(u => u.id === a.approver_id)?.full_name?.toLowerCase().includes('vismay')) || null;

        if (l1Approval) l1Status = 'Yes';
        if (hasHarshilApproved(primaryLinkedTxn.id)) harshilStatus = 'Yes';
        if (hasVismayApproved(primaryLinkedTxn.id)) vismayStatus = 'Yes';

        if (harshilStatus === 'Yes' && vismayStatus === 'Yes') {
          approvedBy = 'Both (Harshil & Vismay)';
        } else if (harshilStatus === 'Yes') {
          approvedBy = 'Harshil Zaveri';
        } else if (vismayStatus === 'Yes') {
          approvedBy = 'Vismay Zaveri';
        } else if (l1Approval) {
          approvedBy = 'Layer 1 (Accountant)';
        }
      }

      rows.push({
        ...entry,
        computedBalance: running,
        primaryLinkedTxn,
        linkedUserTxns,
        linkedCount: linkedUserTxns.length,
        l1Status,
        harshilStatus,
        vismayStatus,
        adminStatus,
        approvedBy,
        l1Approval,
        harshilApproval,
        vismayApproval,
      });
    }

    return rows;
  }, [bankAccountEntries, txnBankLinks, userTransactions, approvals, allUsers, hasHarshilApproved, hasVismayApproved]);

  // =========================================================================
  // 2. USER TRANSACTIONS RUNNING BOOK LEDGER (Company Cash / Bank Book)
  // Strictly excludes user transactions with 'open' or 'queried' status
  // =========================================================================
  const userAccountEntries = useMemo(() => {
    return userTransactions
      .filter(u => u.account_id === selectedAccountId)
      .filter(u => u.status !== 'open' && u.status !== 'queried')
      .sort((a, b) => new Date(a.date_of_transaction).getTime() - new Date(b.date_of_transaction).getTime());
  }, [userTransactions, selectedAccountId]);

  const userLedgerRows = useMemo(() => {
    let running = 0;
    return userAccountEntries.map(txn => {
      const isReceipt = txn.direction === 'Receipt';
      const debit = isReceipt ? 0 : txn.amount;
      const credit = isReceipt ? txn.amount : 0;
      running = running + credit - debit;

      // Find linked bank transactions
      const links = txnBankLinks.filter(l => l.user_txn_id === txn.id);
      const linkedBankEntries = bankTransactions.filter(b => links.some(l => l.bank_txn_id === b.id));

      const txnApprs = approvals.filter(a => a.user_txn_id === txn.id && a.decision === 'approved');
      const l1Approval = txnApprs.find(a => a.layer === 1) || null;
      const harshilApproval = txnApprs.find(a => a.approver_id === 'USR1' || allUsers.find(u => u.id === a.approver_id)?.full_name?.toLowerCase().includes('harshil')) || null;
      const vismayApproval = txnApprs.find(a => a.approver_id === 'USR2' || allUsers.find(u => u.id === a.approver_id)?.full_name?.toLowerCase().includes('vismay')) || null;

      const l1Status = l1Approval ? 'Yes' : 'No';
      const harshilStatus = hasHarshilApproved(txn.id) ? 'Yes' : 'No';
      const vismayStatus = hasVismayApproved(txn.id) ? 'Yes' : 'No';

      let approvedBy = '—';
      if (harshilStatus === 'Yes' && vismayStatus === 'Yes') {
        approvedBy = 'Both (Harshil & Vismay)';
      } else if (harshilStatus === 'Yes') {
        approvedBy = 'Harshil Zaveri';
      } else if (vismayStatus === 'Yes') {
        approvedBy = 'Vismay Zaveri';
      } else if (l1Approval) {
        approvedBy = 'Layer 1 (Accountant)';
      }

      return {
        ...txn,
        debit,
        credit,
        computedBalance: running,
        linkedBankEntries,
        l1Status,
        harshilStatus,
        vismayStatus,
        adminStatus: txn.status,
        approvedBy,
        l1Approval,
        harshilApproval,
        vismayApproval,
      };
    });
  }, [userAccountEntries, txnBankLinks, bankTransactions, approvals, allUsers, hasHarshilApproved, hasVismayApproved]);

  // Closing balances
  const closingStatementBalance = bankLedgerRows.length > 0 ? bankLedgerRows[bankLedgerRows.length - 1].computedBalance : 0;
  const closingBookBalance = userLedgerRows.length > 0 ? userLedgerRows[userLedgerRows.length - 1].computedBalance : 0;
  const reconciliationVariance = closingStatementBalance - closingBookBalance;

  // Filtered rows for Bank Statement mode
  const filteredBankRows = useMemo(() => {
    return bankLedgerRows.filter(row => {
      // Status filter
      if (statusFilter === 'approved') {
        const isApproved = (row.harshilStatus === 'Yes' && row.vismayStatus === 'Yes') || row.adminStatus === 'approved';
        if (!isApproved) return false;
      } else if (statusFilter === 'in_approval') {
        const isApproved = (row.harshilStatus === 'Yes' && row.vismayStatus === 'Yes') || row.adminStatus === 'approved';
        if (isApproved || !row.primaryLinkedTxn) return false;
      } else if (statusFilter === 'unlinked') {
        if (row.primaryLinkedTxn) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const party = row.primaryLinkedTxn?.party_id
          ? partiesMap.get(row.primaryLinkedTxn.party_id)?.system_name || ''
          : row.primaryLinkedTxn?.party_name_raw || '';
        const amtStr = String(row.debit > 0 ? row.debit : row.credit);
        const match =
          row.id.toLowerCase().includes(q) ||
          row.narration.toLowerCase().includes(q) ||
          (row.reference_no && row.reference_no.toLowerCase().includes(q)) ||
          party.toLowerCase().includes(q) ||
          (row.primaryLinkedTxn?.id && row.primaryLinkedTxn.id.toLowerCase().includes(q)) ||
          amtStr.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [bankLedgerRows, statusFilter, searchQuery, partiesMap]);

  // Filtered rows for User Book mode
  const filteredUserRows = useMemo(() => {
    return userLedgerRows.filter(row => {
      // Status filter
      if (statusFilter === 'approved') {
        const isApproved = (row.harshilStatus === 'Yes' && row.vismayStatus === 'Yes') || row.adminStatus === 'approved';
        if (!isApproved) return false;
      } else if (statusFilter === 'in_approval') {
        const isApproved = (row.harshilStatus === 'Yes' && row.vismayStatus === 'Yes') || row.adminStatus === 'approved';
        if (isApproved) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const party = row.party_id
          ? partiesMap.get(row.party_id)?.system_name || row.party_name_raw
          : row.party_name_raw;
        const amtStr = String(row.amount);
        const match =
          row.id.toLowerCase().includes(q) ||
          party.toLowerCase().includes(q) ||
          (row.description && row.description.toLowerCase().includes(q)) ||
          row.linkedBankEntries.some(b => b.id.toLowerCase().includes(q) || (b.reference_no && b.reference_no.toLowerCase().includes(q))) ||
          amtStr.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [userLedgerRows, statusFilter, searchQuery, partiesMap]);

  // Expand / collapse handlers
  const toggleRowExpand = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = (ids: string[]) => {
    setExpandedRowIds(new Set(ids));
  };

  const handleCollapseAll = () => {
    setExpandedRowIds(new Set());
  };

  // Helper to render compact governance badge in table row
  const renderCompactGovernanceBadge = (
    harshilDone: boolean,
    vismayDone: boolean,
    l1Done: boolean,
    adminStatus: string,
    isUnlinked: boolean
  ) => {
    if (isUnlinked) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Unlinked
        </span>
      );
    }
    if ((harshilDone && vismayDone) || adminStatus === 'approved') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Both Approved</span>
        </span>
      );
    }
    if (harshilDone && !vismayDone) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <Clock className="w-3 h-3 text-sky-600 shrink-0" />
          <span>With Vismay</span>
        </span>
      );
    }
    if (vismayDone && !harshilDone) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>With Harshil</span>
        </span>
      );
    }
    if (l1Done || adminStatus === 'in_approval') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Shield className="w-3 h-3 text-blue-600 shrink-0" />
          <span>In Approval</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
        {adminStatus.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <span className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 shadow-2xs">
            <FileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900 tracking-tight">
              Statement Running Ledger
            </h1>
            <p className="text-xs text-slate-500">
              Line-by-line running balances &bull; Click any line to reveal full details &bull; Zero horizontal scrolling &bull; Excludes Open &amp; Queried
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher & Account Selector */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleModeChange('bank_statement')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
                ledgerMode === 'bank_statement'
                  ? 'bg-white text-blue-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-blue-700" />
              <span>Bank Statement ({bankLedgerRows.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('user_book')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
                ledgerMode === 'user_book'
                  ? 'bg-white text-rose-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-rose-700" />
              <span>User Transactions Book ({userLedgerRows.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-500">Account:</label>
            <select
              value={selectedAccountId}
              onChange={e => handleAccountChange(e.target.value)}
              disabled={scopedAccounts.length === 0}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium disabled:opacity-60 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              {scopedAccounts.length === 0 ? (
                <option value="">No Accounts Available</option>
              ) : (
                scopedAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.id} &bull; {acc.bank_name} ({acc.account_currency})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {!activeAccount && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          No bank accounts registered. Please add a bank account in Masters &amp; Setup.
        </div>
      )}

      {/* Account Balance Summary KPI Cards */}
      {activeAccount && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Bank Account */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Bank Account
              </span>
              <span className="p-1 bg-slate-100 text-slate-600 rounded">
                <Building className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="font-bold text-sm text-slate-900 truncate">{activeAccount.bank_name}</div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span className="font-mono">{activeAccount.account_number}</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
                {activeAccount.account_currency}
              </span>
            </div>
          </div>

          {/* Card 2: Closing Statement */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Closing Statement (Bank)
              </span>
              <span className="p-1 bg-blue-50 text-blue-600 rounded">
                <Landmark className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="font-bold text-base text-blue-700 font-mono tabular-nums">
              {formatCurrencyAmount(closingStatementBalance, activeAccount.account_currency)}
            </div>
            <span className="text-[10px] text-slate-400 block font-sans">
              {bankLedgerRows.length} reconciled statement lines
            </span>
          </div>

          {/* Card 3: Closing Book */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Closing Book (User Txns)
              </span>
              <span className="p-1 bg-rose-50 text-rose-600 rounded">
                <BookOpen className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="font-bold text-base text-rose-700 font-mono tabular-nums">
              {formatCurrencyAmount(closingBookBalance, activeAccount.account_currency)}
            </div>
            <span className="text-[10px] text-slate-400 block font-sans">
              {userLedgerRows.length} reconciled book entries
            </span>
          </div>

          {/* Card 4: Reconciliation Variance */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Reconciliation Variance
              </span>
              <span className={`p-1 rounded ${
                Math.abs(reconciliationVariance) < 0.01 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {Math.abs(reconciliationVariance) < 0.01 ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Scale className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`font-bold text-base font-mono tabular-nums ${
                Math.abs(reconciliationVariance) < 0.01 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {formatCurrencyAmount(reconciliationVariance, activeAccount.account_currency)}
              </span>
            </div>
            <div>
              {Math.abs(reconciliationVariance) < 0.01 ? (
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Balanced (Zero Discrepancy)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Scale className="w-3 h-3 shrink-0" />
                  <span>Variance Detected</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Ledger Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Controls: Title, Search, Status Filter & Expand All */}
        <div className="p-4 border-b border-slate-200/90 bg-slate-50/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                {ledgerMode === 'bank_statement' ? (
                  <>
                    <Landmark className="w-4 h-4 text-blue-700" />
                    <span>Bank Statement Running Balance ({bankLedgerRows.length} lines)</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 text-rose-700" />
                    <span>User Transactions Book Ledger ({userLedgerRows.length} lines)</span>
                  </>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1">
                <span>Passbook feed with running balance</span>
                <span>&bull;</span>
                <span className="text-blue-700 font-semibold">Click any row to reveal line details</span>
                <span>&bull;</span>
                <span>Open &amp; Queried excluded</span>
              </p>
            </div>

            {/* Expand / Collapse All */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const currentIds = ledgerMode === 'bank_statement'
                    ? filteredBankRows.map(r => r.id)
                    : filteredUserRows.map(r => r.id);
                  if (expandedRowIds.size === currentIds.length && currentIds.length > 0) {
                    handleCollapseAll();
                  } else {
                    handleExpandAll(currentIds);
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {expandedRowIds.size > 0 &&
                  expandedRowIds.size === (ledgerMode === 'bank_statement' ? filteredBankRows.length : filteredUserRows.length)
                    ? 'Collapse All'
                    : 'Expand All'}
                </span>
              </button>
            </div>
          </div>

          {/* Search Bar & Quick Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  ledgerMode === 'bank_statement'
                    ? 'Search narration, ref no, party, or amount...'
                    : 'Search party, description, txn ID, or amount...'
                }
                className="w-full pl-8.5 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1 mr-1">
                <Filter className="w-3 h-3 text-slate-400" />
                <span>Filter:</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Both Approved
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_approval')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  statusFilter === 'in_approval'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                In Approval
              </button>
              {ledgerMode === 'bank_statement' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('unlinked')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    statusFilter === 'unlinked'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Unlinked
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. BANK STATEMENT RUNNING LEDGER TABLE                                      */}
        {/* ========================================================================= */}
        {ledgerMode === 'bank_statement' && (
          <div className="w-full">
            <table className="w-full text-left table-fixed">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[33%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="bg-slate-100/90 uppercase text-[10px] text-slate-700 font-sans border-b border-slate-200">
                <tr>
                  <th className="p-3">Value Date &amp; ID</th>
                  <th className="p-3 font-sans">Narration &amp; Reference</th>
                  <th className="p-3 text-right">Debit (Out)</th>
                  <th className="p-3 text-right">Credit (In)</th>
                  <th className="p-3 text-right">Running Balance</th>
                  <th className="p-3 text-center font-sans">Governance</th>
                  <th className="p-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBankRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-sans">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Landmark className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No matching statement transactions</p>
                        <p className="text-[11px] text-slate-400">
                          {searchQuery || statusFilter !== 'all'
                            ? 'Try clearing the search query or changing status filters.'
                            : 'No statement lines recorded for this bank account.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBankRows.map(row => {
                    const isExpanded = expandedRowIds.has(row.id);
                    const linkedParty = row.primaryLinkedTxn?.party_id
                      ? partiesMap.get(row.primaryLinkedTxn.party_id)?.system_name
                      : row.primaryLinkedTxn?.party_name_raw;

                    return (
                      <React.Fragment key={row.id}>
                        {/* Main Fixed Row - Click to Open */}
                        <tr
                          onClick={() => toggleRowExpand(row.id)}
                          className={`hover:bg-blue-50/40 cursor-pointer transition select-none group ${
                            isExpanded ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          {/* Col 1: Date & Bank ID */}
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 text-xs whitespace-nowrap">
                              {formatDisplayDate(row.value_date)}
                            </div>
                            <div className="text-[10px] font-mono text-blue-700 font-bold tracking-tight">
                              {row.id}
                            </div>
                          </td>

                          {/* Col 2: Narration & Ref */}
                          <td className="p-3 max-w-0">
                            <div className="truncate font-medium text-slate-800 text-xs" title={row.narration}>
                              {row.narration}
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono truncate mt-0.5">
                              {row.reference_no && (
                                <span className="text-blue-600">Ref: {row.reference_no}</span>
                              )}
                              {linkedParty && (
                                <span className="text-slate-600 truncate">&bull; {linkedParty}</span>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Debit (Out) */}
                          <td className="p-3 text-right text-rose-700 font-mono tabular-nums font-semibold">
                            {row.debit > 0 ? `-${row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>

                          {/* Col 4: Credit (In) */}
                          <td className="p-3 text-right text-emerald-700 font-mono tabular-nums font-semibold">
                            {row.credit > 0 ? `+${row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>

                          {/* Col 5: Statement Balance */}
                          <td className="p-3 text-right font-bold text-slate-900 font-mono tabular-nums">
                            {row.computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          {/* Col 6: Governance Badge */}
                          <td className="p-3 text-center">
                            {renderCompactGovernanceBadge(
                              row.harshilStatus === 'Yes',
                              row.vismayStatus === 'Yes',
                              row.l1Status === 'Yes',
                              row.adminStatus,
                              !row.primaryLinkedTxn
                            )}
                          </td>

                          {/* Col 7: Expand Chevron */}
                          <td className="p-3 text-center text-slate-400 group-hover:text-blue-700">
                            <button
                              type="button"
                              className="p-1 hover:bg-slate-200/60 rounded-md transition"
                              title={isExpanded ? 'Collapse line details' : 'Click to expand details'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-blue-700" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Line Details Panel */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
                                {/* Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                                  <div className="flex items-center space-x-2.5">
                                    <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                                      <Landmark className="w-4 h-4" />
                                    </span>
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                                        Statement Line Breakdown &bull; <span className="font-mono text-blue-700">{row.id}</span>
                                      </h4>
                                      <p className="text-[11px] text-slate-500">
                                        Value Date: <strong className="text-slate-700">{formatDisplayDate(row.value_date)}</strong> &bull; Bank: <strong className="text-slate-700">{activeAccount?.bank_name} ({activeAccount?.account_currency})</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => setInspectingBankTxn(row)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center space-x-1 cursor-pointer transition"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Inspect Audit Board</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Full Printed Narration & Snapshot */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      Full Verbatim Statement Narration (Printed Line)
                                    </span>
                                    <p className="text-xs text-slate-900 font-mono break-words leading-relaxed select-all">
                                      {row.narration || '—'}
                                    </p>
                                    {row.reference_no && (
                                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center space-x-2 text-[11px]">
                                        <span className="text-slate-400 font-medium">Bank Reference No:</span>
                                        <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 select-all">
                                          {row.reference_no}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Financial Snapshot */}
                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                      Transaction Snapshot
                                    </span>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-500">Flow:</span>
                                      <span className={`font-bold ${row.debit > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {row.debit > 0 ? 'Debit (Outflow -)' : 'Credit (Inflow +)'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-500">Amount:</span>
                                      <span className="font-mono font-bold text-slate-900">
                                        {formatCurrencyAmount(row.debit > 0 ? row.debit : row.credit, activeAccount?.account_currency)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200">
                                      <span className="text-slate-500">Running Balance:</span>
                                      <span className="font-mono font-bold text-blue-900">
                                        {formatCurrencyAmount(row.computedBalance, activeAccount?.account_currency)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Reconciled User Transaction Link */}
                                <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                                      <GitMerge className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Reconciled User Transaction Link</span>
                                    </span>
                                    {row.primaryLinkedTxn && (
                                      <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        Linked ({row.linkedCount} record{row.linkedCount > 1 ? 's' : ''})
                                      </span>
                                    )}
                                  </div>

                                  {row.primaryLinkedTxn ? (
                                    <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-mono font-bold text-xs text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                            {row.primaryLinkedTxn.id}
                                          </span>
                                          <span className="text-xs font-bold text-slate-900">
                                            {linkedParty || row.primaryLinkedTxn.party_name_raw}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            &bull; {formatDisplayDate(row.primaryLinkedTxn.date_of_transaction)}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600">
                                          {row.primaryLinkedTxn.description || 'No description entered'}
                                        </p>
                                      </div>

                                      <div className="flex items-center space-x-3 shrink-0" onClick={e => e.stopPropagation()}>
                                        <div className="text-right">
                                          <span className="text-[10px] text-slate-400 block uppercase font-bold">User Book Amount</span>
                                          <span className="font-mono font-bold text-xs text-slate-900">
                                            {formatCurrencyAmount(row.primaryLinkedTxn.amount, row.primaryLinkedTxn.currency)}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setInspectingUserTxn(row.primaryLinkedTxn)}
                                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 flex items-center space-x-1 cursor-pointer transition"
                                        >
                                          <span>View User Txn</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80 text-amber-900 text-xs flex items-center space-x-2">
                                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                      <span>
                                        This bank statement line is currently unlinked. Match &amp; pair it in the <strong>Match &amp; Reconcile</strong> workbench.
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Dual-Admin Governance & Accountant Sign-off */}
                                <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Dual Co-Founder Governance &amp; Accountant Sign-off
                                  </span>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Layer 1: Accountant */}
                                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700">Layer 1 &bull; Accountant</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          row.l1Status === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                          {row.l1Status === 'Yes' ? 'Matched / Closed' : 'Pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {row.l1Status === 'Yes' ? 'Statement line matched with company cash book.' : 'Awaiting accountant review.'}
                                      </p>
                                    </div>

                                    {/* Harshil Zaveri */}
                                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700">Harshil Zaveri (Co-Founder)</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          row.harshilStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {row.harshilStatus === 'Yes' ? 'Approved' : 'Pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {row.harshilApproval ? (
                                          <>
                                            <span className="font-medium text-slate-700">{formatDisplayDateTime(row.harshilApproval.decided_at)}</span>
                                            {row.harshilApproval.comment && (
                                              <span className="block italic text-slate-600 mt-0.5">&ldquo;{row.harshilApproval.comment}&rdquo;</span>
                                            )}
                                          </>
                                        ) : (
                                          'Awaiting Harshil sign-off'
                                        )}
                                      </p>
                                    </div>

                                    {/* Vismay Zaveri */}
                                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700">Vismay Zaveri (Co-Founder)</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          row.vismayStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {row.vismayStatus === 'Yes' ? 'Approved' : 'Pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {row.vismayApproval ? (
                                          <>
                                            <span className="font-medium text-slate-700">{formatDisplayDateTime(row.vismayApproval.decided_at)}</span>
                                            {row.vismayApproval.comment && (
                                              <span className="block italic text-slate-600 mt-0.5">&ldquo;{row.vismayApproval.comment}&rdquo;</span>
                                            )}
                                          </>
                                        ) : (
                                          'Awaiting Vismay sign-off'
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. USER TRANSACTIONS RUNNING BOOK LEDGER TABLE                            */}
        {/* ========================================================================= */}
        {ledgerMode === 'user_book' && (
          <div className="w-full">
            <table className="w-full text-left table-fixed">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[33%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="bg-slate-100/90 uppercase text-[10px] text-slate-700 font-sans border-b border-slate-200">
                <tr>
                  <th className="p-3">Txn Date &amp; ID</th>
                  <th className="p-3 font-sans">Party &amp; Description</th>
                  <th className="p-3 text-right">Debit (Payment -)</th>
                  <th className="p-3 text-right">Credit (Receipt +)</th>
                  <th className="p-3 text-right">Book Balance</th>
                  <th className="p-3 text-center font-sans">Governance</th>
                  <th className="p-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUserRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-sans">
                      <div className="max-w-xs mx-auto space-y-2">
                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No matching user transactions</p>
                        <p className="text-[11px] text-slate-400">
                          {searchQuery || statusFilter !== 'all'
                            ? 'Try clearing the search query or changing status filters.'
                            : 'No user transactions recorded for this account.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUserRows.map(row => {
                    const isExpanded = expandedRowIds.has(row.id);
                    const partyName = row.party_id
                      ? partiesMap.get(row.party_id)?.system_name || row.party_name_raw
                      : row.party_name_raw;

                    return (
                      <React.Fragment key={row.id}>
                        {/* Main Fixed Row - Click to Open */}
                        <tr
                          onClick={() => toggleRowExpand(row.id)}
                          className={`hover:bg-rose-50/40 cursor-pointer transition select-none group ${
                            isExpanded ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          {/* Col 1: Date & Txn ID */}
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 text-xs whitespace-nowrap">
                              {formatDisplayDate(row.date_of_transaction)}
                            </div>
                            <div className="text-[10px] font-mono text-rose-800 font-bold tracking-tight">
                              {row.id}
                            </div>
                          </td>

                          {/* Col 2: Party & Description */}
                          <td className="p-3 max-w-0">
                            <div className="truncate font-bold text-slate-900 text-xs" title={partyName}>
                              {partyName}
                            </div>
                            <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 truncate mt-0.5">
                              <span className={`px-1 rounded text-[9px] font-bold ${
                                row.direction === 'Payment' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {row.direction}
                              </span>
                              {row.description && (
                                <span className="truncate">{row.description}</span>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Debit (Payment -) */}
                          <td className="p-3 text-right text-rose-700 font-mono tabular-nums font-semibold">
                            {row.debit > 0 ? `-${row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>

                          {/* Col 4: Credit (Receipt +) */}
                          <td className="p-3 text-right text-emerald-700 font-mono tabular-nums font-semibold">
                            {row.credit > 0 ? `+${row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>

                          {/* Col 5: Book Balance */}
                          <td className="p-3 text-right font-bold text-slate-900 font-mono tabular-nums">
                            {row.computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          {/* Col 6: Governance Badge */}
                          <td className="p-3 text-center">
                            {renderCompactGovernanceBadge(
                              row.harshilStatus === 'Yes',
                              row.vismayStatus === 'Yes',
                              row.l1Status === 'Yes',
                              row.adminStatus,
                              false
                            )}
                          </td>

                          {/* Col 7: Expand Chevron */}
                          <td className="p-3 text-center text-slate-400 group-hover:text-rose-700">
                            <button
                              type="button"
                              className="p-1 hover:bg-slate-200/60 rounded-md transition"
                              title={isExpanded ? 'Collapse line details' : 'Click to expand details'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-rose-700" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Line Details Panel */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
                                {/* Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                                  <div className="flex items-center space-x-2.5">
                                    <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
                                      <BookOpen className="w-4 h-4" />
                                    </span>
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                                        User Book Entry Details &bull; <span className="font-mono text-rose-800">{row.id}</span>
                                      </h4>
                                      <p className="text-[11px] text-slate-500">
                                        Date: <strong className="text-slate-700">{formatDisplayDate(row.date_of_transaction)}</strong> &bull; Flow: <strong className="text-slate-700">{row.direction}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => setInspectingUserTxn(row)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 flex items-center space-x-1 cursor-pointer transition"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Inspect Audit Board</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Party & Purpose Details */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Counterparty
                                      </span>
                                      <p className="text-xs font-bold text-slate-900">{partyName}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Description / Purpose
                                      </span>
                                      <p className="text-xs text-slate-800 leading-relaxed">
                                        {row.description || 'No description entered'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Financial Snapshot */}
                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                      Ledger Summary
                                    </span>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-500">Entry Amount:</span>
                                      <span className="font-mono font-bold text-slate-900">
                                        {formatCurrencyAmount(row.amount, row.currency)}
                                      </span>
                                    </div>
                                    {row.currency !== 'INR' && row.exchange_rate && (
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">FX Rate / INR:</span>
                                        <span className="font-mono text-slate-700">
                                          @{row.exchange_rate} &rarr; ₹{(row.amount * row.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200">
                                      <span className="text-slate-500">Book Running Balance:</span>
                                      <span className="font-mono font-bold text-rose-900">
                                        {formatCurrencyAmount(row.computedBalance, activeAccount?.account_currency)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Linked Bank Statement Entries */}
                                <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                                      <Landmark className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Linked Bank Statement Lines ({row.linkedBankEntries.length})</span>
                                    </span>
                                  </div>

                                  {row.linkedBankEntries.length > 0 ? (
                                    <div className="space-y-2">
                                      {row.linkedBankEntries.map(b => (
                                        <div
                                          key={b.id}
                                          className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2"
                                        >
                                          <div className="space-y-0.5">
                                            <div className="flex items-center space-x-2">
                                              <span className="font-mono font-bold text-xs text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                {b.id}
                                              </span>
                                              <span className="text-[11px] text-slate-500 font-mono">
                                                Value Date: {formatDisplayDate(b.value_date)}
                                              </span>
                                              {b.reference_no && (
                                                <span className="text-[11px] text-blue-600 font-mono font-medium">
                                                  Ref: {b.reference_no}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-[11px] text-slate-700 font-medium">
                                              {b.narration}
                                            </p>
                                          </div>

                                          <div className="flex items-center space-x-3 shrink-0" onClick={e => e.stopPropagation()}>
                                            <div className="text-right">
                                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Bank Amount</span>
                                              <span className="font-mono font-bold text-xs text-slate-900">
                                                {formatCurrencyAmount(b.credit > 0 ? b.credit : b.debit, activeAccount?.account_currency)}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => setInspectingBankTxn(b)}
                                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center space-x-1 cursor-pointer transition"
                                            >
                                              <span>Inspect Bank Line</span>
                                              <ExternalLink className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-xs italic">
                                      No bank statement lines currently linked.
                                    </div>
                                  )}
                                </div>

                                {/* Dual-Admin Governance & Accountant Sign-off */}
                                <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Dual Co-Founder Governance &amp; Accountant Sign-off
                                  </span>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Layer 1: Accountant */}
                                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700">Layer 1 &bull; Accountant</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          row.l1Status === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                          {row.l1Status === 'Yes' ? 'Closed' : 'Pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {row.l1Status === 'Yes' ? 'Accountant approved & paired with statement.' : 'Pending accountant sign-off.'}
                                      </p>
                                    </div>

                                    {/* Harshil Zaveri */}
                                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700">Harshil Zaveri (Co-Founder)</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          row.harshilStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {row.harshilStatus === 'Yes' ? 'Approved' : 'Pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {row.harshilApproval ? (
                                          <>
                                            <span className="font-medium text-slate-700">{formatDisplayDateTime(row.harshilApproval.decided_at)}</span>
                                            {row.harshilApproval.comment && (
                                              <span className="block italic text-slate-600 mt-0.5">&ldquo;{row.harshilApproval.comment}&rdquo;</span>
                                            )}
                                          </>
                                        ) : (
                                          'Awaiting Harshil sign-off'
                                        )}
                                      </p>
                                    </div>

                                    {/* Vismay Zaveri */}
                                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700">Vismay Zaveri (Co-Founder)</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          row.vismayStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {row.vismayStatus === 'Yes' ? 'Approved' : 'Pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {row.vismayApproval ? (
                                          <>
                                            <span className="font-medium text-slate-700">{formatDisplayDateTime(row.vismayApproval.decided_at)}</span>
                                            {row.vismayApproval.comment && (
                                              <span className="block italic text-slate-600 mt-0.5">&ldquo;{row.vismayApproval.comment}&rdquo;</span>
                                            )}
                                          </>
                                        ) : (
                                          'Awaiting Vismay sign-off'
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect User Txn Board Modal */}
      {inspectingUserTxn && (
        <TransactionBoardModal
          transaction={inspectingUserTxn}
          onClose={() => setInspectingUserTxn(null)}
        />
      )}

      {/* Inspect Bank Txn Board Modal */}
      {inspectingBankTxn && (
        <BankTransactionBoardModal
          bankTransaction={inspectingBankTxn}
          onClose={() => setInspectingBankTxn(null)}
          onOpenUserBoard={u => {
            setInspectingBankTxn(null);
            setInspectingUserTxn(u);
          }}
        />
      )}
    </div>
  );
};
