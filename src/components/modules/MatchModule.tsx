import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, BankTransaction } from '../../types/database';
import {
  getMatchCandidatesForUserTxn,
  getMatchCandidatesForBankTxn,
  MatchCandidate,
  MatchCandidateUser,
} from '../../lib/matching';
import { formatDisplayDate, formatCurrencyAmount } from '../../lib/formatters';
import {
  GitMerge,
  Check,
  AlertCircle,
  Sparkles,
  Filter,
  ExternalLink,
  ShieldAlert,
  Landmark,
  CheckCircle2,
  ArrowRightLeft,
  UserCheck,
  FileText,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionBoardModal } from './TransactionBoardModal';
import { BankTransactionBoardModal } from './BankTransactionBoardModal';

export const MatchModule: React.FC = () => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    userTransactions,
    accounts,
    partiesMap,
    txnBankLinks,
    closeInMatchTab,
    moveDiscrepancyToOpen,
    markTransactionAsQueried,
    currentRole,
    activeCompanyId,
    approvals,
  } = useApp();

  // Dual-view mode: 'user_to_bank' or 'bank_to_user'
  const [matchMode, setMatchMode] = useState<'user_to_bank' | 'bank_to_user'>('user_to_bank');

  // Transaction Board Modal state
  const [boardTxn, setBoardTxn] = useState<UserTransaction | null>(null);
  const [bankBoardTxn, setBankBoardTxn] = useState<BankTransaction | null>(null);

  // Filter user transactions that need matching or are open/in_approval
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [verifiedToggle, setVerifiedToggle] = useState<'Yes' | 'No'>('Yes');
  const [closeNote, setCloseNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [isQueryInputOpen, setIsQueryInputOpen] = useState(false);
  const [queryInputReason, setQueryInputReason] = useState('');

  // Bank to User state
  const [selectedBankTxnId, setSelectedBankTxnId] = useState<string | null>(null);
  const [selectedCandidateUserIds, setSelectedCandidateUserIds] = useState<Set<string>>(new Set());

  // Set of bank transaction IDs already linked
  const linkedBankIds = useMemo(() => new Set(txnBankLinks.map(l => l.bank_txn_id)), [txnBankLinks]);

  // Set of user transaction IDs approved by both Admin 1 and Admin 2 (Layer 3 approved)
  const closedTxnIds = useMemo(() => {
    return new Set(
      approvals
        .filter(a => a.layer === 3 && a.decision === 'approved')
        .map(a => a.user_txn_id)
    );
  }, [approvals]);

  // --------------------------------------------------------------------------
  // TAB 1: USER -> BANK MATCHING
  // --------------------------------------------------------------------------
  const counts = useMemo(() => {
    return {
      all: scopedUserTransactions.length,
      open: scopedUserTransactions.filter(t => t.status === 'open').length,
      queried: scopedUserTransactions.filter(t => t.status === 'queried').length,
      unconfirmed: scopedUserTransactions.filter(t => t.amount_confirmed === 'Unconfirmed').length,
      in_approval: scopedUserTransactions.filter(t => t.status === 'in_approval').length,
      closed: scopedUserTransactions.filter(t => closedTxnIds.has(t.id)).length,
    };
  }, [scopedUserTransactions, closedTxnIds]);

  const openUserTxns = useMemo(() => {
    return scopedUserTransactions.filter(t => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'unconfirmed') return t.amount_confirmed === 'Unconfirmed';
      if (statusFilter === 'closed') return closedTxnIds.has(t.id);
      return t.status === statusFilter;
    });
  }, [scopedUserTransactions, statusFilter, closedTxnIds]);

  const handleRaiseQuery = () => {
    if (!selectedTxn) return;
    if (!queryInputReason.trim()) {
      alert('Please provide a reason or question for the query.');
      return;
    }
    markTransactionAsQueried(selectedTxn.id, queryInputReason.trim());
    setFeedback(`Transaction ${selectedTxn.id} tagged as QUERY. Audit delta and comment recorded.`);
    setQueryInputReason('');
    setIsQueryInputOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const selectedTxn = useMemo(() => {
    if (!selectedTxnId) return openUserTxns[0] || null;
    return scopedUserTransactions.find(t => t.id === selectedTxnId) || null;
  }, [selectedTxnId, openUserTxns, scopedUserTransactions]);

  const candidatesForUser: MatchCandidate[] = useMemo(() => {
    if (!selectedTxn) return [];
    const availableBankTxns = scopedBankTransactions.filter(b => !linkedBankIds.has(b.id));
    const partyName = selectedTxn.party_id ? partiesMap.get(selectedTxn.party_id)?.system_name : selectedTxn.party_name_raw;
    return getMatchCandidatesForUserTxn(selectedTxn, availableBankTxns, partyName, 7, 0.6);
  }, [selectedTxn, scopedBankTransactions, partiesMap, linkedBankIds]);

  const toggleBankSelection = (bankId: string) => {
    setSelectedBankIds(prev => {
      const next = new Set(prev);
      if (next.has(bankId)) next.delete(bankId);
      else next.add(bankId);
      return next;
    });
  };

  const handleCloseUserTransaction = () => {
    if (!selectedTxn) return;

    if (currentRole === 'Staff') {
      alert('Staff users can view match candidates but cannot close transactions. Please ask a Manager, Accountant or Admin.');
      return;
    }

    const linkedIds = Array.from(selectedBankIds);
    closeInMatchTab(selectedTxn.id, linkedIds, verifiedToggle, closeNote);

    setFeedback(`Success: Transaction ${selectedTxn.id} reconciled & closed at Layer 1! (Auto-confirmed)`);
    setSelectedBankIds(new Set());
    setCloseNote('');
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    setTimeout(() => setFeedback(null), 4000);
  };

  // --------------------------------------------------------------------------
  // TAB 2: BANK -> USER MATCHING
  // --------------------------------------------------------------------------
  const [bankStatusFilter, setBankStatusFilter] = useState<'unlinked' | 'reconciled' | 'all'>('unlinked');

  const bankCounts = useMemo(() => {
    return {
      unlinked: scopedBankTransactions.filter(b => !linkedBankIds.has(b.id)).length,
      reconciled: scopedBankTransactions.filter(b => linkedBankIds.has(b.id)).length,
      all: scopedBankTransactions.length,
    };
  }, [scopedBankTransactions, linkedBankIds]);

  const displayBankTxns = useMemo(() => {
    return scopedBankTransactions.filter(b => {
      if (bankStatusFilter === 'unlinked') return !linkedBankIds.has(b.id);
      if (bankStatusFilter === 'reconciled') return linkedBankIds.has(b.id);
      return true;
    });
  }, [scopedBankTransactions, linkedBankIds, bankStatusFilter]);

  const selectedBankTxn = useMemo(() => {
    if (!selectedBankTxnId) return displayBankTxns[0] || null;
    return scopedBankTransactions.find(b => b.id === selectedBankTxnId) || null;
  }, [selectedBankTxnId, displayBankTxns, scopedBankTransactions]);

  const candidatesForBank: MatchCandidateUser[] = useMemo(() => {
    if (!selectedBankTxn) return [];
    // Compare against open user transactions
    const eligibleUserTxns = scopedUserTransactions.filter(t => t.status === 'open');
    return getMatchCandidatesForBankTxn(selectedBankTxn, eligibleUserTxns, partiesMap, 7, 0.6);
  }, [selectedBankTxn, scopedUserTransactions, partiesMap]);

  const toggleCandidateUserSelection = (userId: string) => {
    setSelectedCandidateUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleReconcileFromBankSide = () => {
    if (!selectedBankTxn || selectedCandidateUserIds.size === 0) return;

    if (currentRole === 'Staff') {
      alert('Staff users can view candidates but cannot close transactions. Please ask a Manager, Accountant or Admin.');
      return;
    }

    const userIds = Array.from(selectedCandidateUserIds);
    for (const uId of userIds) {
      closeInMatchTab(uId, [selectedBankTxn.id], 'Yes', closeNote || `Matched via Bank Statement Line ${selectedBankTxn.id}`);
    }

    setFeedback(`Success: Bank line ${selectedBankTxn.id} reconciled with ${userIds.length} User Transaction(s)! (Auto-confirmed)`);
    setSelectedCandidateUserIds(new Set());
    setCloseNote('');
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Module Title & Mode Switcher */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
            <GitMerge className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Match & Reconcile (Layer 1 Approval)</h1>
            <p className="text-xs text-slate-500">
              Dual Reconciliation Workbench &bull; Auto-confirms unconfirmed transactions upon matching &bull; Confidence scoring
            </p>
          </div>
        </div>

        {/* Dual View Tabs */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMatchMode('user_to_bank')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              matchMode === 'user_to_bank'
                ? 'bg-white text-blue-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>User &rarr; Bank Match</span>
          </button>
          <button
            type="button"
            onClick={() => setMatchMode('bank_to_user')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              matchMode === 'bank_to_user'
                ? 'bg-white text-emerald-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Bank &rarr; User Match</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 1: USER -> BANK MATCHING WORKBENCH */}
      {/* ==================================================================== */}
      {matchMode === 'user_to_bank' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: User Transactions Queue (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[750px]">
            <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    User Transactions ({openUserTxns.length})
                  </h3>
                  <span className="text-[10px] text-slate-500">Pick one to inspect or match candidates</span>
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold no-scrollbar">
                <button
                  type="button"
                  onClick={() => setStatusFilter('open')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    statusFilter === 'open'
                      ? 'bg-rose-700 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Open ({counts.open})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('queried')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 flex items-center space-x-1 ${
                    statusFilter === 'queried'
                      ? 'bg-purple-700 text-white font-bold shadow-xs'
                      : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <span>Queried</span>
                  <span className="px-1 bg-purple-200/60 rounded text-[9px] font-bold">{counts.queried}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('unconfirmed')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    statusFilter === 'unconfirmed'
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Unconfirmed ({counts.unconfirmed})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('in_approval')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    statusFilter === 'in_approval'
                      ? 'bg-blue-700 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  In Approval ({counts.in_approval})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('closed')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    statusFilter === 'closed'
                      ? 'bg-emerald-700 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Closed ({counts.closed})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    statusFilter === 'all'
                      ? 'bg-slate-800 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({counts.all})
                </button>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {openUserTxns.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No user transactions matching this filter.
                </div>
              ) : (
                openUserTxns.map(t => {
                  const isSelected = selectedTxn?.id === t.id;
                  const party = t.party_id ? partiesMap.get(t.party_id) : null;
                  const existingLinks = txnBankLinks.filter(l => l.user_txn_id === t.id);

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTxnId(t.id);
                        setSelectedBankIds(new Set(existingLinks.map(l => l.bank_txn_id)));
                      }}
                      className={`p-4 cursor-pointer transition ${
                        isSelected
                          ? 'bg-rose-50/90 border-l-4 border-rose-600 shadow-inner'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-rose-950 font-mono">{t.id}</span>
                        <span className="text-[11px] text-slate-500 font-sans">
                          {formatDisplayDate(t.date_of_transaction)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900 truncate max-w-[190px]">
                          {party?.system_name || t.party_name_raw}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 tabular-nums">
                          {formatCurrencyAmount(t.amount, t.currency)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80 text-[10px]">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              t.amount_confirmed === 'Confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {t.amount_confirmed}
                          </span>

                          {closedTxnIds.has(t.id) ? (
                            <span className="px-1.5 py-0.2 rounded font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] tracking-wider">
                              CLOSED (Admin 1 &amp; 2 Approved)
                            </span>
                          ) : t.status === 'queried' ? (
                            <span className="px-1.5 py-0.2 rounded font-extrabold uppercase bg-purple-100 text-purple-900 border border-purple-300 text-[9px] tracking-wider animate-pulse">
                              QUERY
                            </span>
                          ) : (
                            <span
                              className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                t.status === 'approved'
                                  ? 'text-emerald-700'
                                  : t.status === 'in_approval'
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {t.status.replace('_', ' ')}
                            </span>
                          )}

                          {existingLinks.length > 0 && (
                            <span className="text-blue-700 font-semibold font-mono">
                              {existingLinks.length} bank link(s)
                            </span>
                          )}
                        </div>

                        {/* Open Board Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBoardTxn(t);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-semibold flex items-center space-x-1 cursor-pointer transition text-[10px]"
                          title="Open Transaction Board"
                        >
                          <FileText className="w-3 h-3 text-rose-700" />
                          <span>Board</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Candidate Bank Statement Entries & Close Box (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col justify-between">
            {selectedTxn ? (
              <>
                {/* Selected Transaction Summary Header */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50/80 via-white to-slate-50 border border-rose-200/80 shadow-xs space-y-2 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-rose-800 text-sm font-mono">{selectedTxn.id}</span>
                      <span className="text-xs text-slate-500">&bull; {formatDisplayDate(selectedTxn.date_of_transaction)}</span>
                      {selectedTxn.status === 'queried' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 rounded font-extrabold text-[10px] tracking-wider animate-pulse">
                          QUERY TAG
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
                        {formatCurrencyAmount(selectedTxn.amount, selectedTxn.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBoardTxn(selectedTxn)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                        title="Open full Transaction Board"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Board</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-slate-500">Party:</span>{' '}
                    <strong className="text-slate-900 font-bold">
                      {partiesMap.get(selectedTxn.party_id || '')?.system_name || selectedTxn.party_name_raw}
                    </strong>
                  </div>

                  {selectedTxn.description && (
                    <p className="text-[11px] text-slate-600 italic">"{selectedTxn.description}"</p>
                  )}
                </div>

                {/* Confidence Candidate List */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Bank Statement Candidates (± 7 Days, Confidence Ranked)</span>
                    </h3>
                    <span className="text-[10px] text-slate-500">{candidatesForUser.length} candidate(s)</span>
                  </div>

                  {candidatesForUser.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-xs text-slate-400 space-y-2">
                      <p>No matching bank statement lines found within ± 7 days.</p>
                      <p className="text-[11px] text-emerald-700 font-semibold">
                        Note: You can still CLOSE this transaction right now without bank data!
                      </p>
                    </div>
                  ) : (
                    candidatesForUser.map(c => {
                      const isChecked = selectedBankIds.has(c.bankTxn.id);
                      const bAmount = selectedTxn.direction === 'Payment' ? c.bankTxn.debit : c.bankTxn.credit;

                      return (
                        <div
                          key={c.bankTxn.id}
                          onClick={() => toggleBankSelection(c.bankTxn.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition text-xs space-y-2 ${
                            isChecked
                              ? 'bg-blue-50/90 border-blue-500 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className="font-bold text-blue-900 font-mono">{c.bankTxn.id}</span>
                              <span className="text-[11px] text-slate-500">{formatDisplayDate(c.bankTxn.value_date)}</span>
                            </div>

                            {/* Confidence Badge & Bank Board Trigger */}
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBankBoardTxn(c.bankTxn);
                                }}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-blue-800 text-[10px] font-semibold flex items-center space-x-1 cursor-pointer transition"
                                title="Open Bank Statement Board"
                              >
                                <Landmark className="w-2.5 h-2.5 text-blue-700" />
                                <span>Board</span>
                              </button>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  c.confidenceScore >= 80
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : c.confidenceScore >= 50
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {c.confidenceScore}% Confidence
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="font-mono text-[11px] text-slate-800 max-w-[280px] truncate" title={c.bankTxn.narration}>
                              {c.bankTxn.narration}
                            </p>
                            <span className="font-mono font-bold text-slate-900 tabular-nums">
                              {formatCurrencyAmount(bAmount, c.bankTxn.currency)}
                            </span>
                          </div>

                          {/* Match Reasons */}
                          {c.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              {c.reasons.map((r, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-blue-100/60 text-blue-800 rounded">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Close Action Box (Layer 1 Approval) */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase">Execute Layer 1 Closing</h4>
                      <span className="text-[11px] text-slate-500 block">
                        {selectedBankIds.size > 0
                          ? `${selectedBankIds.size} bank line(s) selected for reconciliation link (auto-confirms amount)`
                          : 'No bank lines selected. Closing with verified_with_bank = No.'}
                      </span>
                    </div>

                    {/* Verified With Bank Toggle */}
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-600 font-semibold">Verified with Bank?</span>
                      <button
                        type="button"
                        onClick={() => setVerifiedToggle(prev => (prev === 'Yes' ? 'No' : 'Yes'))}
                        className={`px-3 py-1 rounded font-bold text-xs border cursor-pointer ${
                          verifiedToggle === 'Yes'
                            ? 'bg-emerald-700 text-white border-emerald-800'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {verifiedToggle}
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Optional closing comment / note..."
                    value={closeNote}
                    onChange={e => setCloseNote(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                  />

                  {isQueryInputOpen && (
                    <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                        <span>Raise Query for Admin / Staff Review</span>
                        <button type="button" onClick={() => setIsQueryInputOpen(false)} className="text-purple-600 hover:text-purple-900 text-xs cursor-pointer">Cancel</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Enter specific question or discrepancy reason for Admin..."
                        value={queryInputReason}
                        onChange={e => setQueryInputReason(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleRaiseQuery}
                          className="px-4 py-1.5 bg-purple-700 text-white font-bold text-xs rounded-lg hover:bg-purple-800 transition cursor-pointer"
                        >
                          Confirm & Tag as QUERY
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="flex items-center space-x-2">
                      {selectedTxn.status === 'queried' ? (
                        <button
                          type="button"
                          onClick={() => {
                            moveDiscrepancyToOpen(selectedTxn.id, 'Query addressed, re-opened');
                            setFeedback(`Query cleared for ${selectedTxn.id} and moved back to Open.`);
                            setTimeout(() => setFeedback(null), 4000);
                          }}
                          className="px-3 py-2 bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200 font-bold text-xs rounded-lg transition cursor-pointer"
                        >
                          Clear Query & Re-Open
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsQueryInputOpen(prev => !prev)}
                          className="px-3 py-2 bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                          <span>Raise Query</span>
                        </button>
                      )}
                    </div>

                    {currentRole === 'Staff' ? (
                      <div className="w-full sm:w-auto px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold flex items-center space-x-2">
                        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Staff View-Only: Closing transactions (Layer 1) is reserved for Manager, Accountant, or Admin.</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleCloseUserTransaction}
                        disabled={selectedTxn.status !== 'open'}
                        className="w-full sm:w-auto px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {selectedTxn.status !== 'open'
                            ? selectedTxn.status === 'queried'
                              ? 'Action Blocked (Queried)'
                              : 'Transaction Already Closed'
                            : selectedBankIds.size > 0
                            ? `Close & Link (${selectedBankIds.size} Bank Line)`
                            : 'Close Without Bank Links (Ready for Approvals)'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a user transaction from the left queue to begin matching.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: BANK -> USER MATCHING WORKBENCH */}
      {/* ==================================================================== */}
      {matchMode === 'bank_to_user' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Bank Statement Lines with Status Filter (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[750px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Bank Statement Lines ({displayBankTxns.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">Pick a bank statement line to find user match</span>
                </div>
              </div>

              {/* Status Filter Chips for Bank Transactions */}
              <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setBankStatusFilter('unlinked')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    bankStatusFilter === 'unlinked'
                      ? 'bg-blue-700 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Unlinked ({bankCounts.unlinked})
                </button>
                <button
                  type="button"
                  onClick={() => setBankStatusFilter('reconciled')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    bankStatusFilter === 'reconciled'
                      ? 'bg-emerald-700 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Reconciled / Closed ({bankCounts.reconciled})
                </button>
                <button
                  type="button"
                  onClick={() => setBankStatusFilter('all')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer shrink-0 ${
                    bankStatusFilter === 'all'
                      ? 'bg-slate-800 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({bankCounts.all})
                </button>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {displayBankTxns.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No bank statement lines matching this filter.
                </div>
              ) : (
                displayBankTxns.map(b => {
                  const isSelected = selectedBankTxn?.id === b.id;
                  const party = b.party_id ? partiesMap.get(b.party_id) : null;
                  const bAmount = b.debit > 0 ? b.debit : b.credit;
                  const isDebit = b.debit > 0;
                  const isLinked = linkedBankIds.has(b.id);

                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBankTxnId(b.id);
                        setSelectedCandidateUserIds(new Set());
                      }}
                      className={`p-4 cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50/90 border-l-4 border-blue-600 shadow-inner'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-blue-900 font-mono">{b.id}</span>
                        <span className="text-[11px] text-slate-500 font-sans">
                          {formatDisplayDate(b.value_date)}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-900 truncate mb-1" title={b.narration}>
                        {b.narration}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80 text-[10px]">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            isDebit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isDebit ? 'Payment (Debit)' : 'Receipt (Credit)'}
                          </span>

                          {isLinked ? (
                            <span className="px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Reconciled
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-600">
                              Unlinked
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-slate-900 tabular-nums">
                            {formatCurrencyAmount(bAmount, b.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBankBoardTxn(b);
                            }}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-semibold flex items-center space-x-1 cursor-pointer transition text-[10px]"
                            title="Open Bank Statement Board"
                          >
                            <Landmark className="w-3 h-3 text-blue-700" />
                            <span>Board</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Candidate User Transactions (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col justify-between">
            {selectedBankTxn ? (
              <>
                {/* Selected Bank Entry Summary Header */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/80 via-white to-slate-50 border border-blue-200/80 shadow-xs space-y-2 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-blue-800 text-sm font-mono">{selectedBankTxn.id}</span>
                      <span className="text-xs text-slate-500">&bull; {formatDisplayDate(selectedBankTxn.value_date)}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-mono font-bold text-blue-700 tabular-nums">
                        {formatCurrencyAmount(
                          selectedBankTxn.debit > 0 ? selectedBankTxn.debit : selectedBankTxn.credit,
                          selectedBankTxn.currency
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBankBoardTxn(selectedBankTxn)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                        title="Open Bank Statement Board"
                      >
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Board</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-slate-500">Bank Narration:</span>{' '}
                    <strong className="text-slate-900 font-mono font-medium">{selectedBankTxn.narration}</strong>
                  </div>

                  {selectedBankTxn.reference_no && (
                    <div className="text-[11px] text-blue-600 font-mono">
                      Ref / UTR: {selectedBankTxn.reference_no}
                    </div>
                  )}
                </div>

                {/* Candidate User Transactions List or Reconciled Linked Details */}
                {linkedBankIds.has(selectedBankTxn.id) ? (
                  <div className="space-y-4 flex-1">
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold">This bank statement line is already reconciled and linked.</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        RECONCILED
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Linked User Transaction(s)
                      </h4>
                      {userTransactions
                        .filter(u => txnBankLinks.some(l => l.bank_txn_id === selectedBankTxn.id && l.user_txn_id === u.id))
                        .map(u => {
                          const p = u.party_id ? partiesMap.get(u.party_id) : null;
                          return (
                            <div key={u.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-rose-900 font-mono">{u.id}</span>
                                  <span className="text-slate-500">&bull; {formatDisplayDate(u.date_of_transaction)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    u.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                    u.status === 'in_approval' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-200 text-slate-700'
                                  }`}>
                                    {u.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="font-medium text-slate-900 mt-1">
                                  {p?.system_name || u.party_name_raw}
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                                  {formatCurrencyAmount(u.amount, u.currency)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBoardTxn(u)}
                                  className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-semibold border border-slate-200 flex items-center space-x-1 cursor-pointer transition text-xs shadow-2xs"
                                  title="Open User Transaction Board"
                                >
                                  <FileText className="w-3.5 h-3.5 text-rose-700" />
                                  <span>Board</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Candidate User Transactions List */}
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center space-x-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span>User Transaction Candidates (&plusmn; 7 Days, Confidence Ranked)</span>
                        </h3>
                        <span className="text-[10px] text-slate-500">{candidatesForBank.length} candidate(s)</span>
                      </div>

                      {candidatesForBank.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-xs text-slate-400 space-y-2">
                          <p>No matching user transactions found within &plusmn; 7 days.</p>
                          <p className="text-[11px] text-slate-500">
                            Enter the transaction in User Entry first, or check the transaction date.
                          </p>
                        </div>
                      ) : (
                        candidatesForBank.map(c => {
                          const isChecked = selectedCandidateUserIds.has(c.userTxn.id);
                          const party = c.userTxn.party_id ? partiesMap.get(c.userTxn.party_id) : null;

                          return (
                            <div
                              key={c.userTxn.id}
                              onClick={() => toggleCandidateUserSelection(c.userTxn.id)}
                              className={`p-3.5 rounded-xl border cursor-pointer transition text-xs space-y-2 ${
                                isChecked
                                  ? 'bg-emerald-50/90 border-emerald-500 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="rounded text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="font-bold text-rose-900 font-mono">{c.userTxn.id}</span>
                                  <span className="text-[11px] text-slate-500">
                                    {formatDisplayDate(c.userTxn.date_of_transaction)}
                                  </span>
                                  {c.userTxn.status === 'queried' && (
                                    <span className="px-1.5 py-0.2 rounded font-extrabold uppercase bg-purple-100 text-purple-900 border border-purple-300 text-[9px] tracking-wider animate-pulse">
                                      QUERY
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2">
                                  {/* Confidence Badge */}
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      c.confidenceScore >= 80
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : c.confidenceScore >= 50
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {c.confidenceScore}% Confidence
                                  </span>

                                  {/* Board button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBoardTxn(c.userTxn);
                                    }}
                                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-semibold flex items-center space-x-1 cursor-pointer transition text-[10px]"
                                    title="Open Transaction Board"
                                  >
                                    <FileText className="w-3 h-3 text-rose-700" />
                                    <span>Board</span>
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900 truncate max-w-[280px]">
                                  {party?.system_name || c.userTxn.party_name_raw}
                                </span>
                                <span className="font-mono font-bold text-slate-900 tabular-nums">
                                  {formatCurrencyAmount(c.userTxn.amount, c.userTxn.currency)}
                                </span>
                              </div>

                              {/* Match Reasons */}
                              {c.reasons.length > 0 && (
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                  {c.reasons.map((r, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-emerald-100/60 text-emerald-800 rounded">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Close Action Box for Bank Side */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase">Execute Bank Reconciliation</h4>
                          <span className="text-[11px] text-slate-500 block">
                            {selectedCandidateUserIds.size > 0
                              ? `Will link Bank Line ${selectedBankTxn.id} to ${selectedCandidateUserIds.size} User Transaction(s) and auto-confirm amounts`
                              : 'Select at least one matching user transaction above'}
                          </span>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Optional reconciliation note..."
                        value={closeNote}
                        onChange={e => setCloseNote(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      />

                      <div className="flex items-center justify-end space-x-3 pt-1">
                        {currentRole === 'Staff' ? (
                          <div className="w-full sm:w-auto px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold flex items-center space-x-2">
                            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Staff View-Only: Reconciliation is reserved for Manager, Accountant, or Admin.</span>
                          </div>
                        ) : (
                          <button
                            onClick={handleReconcileFromBankSide}
                            disabled={selectedCandidateUserIds.size === 0}
                            className="w-full sm:w-auto px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>
                              Reconcile &amp; Link ({selectedCandidateUserIds.size} User Txn)
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a bank statement entry from the left queue to begin matching.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1-Click Transaction Board Modal Launcher */}
      {boardTxn && (
        <TransactionBoardModal
          transaction={boardTxn}
          onClose={() => setBoardTxn(null)}
        />
      )}

      {/* 1-Click Bank Transaction Board Modal Launcher */}
      {bankBoardTxn && (
        <BankTransactionBoardModal
          bankTransaction={bankBoardTxn}
          onClose={() => setBankBoardTxn(null)}
          onOpenUserBoard={(u) => setBoardTxn(u)}
        />
      )}
    </div>
  );
};
