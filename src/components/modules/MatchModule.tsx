import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, BankTransaction } from '../../types/database';
import {
  getMatchCandidatesForUserTxn,
  getMatchCandidatesForBankTxn,
  MatchCandidate,
  MatchCandidateUser,
} from '../../lib/matching';
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatCurrencyAmount,
} from '../../lib/formatters';
import {
  GitMerge,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Landmark,
  CheckCircle2,
  UserCheck,
  FileText,
  HelpCircle,
  Clock,
  RotateCcw,
  Shield,
  Unlink,
  CheckCheck,
  User,
  Search,
  X,
  Building,
  Filter,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionBoardModal } from './TransactionBoardModal';
import { BankTransactionBoardModal } from './BankTransactionBoardModal';

export type MatchStatusFilter =
  | 'open'
  | 'queried'
  | 'unconfirmed'
  | 'in_approval'
  | 'pending_harshil'
  | 'pending_vismay'
  | 'closed'
  | 'all';

export const MatchModule: React.FC = () => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    userTransactions,
    accounts,
    partiesMap,
    txnBankLinks,
    unlinkTxnBank,
    closeInMatchTab,
    moveDiscrepancyToOpen,
    markTransactionAsQueried,
    currentRole,
    currentUser,
    approvals,
    comments,
    addComment,
    hasHarshilApproved,
    hasVismayApproved,
    submitAdminApproval,
    undoAdminApproval,
    isHarshilUser,
    isVismayUser,
    allUsers,
  } = useApp();

  // Dual-view mode: 'user_to_bank' or 'bank_to_user'
  const [matchMode, setMatchMode] = useState<'user_to_bank' | 'bank_to_user'>('user_to_bank');

  // Transaction Board Modal state
  const [boardTxn, setBoardTxn] = useState<UserTransaction | null>(null);
  const [bankBoardTxn, setBankBoardTxn] = useState<BankTransaction | null>(null);

  // Global status filter (shared across both modes via Executive Pipeline Ribbon)
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('open');

  // Search queries for both sides
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // Mode 1: User -> Bank state
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [verifiedToggle, setVerifiedToggle] = useState<'Yes' | 'No'>('Yes');
  const [closeNote, setCloseNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isQueryInputOpen, setIsQueryInputOpen] = useState(false);
  const [queryInputReason, setQueryInputReason] = useState('');

  // Mode 2: Bank -> User state
  const [selectedBankTxnId, setSelectedBankTxnId] = useState<string | null>(null);
  const [selectedCandidateUserIds, setSelectedCandidateUserIds] = useState<Set<string>>(new Set());

  // Set of bank transaction IDs already linked
  const linkedBankIds = useMemo(() => new Set(txnBankLinks.map(l => l.bank_txn_id)), [txnBankLinks]);

  // Helper: Is transaction fully closed (both Harshil & Vismay approved or status === 'approved')
  const isTxnClosed = (t: UserTransaction): boolean => {
    return (hasHarshilApproved(t.id) && hasVismayApproved(t.id)) || t.status === 'approved';
  };

  // Helper: Map lifecycle status of a Bank Transaction based on its linked User Transaction
  const getBankTxnLifecycle = (b: BankTransaction) => {
    const links = txnBankLinks.filter(l => l.bank_txn_id === b.id);
    const linkedTxns = userTransactions.filter(u => links.some(l => l.user_txn_id === u.id));
    const primary = linkedTxns[0] || null;

    if (!primary) {
      return {
        status: 'open' as MatchStatusFilter,
        primaryTxn: null,
        harshilApproved: false,
        vismayApproved: false,
        isClosed: false,
      };
    }

    const hDone = hasHarshilApproved(primary.id);
    const vDone = hasVismayApproved(primary.id);
    const closed = (hDone && vDone) || primary.status === 'approved';

    let status: MatchStatusFilter = 'in_approval';
    if (closed) {
      status = 'closed';
    } else if (primary.status === 'queried') {
      status = 'queried';
    } else if (primary.amount_confirmed === 'Unconfirmed') {
      status = 'unconfirmed';
    } else if (primary.status === 'in_approval') {
      if (hDone && !vDone) status = 'pending_vismay';
      else if (vDone && !hDone) status = 'pending_harshil';
      else status = 'in_approval';
    } else if (primary.status === 'open') {
      status = 'open';
    }

    return {
      status,
      primaryTxn: primary,
      harshilApproved: hDone,
      vismayApproved: vDone,
      isClosed: closed,
    };
  };

  // --------------------------------------------------------------------------
  // 1. COUNTS CALCULATION (FOR EXECUTIVE RIBBON)
  // --------------------------------------------------------------------------
  const userCounts = useMemo(() => {
    let openCount = 0;
    let queriedCount = 0;
    let unconfirmedCount = 0;
    let inApprovalCount = 0;
    let pendingHarshilCount = 0;
    let pendingVismayCount = 0;
    let closedCount = 0;

    scopedUserTransactions.forEach(t => {
      const hAppr = hasHarshilApproved(t.id);
      const vAppr = hasVismayApproved(t.id);
      const bothDone = (hAppr && vAppr) || t.status === 'approved';

      if (t.status === 'open') openCount++;
      if (t.status === 'queried') queriedCount++;
      if (t.amount_confirmed === 'Unconfirmed') unconfirmedCount++;
      if (t.status === 'in_approval' && !bothDone) inApprovalCount++;
      if (t.status === 'in_approval' && vAppr && !hAppr) pendingHarshilCount++;
      if (t.status === 'in_approval' && hAppr && !vAppr) pendingVismayCount++;
      if (bothDone) closedCount++;
    });

    return {
      open: openCount,
      queried: queriedCount,
      unconfirmed: unconfirmedCount,
      in_approval: inApprovalCount,
      pending_harshil: pendingHarshilCount,
      pending_vismay: pendingVismayCount,
      closed: closedCount,
      all: scopedUserTransactions.length,
    };
  }, [scopedUserTransactions, approvals, hasHarshilApproved, hasVismayApproved]);

  const bankCounts = useMemo(() => {
    let openCount = 0;
    let queriedCount = 0;
    let unconfirmedCount = 0;
    let inApprovalCount = 0;
    let pendingHarshilCount = 0;
    let pendingVismayCount = 0;
    let closedCount = 0;

    scopedBankTransactions.forEach(b => {
      const info = getBankTxnLifecycle(b);
      if (info.status === 'open') openCount++;
      if (info.status === 'queried') queriedCount++;
      if (info.status === 'unconfirmed') unconfirmedCount++;
      if (info.status === 'in_approval') inApprovalCount++;
      if (info.status === 'pending_harshil') pendingHarshilCount++;
      if (info.status === 'pending_vismay') pendingVismayCount++;
      if (info.status === 'closed') closedCount++;
    });

    return {
      open: openCount,
      queried: queriedCount,
      unconfirmed: unconfirmedCount,
      in_approval: inApprovalCount,
      pending_harshil: pendingHarshilCount,
      pending_vismay: pendingVismayCount,
      closed: closedCount,
      all: scopedBankTransactions.length,
    };
  }, [scopedBankTransactions, txnBankLinks, userTransactions, approvals, hasHarshilApproved, hasVismayApproved]);

  // Active counts based on current mode
  const activeCounts = matchMode === 'user_to_bank' ? userCounts : bankCounts;

  // --------------------------------------------------------------------------
  // 2. USER -> BANK LIST & SELECTION
  // --------------------------------------------------------------------------
  const openUserTxns = useMemo(() => {
    return scopedUserTransactions.filter(t => {
      const hAppr = hasHarshilApproved(t.id);
      const vAppr = hasVismayApproved(t.id);
      const bothDone = (hAppr && vAppr) || t.status === 'approved';

      let matchesFilter = true;
      if (statusFilter === 'all') matchesFilter = true;
      else if (statusFilter === 'open') matchesFilter = t.status === 'open';
      else if (statusFilter === 'queried') matchesFilter = t.status === 'queried';
      else if (statusFilter === 'unconfirmed') matchesFilter = t.amount_confirmed === 'Unconfirmed';
      else if (statusFilter === 'in_approval') matchesFilter = t.status === 'in_approval' && !bothDone;
      else if (statusFilter === 'pending_harshil') matchesFilter = t.status === 'in_approval' && vAppr && !hAppr;
      else if (statusFilter === 'pending_vismay') matchesFilter = t.status === 'in_approval' && hAppr && !vAppr;
      else if (statusFilter === 'closed') matchesFilter = bothDone;

      if (!matchesFilter) return false;

      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const partyName = (t.party_id ? partiesMap.get(t.party_id)?.system_name : t.party_name_raw) || '';
        const amtStr = String(t.amount);
        return (
          t.id.toLowerCase().includes(q) ||
          partyName.toLowerCase().includes(q) ||
          t.party_name_raw.toLowerCase().includes(q) ||
          amtStr.includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [scopedUserTransactions, statusFilter, userSearchQuery, approvals, hasHarshilApproved, hasVismayApproved, partiesMap]);

  const selectedTxn = useMemo(() => {
    if (!selectedTxnId) return openUserTxns[0] || null;
    return scopedUserTransactions.find(t => t.id === selectedTxnId) || null;
  }, [selectedTxnId, openUserTxns, scopedUserTransactions]);

  // Candidates for User Transaction (only needed when open)
  const candidatesForUser: MatchCandidate[] = useMemo(() => {
    if (!selectedTxn) return [];
    const availableBankTxns = scopedBankTransactions.filter(b => !linkedBankIds.has(b.id));
    const partyName = selectedTxn.party_id ? partiesMap.get(selectedTxn.party_id)?.system_name : selectedTxn.party_name_raw;
    return getMatchCandidatesForUserTxn(selectedTxn, availableBankTxns, partyName, 7, 0.6);
  }, [selectedTxn, scopedBankTransactions, partiesMap, linkedBankIds]);

  // Linked bank transactions for selectedTxn
  const selectedTxnLinkedBankEntries = useMemo(() => {
    if (!selectedTxn) return [];
    const links = txnBankLinks.filter(l => l.user_txn_id === selectedTxn.id);
    return scopedBankTransactions.filter(b => links.some(l => l.bank_txn_id === b.id));
  }, [selectedTxn, txnBankLinks, scopedBankTransactions]);

  // Approvals info for selectedTxn
  const selectedTxnApprovals = useMemo(() => {
    if (!selectedTxn) return { harshil: null, vismay: null, layer1: null };
    const list = approvals.filter(a => a.user_txn_id === selectedTxn.id && a.decision === 'approved');
    const l1 = list.find(a => a.layer === 1) || null;
    const harshilAppr = list.find(a => isHarshilUser(a.approver_id)) || null;
    const vismayAppr = list.find(a => isVismayUser(a.approver_id)) || null;
    return { harshil: harshilAppr, vismay: vismayAppr, layer1: l1 };
  }, [selectedTxn, approvals, isHarshilUser, isVismayUser]);

  // --------------------------------------------------------------------------
  // 3. BANK -> USER LIST & SELECTION
  // --------------------------------------------------------------------------
  const displayBankTxns = useMemo(() => {
    return scopedBankTransactions.filter(b => {
      const info = getBankTxnLifecycle(b);
      let matchesFilter = true;

      if (statusFilter === 'all') matchesFilter = true;
      else if (statusFilter === 'open') matchesFilter = info.status === 'open';
      else if (statusFilter === 'queried') matchesFilter = info.status === 'queried';
      else if (statusFilter === 'unconfirmed') matchesFilter = info.status === 'unconfirmed';
      else if (statusFilter === 'in_approval') matchesFilter = info.status === 'in_approval';
      else if (statusFilter === 'pending_harshil') matchesFilter = info.status === 'pending_harshil';
      else if (statusFilter === 'pending_vismay') matchesFilter = info.status === 'pending_vismay';
      else if (statusFilter === 'closed') matchesFilter = info.status === 'closed';

      if (!matchesFilter) return false;

      if (bankSearchQuery.trim()) {
        const q = bankSearchQuery.toLowerCase();
        const amtStr = String(b.debit > 0 ? b.debit : b.credit);
        return (
          b.id.toLowerCase().includes(q) ||
          b.narration.toLowerCase().includes(q) ||
          (b.reference_no && b.reference_no.toLowerCase().includes(q)) ||
          amtStr.includes(q)
        );
      }

      return true;
    });
  }, [scopedBankTransactions, statusFilter, bankSearchQuery, txnBankLinks, userTransactions, approvals, hasHarshilApproved, hasVismayApproved]);

  const selectedBankTxn = useMemo(() => {
    if (!selectedBankTxnId) return displayBankTxns[0] || null;
    return scopedBankTransactions.find(b => b.id === selectedBankTxnId) || null;
  }, [selectedBankTxnId, displayBankTxns, scopedBankTransactions]);

  const selectedBankLifecycle = useMemo(() => {
    if (!selectedBankTxn) return null;
    return getBankTxnLifecycle(selectedBankTxn);
  }, [selectedBankTxn, txnBankLinks, userTransactions, approvals, hasHarshilApproved, hasVismayApproved]);

  const candidatesForBank: MatchCandidateUser[] = useMemo(() => {
    if (!selectedBankTxn) return [];
    const eligibleUserTxns = scopedUserTransactions.filter(t => t.status === 'open');
    return getMatchCandidatesForBankTxn(selectedBankTxn, eligibleUserTxns, partiesMap, 7, 0.6);
  }, [selectedBankTxn, scopedUserTransactions, partiesMap]);

  // Approvals info for bank's linked user transaction
  const selectedBankTxnApprovals = useMemo(() => {
    if (!selectedBankLifecycle?.primaryTxn) return { harshil: null, vismay: null, layer1: null };
    const list = approvals.filter(a => a.user_txn_id === selectedBankLifecycle.primaryTxn!.id && a.decision === 'approved');
    const l1 = list.find(a => a.layer === 1) || null;
    const harshilAppr = list.find(a => isHarshilUser(a.approver_id)) || null;
    const vismayAppr = list.find(a => isVismayUser(a.approver_id)) || null;
    return { harshil: harshilAppr, vismay: vismayAppr, layer1: l1 };
  }, [selectedBankLifecycle, approvals, isHarshilUser, isVismayUser]);

  // --------------------------------------------------------------------------
  // 4. ACTION HANDLERS
  // --------------------------------------------------------------------------
  const toggleBankSelection = (bankId: string) => {
    setSelectedBankIds(prev => {
      const next = new Set(prev);
      if (next.has(bankId)) next.delete(bankId);
      else next.add(bankId);
      return next;
    });
  };

  const toggleCandidateUserSelection = (userId: string) => {
    setSelectedCandidateUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleRaiseQuery = (txnId?: string) => {
    const targetId = txnId || selectedTxn?.id || selectedBankLifecycle?.primaryTxn?.id;
    if (!targetId) return;
    if (!queryInputReason.trim()) {
      alert('Please provide a reason or question for the query.');
      return;
    }
    markTransactionAsQueried(targetId, queryInputReason.trim());
    setFeedback(`Transaction ${targetId} tagged as QUERY. Audit delta & comment recorded.`);
    setQueryInputReason('');
    setIsQueryInputOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleClearQuery = (txnId?: string) => {
    const targetId = txnId || selectedTxn?.id || selectedBankLifecycle?.primaryTxn?.id;
    if (!targetId) return;
    moveDiscrepancyToOpen(targetId, 'Query addressed, re-opened');
    setFeedback(`Query cleared for ${targetId}. Returned to Open.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCloseUserTransaction = () => {
    if (!selectedTxn) return;

    if (currentRole === 'Staff') {
      alert('Staff users can view match candidates but cannot close transactions. Please ask an Accountant, Manager, or Admin.');
      return;
    }

    const linkedIds = Array.from(selectedBankIds);
    closeInMatchTab(selectedTxn.id, linkedIds, verifiedToggle, closeNote);

    setFeedback(`Success: Transaction ${selectedTxn.id} reconciled & closed at Layer 1! (Auto-confirmed, ready for Admin Sign-off)`);
    setSelectedBankIds(new Set());
    setCloseNote('');
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleReconcileFromBankSide = () => {
    if (!selectedBankTxn || selectedCandidateUserIds.size === 0) return;

    if (currentRole === 'Staff') {
      alert('Staff users can view candidates but cannot close transactions. Please ask an Accountant, Manager, or Admin.');
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

  const handleAdminApprove = (txnId?: string) => {
    const targetId = txnId || selectedTxn?.id || selectedBankLifecycle?.primaryTxn?.id;
    if (!targetId) return;
    if (currentRole !== 'Admin') {
      alert('Unauthorized: Sign-off is reserved for Co-Founders Harshil Zaveri & Vismay Zaveri.');
      return;
    }

    const res = submitAdminApproval(targetId, adminNote);
    if (res.success) {
      setFeedback(res.message);
      setAdminNote('');
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
    } else {
      alert(res.message);
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleAdminUndo = (txnId?: string) => {
    const targetId = txnId || selectedTxn?.id || selectedBankLifecycle?.primaryTxn?.id;
    if (!targetId) return;
    if (currentRole !== 'Admin') {
      alert('Unauthorized: Only Administrators can undo sign-off.');
      return;
    }

    const res = undoAdminApproval(targetId);
    if (res.success) {
      setFeedback(res.message);
    } else {
      alert(res.message);
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  // Admin user verification flags
  const userIsHarshil = isHarshilUser(currentUser.id);
  const userIsVismay = isVismayUser(currentUser.id);

  // Check if current user has approved selectedTxn
  const myUserApprovalDone = selectedTxn
    ? (userIsHarshil && hasHarshilApproved(selectedTxn.id)) ||
      (userIsVismay && hasVismayApproved(selectedTxn.id)) ||
      (!userIsHarshil && !userIsVismay && approvals.some(a => a.user_txn_id === selectedTxn.id && a.approver_id === currentUser.id))
    : false;

  // Check if current user has approved selectedBank's primaryTxn
  const myBankApprovalDone = selectedBankLifecycle?.primaryTxn
    ? (userIsHarshil && hasHarshilApproved(selectedBankLifecycle.primaryTxn.id)) ||
      (userIsVismay && hasVismayApproved(selectedBankLifecycle.primaryTxn.id)) ||
      (!userIsHarshil && !userIsVismay && approvals.some(a => a.user_txn_id === selectedBankLifecycle.primaryTxn!.id && a.approver_id === currentUser.id))
    : false;

  // Configuration for the 8 Executive Pipeline Ribbon cards
  const pipelineStages: {
    id: MatchStatusFilter;
    label: string;
    sublabel: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    activeClass: string;
    badgeClass: string;
  }[] = [
    {
      id: 'open',
      label: 'Open Queue',
      sublabel: matchMode === 'user_to_bank' ? 'Pending Bank / L1' : 'Unlinked Lines',
      count: activeCounts.open,
      icon: GitMerge,
      accentColor: 'text-rose-600',
      activeClass: 'bg-rose-50 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 shadow-xs',
      badgeClass: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'queried',
      label: 'Queried',
      sublabel: 'Under Review',
      count: activeCounts.queried,
      icon: HelpCircle,
      accentColor: 'text-purple-600',
      activeClass: 'bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-500/20 shadow-xs',
      badgeClass: 'bg-purple-100 text-purple-900',
    },
    {
      id: 'unconfirmed',
      label: 'Unconfirmed',
      sublabel: 'Amount Flags',
      count: activeCounts.unconfirmed,
      icon: AlertCircle,
      accentColor: 'text-amber-600',
      activeClass: 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 shadow-xs',
      badgeClass: 'bg-amber-100 text-amber-900',
    },
    {
      id: 'in_approval',
      label: 'In Approval',
      sublabel: 'Layer 1 Closed',
      count: activeCounts.in_approval,
      icon: Shield,
      accentColor: 'text-blue-600',
      activeClass: 'bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-xs',
      badgeClass: 'bg-blue-100 text-blue-900',
    },
    {
      id: 'pending_harshil',
      label: 'With Harshil',
      sublabel: 'USR1 Sign-off',
      count: activeCounts.pending_harshil,
      icon: Clock,
      accentColor: 'text-indigo-600',
      activeClass: 'bg-indigo-50 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs',
      badgeClass: 'bg-indigo-100 text-indigo-900',
    },
    {
      id: 'pending_vismay',
      label: 'With Vismay',
      sublabel: 'USR2 Sign-off',
      count: activeCounts.pending_vismay,
      icon: Clock,
      accentColor: 'text-sky-600',
      activeClass: 'bg-sky-50 border-sky-500 text-sky-950 ring-2 ring-sky-500/20 shadow-xs',
      badgeClass: 'bg-sky-100 text-sky-900',
    },
    {
      id: 'closed',
      label: 'Closed',
      sublabel: 'Both Approved',
      count: activeCounts.closed,
      icon: CheckCircle2,
      accentColor: 'text-emerald-600',
      activeClass: 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs',
      badgeClass: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'all',
      label: 'All Records',
      sublabel: 'Complete Portfolio',
      count: activeCounts.all,
      icon: FileText,
      accentColor: 'text-slate-500',
      activeClass: 'bg-slate-900 border-slate-900 text-white ring-2 ring-slate-900/20 shadow-xs',
      badgeClass: 'bg-slate-800 text-slate-100',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header & Dual Mode Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 shadow-2xs">
            <GitMerge className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900 tracking-tight">
              Match &amp; Reconcile Workbench
            </h1>
            <p className="text-xs text-slate-500">
              Accountant Layer 1 Reconciliation &bull; Dual Co-Founder Governance (Harshil Zaveri &amp; Vismay Zaveri) &bull; Auto-confirms amounts
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setMatchMode('user_to_bank')}
            className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              matchMode === 'user_to_bank'
                ? 'bg-white text-blue-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span>User &rarr; Bank Match</span>
          </button>

          <button
            type="button"
            onClick={() => setMatchMode('bank_to_user')}
            className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              matchMode === 'bank_to_user'
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-4 h-4 text-emerald-700" />
            <span>Bank &rarr; User Match</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FULL-WIDTH EXECUTIVE PIPELINE MATRIX (NO HORIZONTAL SCROLL)           */}
      {/* ==================================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Lifecycle Governance Pipeline</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              &bull; Click any stage to filter {matchMode === 'user_to_bank' ? 'user transactions' : 'bank statement lines'}
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            Total {activeCounts.all} {matchMode === 'user_to_bank' ? 'Txns' : 'Bank Lines'}
          </span>
        </div>

        {/* 8 Pipeline Stage Cards in Responsive Grid (Zero Horizontal Scroll) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
          {pipelineStages.map(stage => {
            const Icon = stage.icon;
            const isActive = statusFilter === stage.id;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setStatusFilter(stage.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                  isActive
                    ? stage.activeClass
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-1.5">
                    <Icon className={`w-3.5 h-3.5 ${isActive && stage.id === 'all' ? 'text-white' : stage.accentColor}`} />
                    <span className="text-[11px] font-bold truncate tracking-tight">{stage.label}</span>
                  </div>
                  {isActive && (
                    <span className={`w-1.5 h-1.5 rounded-full ${stage.id === 'all' ? 'bg-white' : 'bg-current'}`} />
                  )}
                </div>

                <div className="flex items-baseline justify-between w-full pt-0.5">
                  <span className={`text-base font-bold font-mono tabular-nums ${isActive && stage.id === 'all' ? 'text-white' : 'text-slate-900'}`}>
                    {stage.count}
                  </span>
                  <span className={`text-[9px] font-medium truncate max-w-[85px] ${isActive && stage.id === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {stage.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: USER -> BANK MATCHING WORKBENCH                               */}
      {/* ==================================================================== */}
      {matchMode === 'user_to_bank' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: User Transactions Queue (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col max-h-[820px]">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    User Transactions ({openUserTxns.length})
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Showing: <strong className="text-slate-700 capitalize">{statusFilter.replace('_', ' ')}</strong> ({openUserTxns.length})
                  </span>
                </div>

                {statusFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold cursor-pointer underline"
                  >
                    View All
                  </button>
                )}
              </div>

              {/* Fast Inline Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by ID, party, description, amount..."
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-500/20"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUserSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* User Transaction Card List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {openUserTxns.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs space-y-1">
                  <p className="font-semibold text-slate-600">No transactions in this view.</p>
                  <p className="text-[11px] text-slate-400">Try picking another stage from the pipeline matrix above.</p>
                </div>
              ) : (
                openUserTxns.map(t => {
                  const isSelected = selectedTxn?.id === t.id;
                  const party = t.party_id ? partiesMap.get(t.party_id) : null;
                  const existingLinks = txnBankLinks.filter(l => l.user_txn_id === t.id);
                  const hDone = hasHarshilApproved(t.id);
                  const vDone = hasVismayApproved(t.id);
                  const fullyClosed = (hDone && vDone) || t.status === 'approved';

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
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-rose-950 font-mono tracking-tight">{t.id}</span>
                        <span className="text-[11px] text-slate-500 font-sans">
                          {formatDisplayDate(t.date_of_transaction)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900 truncate max-w-[200px]" title={party?.system_name || t.party_name_raw}>
                          {party?.system_name || t.party_name_raw}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 tabular-nums shrink-0">
                          {formatCurrencyAmount(t.amount, t.currency)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-100/90 text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Direction Pill */}
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                              t.direction === 'Payment' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {t.direction}
                          </span>

                          {/* Amount Confirmation Pill */}
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              t.amount_confirmed === 'Confirmed'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
                            }`}
                          >
                            {t.amount_confirmed}
                          </span>

                          {/* Dynamic Lifecycle & Dual Approval Badge */}
                          {fullyClosed ? (
                            <span className="px-2 py-0.5 rounded font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] tracking-wide inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Closed (Both Approved)</span>
                            </span>
                          ) : t.status === 'queried' ? (
                            <span className="px-2 py-0.5 rounded font-extrabold uppercase bg-purple-100 text-purple-900 border border-purple-300 text-[9px] tracking-wide animate-pulse inline-flex items-center gap-1">
                              <HelpCircle className="w-2.5 h-2.5 text-purple-700" />
                              <span>Query</span>
                            </span>
                          ) : t.status === 'in_approval' ? (
                            hDone && !vDone ? (
                              <span className="px-2 py-0.5 rounded font-bold bg-sky-50 text-sky-900 border border-sky-300 text-[9px] inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-sky-700" />
                                <span>Pending with Vismay</span>
                              </span>
                            ) : vDone && !hDone ? (
                              <span className="px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 text-[9px] inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-indigo-700" />
                                <span>Pending with Harshil</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-900 border border-blue-200 text-[9px] inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-blue-700" />
                                <span>In Approval</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200 text-[9px]">
                              Open
                            </span>
                          )}

                          {existingLinks.length > 0 && (
                            <span className="text-blue-700 font-semibold font-mono text-[9px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {existingLinks.length} bank link
                            </span>
                          )}
                        </div>

                        {/* Open Transaction Board Modal Trigger */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBoardTxn(t);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-semibold flex items-center space-x-1 cursor-pointer transition text-[10px] shrink-0"
                          title="Open full Transaction Board"
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

          {/* RIGHT: Detailed Reconcile & Dual Admin Workbench (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 flex flex-col justify-between">
            {selectedTxn ? (
              <>
                {/* 1. Selected Transaction Summary Card */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50/70 via-white to-slate-50 border border-rose-200/80 shadow-2xs space-y-2.5 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-rose-900 text-sm font-mono tracking-tight">{selectedTxn.id}</span>
                      <span className="text-xs text-slate-500">&bull; {formatDisplayDate(selectedTxn.date_of_transaction)}</span>
                      {selectedTxn.direction === 'Payment' ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px] uppercase">
                          Payment (Debit)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">
                          Receipt (Credit)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-mono font-bold text-slate-900 tabular-nums">
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

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-slate-500">Party:</span>{' '}
                      <strong className="text-slate-900 font-bold">
                        {partiesMap.get(selectedTxn.party_id || '')?.system_name || selectedTxn.party_name_raw}
                      </strong>
                      {selectedTxn.party_id && partiesMap.get(selectedTxn.party_id)?.group_name && (
                        <span className="text-slate-500 ml-1.5 font-normal">
                          ({partiesMap.get(selectedTxn.party_id)!.group_name})
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Account: <span className="font-semibold text-slate-800 font-mono">{selectedTxn.account_id}</span>
                    </div>
                  </div>

                  {selectedTxn.description && (
                    <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded border border-slate-100">
                      "{selectedTxn.description}"
                    </p>
                  )}
                </div>

                {/* 2. Middle Section: Candidates (if open) OR Linked Bank Lines (if reconciled/in approval) */}
                {selectedTxn.status === 'open' ? (
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Bank Statement Candidates (&plusmn; 7 Days, Confidence Ranked)</span>
                      </h3>
                      <span className="text-[10px] text-slate-500">{candidatesForUser.length} candidate(s)</span>
                    </div>

                    {candidatesForUser.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-1.5">
                        <p className="font-semibold text-slate-700">No matching bank statement lines found within &plusmn; 7 days.</p>
                        <p className="text-[11px] text-emerald-800 font-medium">
                          Bank link is optional! You can execute Layer 1 closing right now without bank lines.
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
                                ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="font-bold text-blue-900 font-mono">{c.bankTxn.id}</span>
                                <span className="text-[11px] text-slate-500">{formatDisplayDate(c.bankTxn.value_date)}</span>
                              </div>

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
                ) : (
                  /* Reconciled / In Approval / Closed: Show Linked Bank Line Details */
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                        <Landmark className="w-4 h-4 text-blue-600" />
                        <span>Supporting Bank Statement Link(s)</span>
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {selectedTxnLinkedBankEntries.length} linked entry
                      </span>
                    </div>

                    {selectedTxnLinkedBankEntries.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-800">
                          Reconciled Without Bank Statement Lines
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Closed at Layer 1 with verified_with_bank = "{selectedTxn.verified_with_bank || 'No'}". Supporting bank data was not attached.
                        </p>
                      </div>
                    ) : (
                      selectedTxnLinkedBankEntries.map(b => (
                        <div
                          key={b.id}
                          className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/80 text-xs space-y-2 hover:bg-blue-50/80 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-blue-900 font-mono">{b.id}</span>
                              <span className="text-slate-500">&bull; {formatDisplayDate(b.value_date)}</span>
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[9px] font-bold">
                                LINKED
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-slate-900 tabular-nums">
                                {formatCurrencyAmount(b.debit > 0 ? b.debit : b.credit, b.currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setBankBoardTxn(b)}
                                className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10px] font-semibold flex items-center space-x-1 cursor-pointer transition shadow-2xs"
                                title="Open Bank Statement Board"
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-blue-700" />
                                <span>Board</span>
                              </button>
                              {currentRole !== 'Staff' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Unlink bank line ${b.id} from transaction ${selectedTxn.id}?`)) {
                                      unlinkTxnBank(selectedTxn.id, b.id);
                                    }
                                  }}
                                  className="text-slate-400 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer transition"
                                  title="Unlink this bank line"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="font-mono text-[11px] text-slate-800 line-clamp-2">
                            {b.narration}
                          </p>

                          {b.reference_no && (
                            <span className="text-[10px] text-blue-700 font-mono block">
                              Ref / UTR: {b.reference_no}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Action / Execution Box */}
                {selectedTxn.status === 'open' ? (
                  /* Case A: Open Transaction -> Execute Layer 1 Closing */
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase">Execute Layer 1 Closing</h4>
                        <span className="text-[11px] text-slate-500 block">
                          {selectedBankIds.size > 0
                            ? `${selectedBankIds.size} bank line(s) selected for link (auto-confirms amount)`
                            : 'No bank lines selected. Closing with verified_with_bank = No.'}
                        </span>
                      </div>

                      {/* Verified With Bank Toggle */}
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-slate-600 font-semibold">Verified with Bank?</span>
                        <button
                          type="button"
                          onClick={() => setVerifiedToggle(prev => (prev === 'Yes' ? 'No' : 'Yes'))}
                          className={`px-3 py-1 rounded-lg font-bold text-xs border cursor-pointer ${
                            verifiedToggle === 'Yes'
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
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
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                    />

                    {isQueryInputOpen && (
                      <div className="p-3 bg-purple-50/90 border border-purple-200 rounded-lg space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                          <span>Raise Query for Staff / Admin Review</span>
                          <button
                            type="button"
                            onClick={() => setIsQueryInputOpen(false)}
                            className="text-purple-600 hover:text-purple-900 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Enter specific question or discrepancy reason..."
                          value={queryInputReason}
                          onChange={e => setQueryInputReason(e.target.value)}
                          className="w-full bg-white border border-purple-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-600"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRaiseQuery(selectedTxn.id)}
                            className="px-4 py-1.5 bg-purple-700 text-white font-bold text-xs rounded-lg hover:bg-purple-800 transition cursor-pointer shadow-xs"
                          >
                            Confirm &amp; Tag as QUERY
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsQueryInputOpen(prev => !prev)}
                        className="px-3 py-2 bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                        <span>Raise Query</span>
                      </button>

                      {currentRole === 'Staff' ? (
                        <div className="w-full sm:w-auto px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold flex items-center space-x-2">
                          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Staff View-Only: Layer 1 closing is reserved for Accountant, Manager, or Admin.</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleCloseUserTransaction}
                          className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {selectedBankIds.size > 0
                              ? `Close & Link (${selectedBankIds.size} Bank Line)`
                              : 'Close Without Bank Links (Ready for Approvals)'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : selectedTxn.status === 'in_approval' ? (
                  /* Case B: In Approval -> Dual Admin Co-Founder Sign-off */
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 border border-blue-200/80 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-blue-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                          Dual Admin Governance Sign-off
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                        Both Co-Founders Required
                      </span>
                    </div>

                    {/* Dual Cards: Harshil Zaveri & Vismay Zaveri */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Card 1: Harshil Zaveri */}
                      <div
                        className={`p-3 rounded-xl border transition ${
                          selectedTxnApprovals.harshil
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>Harshil Zaveri</span>
                          </span>
                          {selectedTxnApprovals.harshil ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Approved</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending Sign-off</span>
                            </span>
                          )}
                        </div>

                        {selectedTxnApprovals.harshil ? (
                          <div className="space-y-0.5 text-[11px] text-slate-600 pt-1 border-t border-emerald-200/60">
                            <span className="block font-medium text-slate-700">
                              Signed: {formatDisplayDateTime(selectedTxnApprovals.harshil.decided_at)}
                            </span>
                            {selectedTxnApprovals.harshil.comment && (
                              <p className="italic text-emerald-900 bg-emerald-100/40 p-1.5 rounded text-[10px]">
                                "{selectedTxnApprovals.harshil.comment}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            Awaiting Harshil's review &amp; confirmation.
                          </p>
                        )}
                      </div>

                      {/* Card 2: Vismay Zaveri */}
                      <div
                        className={`p-3 rounded-xl border transition ${
                          selectedTxnApprovals.vismay
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>Vismay Zaveri</span>
                          </span>
                          {selectedTxnApprovals.vismay ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Approved</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending Sign-off</span>
                            </span>
                          )}
                        </div>

                        {selectedTxnApprovals.vismay ? (
                          <div className="space-y-0.5 text-[11px] text-slate-600 pt-1 border-t border-emerald-200/60">
                            <span className="block font-medium text-slate-700">
                              Signed: {formatDisplayDateTime(selectedTxnApprovals.vismay.decided_at)}
                            </span>
                            {selectedTxnApprovals.vismay.comment && (
                              <p className="italic text-emerald-900 bg-emerald-100/40 p-1.5 rounded text-[10px]">
                                "{selectedTxnApprovals.vismay.comment}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            Awaiting Vismay's review &amp; confirmation.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Admin Action Bar */}
                    {currentRole === 'Admin' ? (
                      <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
                        {!myUserApprovalDone ? (
                          <>
                            <input
                              type="text"
                              placeholder={`Optional approval note from ${currentUser.full_name}...`}
                              value={adminNote}
                              onChange={e => setAdminNote(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                            />

                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setIsQueryInputOpen(prev => !prev)}
                                className="px-3 py-2 bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
                              >
                                <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                                <span>Raise Query / Move to Open</span>
                              </button>

                              <button
                                onClick={() => handleAdminApprove(selectedTxn.id)}
                                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>
                                  {userIsHarshil
                                    ? 'Approve as Harshil Zaveri'
                                    : userIsVismay
                                    ? 'Approve as Vismay Zaveri'
                                    : `Approve as Admin (${currentUser.full_name})`}
                                </span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                            <div className="flex items-center space-x-2 text-xs text-emerald-900 font-semibold">
                              <CheckCheck className="w-4 h-4 text-emerald-600" />
                              <span>You have approved this transaction. Awaiting co-founder.</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAdminUndo(selectedTxn.id)}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                              title="Undo your approval and return transaction to pending review"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Undo My Approval</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Layer 1 is closed. Awaiting final dual sign-off from Harshil Zaveri &amp; Vismay Zaveri.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsQueryInputOpen(prev => !prev)}
                          className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Raise Query
                        </button>
                      </div>
                    )}
                  </div>
                ) : isTxnClosed(selectedTxn) ? (
                  /* Case C: Closed Transaction -> Fully Approved */
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-emerald-100/30 to-emerald-50 border border-emerald-300 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                            Transaction Fully Closed (Approved by Both Co-Founders)
                          </h4>
                          <span className="text-[11px] text-emerald-800">
                            Reconciled, audit-verified, and signed by Harshil Zaveri &amp; Vismay Zaveri.
                          </span>
                        </div>
                      </div>

                      {currentRole === 'Admin' && (
                        <button
                          type="button"
                          onClick={() => handleAdminUndo(selectedTxn.id)}
                          className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                          title="Undo your approval to re-open for editing or corrections"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-600" />
                          <span>Undo Approval (Re-open)</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Case D: Queried Transaction */
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <HelpCircle className="w-5 h-5 text-purple-700 shrink-0 animate-pulse" />
                        <div>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-950">
                            Query Raised on this Transaction
                          </h4>
                          <span className="text-[11px] text-purple-800">
                            Transaction is paused for review. See query comments or clear below.
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleClearQuery(selectedTxn.id)}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Clear Query &amp; Re-Open
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-24 text-slate-400 text-xs space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No transaction selected</p>
                <p className="text-[11px] text-slate-400">Select a user transaction from the left queue to begin matching.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: BANK -> USER MATCHING WORKBENCH (FULL PARITY WITH DUAL ADMIN) */}
      {/* ==================================================================== */}
      {matchMode === 'bank_to_user' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Bank Statement Lines with Status Filter (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col max-h-[820px]">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Bank Statement Lines ({displayBankTxns.length})
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Showing: <strong className="text-slate-700 capitalize">{statusFilter.replace('_', ' ')}</strong> ({displayBankTxns.length})
                  </span>
                </div>

                {statusFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer underline"
                  >
                    View All
                  </button>
                )}
              </div>

              {/* Fast Inline Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by Bank ID, narration, UTR, amount..."
                  value={bankSearchQuery}
                  onChange={e => setBankSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                />
                {bankSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBankSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {displayBankTxns.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs space-y-1">
                  <p className="font-semibold text-slate-600">No bank lines in this view.</p>
                  <p className="text-[11px] text-slate-400">Try picking another stage from the pipeline matrix above.</p>
                </div>
              ) : (
                displayBankTxns.map(b => {
                  const isSelected = selectedBankTxn?.id === b.id;
                  const bAmount = b.debit > 0 ? b.debit : b.credit;
                  const isDebit = b.debit > 0;
                  const bInfo = getBankTxnLifecycle(b);

                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBankTxnId(b.id);
                        setSelectedCandidateUserIds(new Set());
                      }}
                      className={`p-4 cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-50/90 border-l-4 border-emerald-600 shadow-inner'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-emerald-950 font-mono tracking-tight">{b.id}</span>
                        <span className="text-[11px] text-slate-500 font-sans">
                          {formatDisplayDate(b.value_date)}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-900 truncate mb-1" title={b.narration}>
                        {b.narration}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80 text-[10px]">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                            isDebit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isDebit ? 'Payment (Debit)' : 'Receipt (Credit)'}
                          </span>

                          {/* Dynamic Lifecycle & Dual Approval Badge for Bank Entry */}
                          {bInfo.isClosed ? (
                            <span className="px-2 py-0.5 rounded font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] tracking-wide inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Closed (Both Approved)</span>
                            </span>
                          ) : bInfo.status === 'queried' ? (
                            <span className="px-2 py-0.5 rounded font-extrabold uppercase bg-purple-100 text-purple-900 border border-purple-300 text-[9px] tracking-wide animate-pulse inline-flex items-center gap-1">
                              <HelpCircle className="w-2.5 h-2.5 text-purple-700" />
                              <span>Query</span>
                            </span>
                          ) : bInfo.status === 'in_approval' ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-900 border border-blue-200 text-[9px] inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-blue-700" />
                              <span>In Approval</span>
                            </span>
                          ) : bInfo.status === 'pending_harshil' ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 text-[9px] inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-indigo-700" />
                              <span>Pending with Harshil</span>
                            </span>
                          ) : bInfo.status === 'pending_vismay' ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-sky-50 text-sky-900 border border-sky-300 text-[9px] inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-sky-700" />
                              <span>Pending with Vismay</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-600 text-[9px]">
                              Unlinked
                            </span>
                          )}

                          {bInfo.primaryTxn && (
                            <span className="text-rose-700 font-semibold font-mono text-[9px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                              {bInfo.primaryTxn.id}
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
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-semibold flex items-center space-x-1 cursor-pointer transition text-[10px]"
                            title="Open Bank Statement Board"
                          >
                            <Landmark className="w-3 h-3 text-emerald-700" />
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

          {/* RIGHT: Candidate User Transactions & Dual Admin Workbench (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 flex flex-col justify-between">
            {selectedBankTxn ? (
              <>
                {/* 1. Selected Bank Entry Summary Header */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 border border-emerald-200/80 shadow-2xs space-y-2.5 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-emerald-900 text-sm font-mono tracking-tight">{selectedBankTxn.id}</span>
                      <span className="text-xs text-slate-500">&bull; {formatDisplayDate(selectedBankTxn.value_date)}</span>
                      {selectedBankTxn.debit > 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px] uppercase">
                          Debit (Out)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">
                          Credit (In)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyAmount(
                          selectedBankTxn.debit > 0 ? selectedBankTxn.debit : selectedBankTxn.credit,
                          selectedBankTxn.currency
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBankBoardTxn(selectedBankTxn)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
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

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="text-slate-500 text-[11px]">
                      Account: <span className="font-semibold text-slate-800 font-mono">{selectedBankTxn.account_id}</span>
                    </div>
                    {selectedBankTxn.reference_no && (
                      <div className="text-[11px] text-blue-700 font-mono">
                        Ref / UTR: {selectedBankTxn.reference_no}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Middle Section: Candidates (if unlinked) OR Linked User Txn Details */}
                {selectedBankLifecycle?.primaryTxn ? (
                  <div className="space-y-4 flex-1">
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold">Reconciled &amp; Linked with User Transaction</span>
                      </div>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                        LINKED ENTRY
                      </span>
                    </div>

                    {/* Linked User Transaction Card */}
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-rose-900 font-mono">{selectedBankLifecycle.primaryTxn.id}</span>
                          <span className="text-slate-500">&bull; {formatDisplayDate(selectedBankLifecycle.primaryTxn.date_of_transaction)}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            selectedBankLifecycle.primaryTxn.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            selectedBankLifecycle.primaryTxn.status === 'in_approval' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {selectedBankLifecycle.primaryTxn.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                            {formatCurrencyAmount(selectedBankLifecycle.primaryTxn.amount, selectedBankLifecycle.primaryTxn.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBoardTxn(selectedBankLifecycle.primaryTxn!)}
                            className="px-2.5 py-1 rounded bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-semibold border border-slate-200 flex items-center space-x-1 cursor-pointer transition text-xs shadow-2xs"
                            title="Open User Transaction Board"
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-700" />
                            <span>Board</span>
                          </button>
                          {currentRole !== 'Staff' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Unlink bank line ${selectedBankTxn.id} from transaction ${selectedBankLifecycle.primaryTxn!.id}?`)) {
                                  unlinkTxnBank(selectedBankLifecycle.primaryTxn!.id, selectedBankTxn.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer transition"
                              title="Unlink this transaction"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs">
                        <span className="text-slate-500">Party:</span>{' '}
                        <strong className="text-slate-900 font-bold">
                          {partiesMap.get(selectedBankLifecycle.primaryTxn.party_id || '')?.system_name || selectedBankLifecycle.primaryTxn.party_name_raw}
                        </strong>
                      </div>

                      {selectedBankLifecycle.primaryTxn.description && (
                        <p className="text-[11px] text-slate-600 italic">
                          "{selectedBankLifecycle.primaryTxn.description}"
                        </p>
                      )}
                    </div>

                    {/* DUAL ADMIN SIGN-OFF PANEL (IDENTICAL TO USER->BANK WORKBENCH) */}
                    {selectedBankLifecycle.status === 'in_approval' || selectedBankLifecycle.status === 'pending_harshil' || selectedBankLifecycle.status === 'pending_vismay' ? (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 border border-blue-200/80 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4 text-blue-700" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                              Dual Admin Governance Sign-off
                            </h4>
                          </div>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                            Both Co-Founders Required
                          </span>
                        </div>

                        {/* Dual Cards: Harshil & Vismay */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Card 1: Harshil */}
                          <div
                            className={`p-3 rounded-xl border transition ${
                              selectedBankTxnApprovals.harshil
                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-xs flex items-center space-x-1.5">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>Harshil Zaveri</span>
                              </span>
                              {selectedBankTxnApprovals.harshil ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center space-x-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Approved</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending Sign-off</span>
                                </span>
                              )}
                            </div>

                            {selectedBankTxnApprovals.harshil ? (
                              <div className="space-y-0.5 text-[11px] text-slate-600 pt-1 border-t border-emerald-200/60">
                                <span className="block font-medium text-slate-700">
                                  Signed: {formatDisplayDateTime(selectedBankTxnApprovals.harshil.decided_at)}
                                </span>
                                {selectedBankTxnApprovals.harshil.comment && (
                                  <p className="italic text-emerald-900 bg-emerald-100/40 p-1.5 rounded text-[10px]">
                                    "{selectedBankTxnApprovals.harshil.comment}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                Awaiting Harshil's review &amp; confirmation.
                              </p>
                            )}
                          </div>

                          {/* Card 2: Vismay */}
                          <div
                            className={`p-3 rounded-xl border transition ${
                              selectedBankTxnApprovals.vismay
                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-xs flex items-center space-x-1.5">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>Vismay Zaveri</span>
                              </span>
                              {selectedBankTxnApprovals.vismay ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center space-x-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Approved</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending Sign-off</span>
                                </span>
                              )}
                            </div>

                            {selectedBankTxnApprovals.vismay ? (
                              <div className="space-y-0.5 text-[11px] text-slate-600 pt-1 border-t border-emerald-200/60">
                                <span className="block font-medium text-slate-700">
                                  Signed: {formatDisplayDateTime(selectedBankTxnApprovals.vismay.decided_at)}
                                </span>
                                {selectedBankTxnApprovals.vismay.comment && (
                                  <p className="italic text-emerald-900 bg-emerald-100/40 p-1.5 rounded text-[10px]">
                                    "{selectedBankTxnApprovals.vismay.comment}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                Awaiting Vismay's review &amp; confirmation.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Admin Action Bar */}
                        {currentRole === 'Admin' ? (
                          <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
                            {!myBankApprovalDone ? (
                              <>
                                <input
                                  type="text"
                                  placeholder={`Optional approval note from ${currentUser.full_name}...`}
                                  value={adminNote}
                                  onChange={e => setAdminNote(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                                />

                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsQueryInputOpen(prev => !prev)}
                                    className="px-3 py-2 bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
                                  >
                                    <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                                    <span>Raise Query / Move to Open</span>
                                  </button>

                                  <button
                                    onClick={() => handleAdminApprove(selectedBankLifecycle.primaryTxn!.id)}
                                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>
                                      {userIsHarshil
                                        ? 'Approve as Harshil Zaveri'
                                        : userIsVismay
                                        ? 'Approve as Vismay Zaveri'
                                        : `Approve as Admin (${currentUser.full_name})`}
                                    </span>
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                                <div className="flex items-center space-x-2 text-xs text-emerald-900 font-semibold">
                                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                                  <span>You have approved this transaction. Awaiting co-founder.</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAdminUndo(selectedBankLifecycle.primaryTxn!.id)}
                                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                                  title="Undo your approval and return transaction to pending review"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Undo My Approval</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>Layer 1 is closed. Awaiting final dual sign-off from Harshil Zaveri &amp; Vismay Zaveri.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsQueryInputOpen(prev => !prev)}
                              className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-semibold text-[11px] cursor-pointer"
                            >
                              Raise Query
                            </button>
                          </div>
                        )}
                      </div>
                    ) : selectedBankLifecycle.isClosed ? (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-emerald-100/30 to-emerald-50 border border-emerald-300 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                              <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                                Transaction Fully Closed (Approved by Both Co-Founders)
                              </h4>
                              <span className="text-[11px] text-emerald-800">
                                Reconciled, audit-verified, and signed by Harshil Zaveri &amp; Vismay Zaveri.
                              </span>
                            </div>
                          </div>

                          {currentRole === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => handleAdminUndo(selectedBankLifecycle.primaryTxn!.id)}
                              className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                              title="Undo your approval to re-open for editing or corrections"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-600" />
                              <span>Undo Approval (Re-open)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : selectedBankLifecycle.status === 'queried' ? (
                      <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <HelpCircle className="w-5 h-5 text-purple-700 shrink-0 animate-pulse" />
                            <div>
                              <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-950">
                                Query Raised on this Transaction
                              </h4>
                              <span className="text-[11px] text-purple-800">
                                Transaction is paused for review. See query comments or clear below.
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleClearQuery(selectedBankLifecycle.primaryTxn!.id)}
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                          >
                            Clear Query &amp; Re-Open
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {/* Unlinked: Candidate User Transactions List */}
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center space-x-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span>Matching User Transactions (&plusmn; 7 Days, Confidence Ranked)</span>
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
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
                            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
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
              <div className="text-center py-24 text-slate-400 text-xs space-y-2">
                <Landmark className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No bank line selected</p>
                <p className="text-[11px] text-slate-400">Select a bank statement entry from the left queue to begin matching.</p>
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
