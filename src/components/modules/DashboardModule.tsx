import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  ShieldCheck,
  Tag,
  Copy,
  Clock,
  CheckCheck,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  Building,
  Scale,
  GitMerge,
  UserCheck,
  ExternalLink,
  Globe,
  BookOpen,
} from 'lucide-react';
import { NavTab } from '../layout/Sidebar';
import { formatDisplayDate, formatCurrencyAmount } from '../../lib/formatters';

interface DashboardModuleProps {
  onNavigate: (tab: NavTab) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    partyAliases,
    scopedStatementUploads,
    scopedAccounts,
    currentUser,
    currentRole,
    activeCompanyId,
    liveForexRates,
    refreshForexRates,
    hasHarshilApproved,
    hasVismayApproved,
    isHarshilUser,
    isVismayUser,
    partiesMap,
  } = useApp();

  const [isRefreshingForex, setIsRefreshingForex] = useState(false);

  const handleRefreshForex = async () => {
    setIsRefreshingForex(true);
    try {
      await refreshForexRates();
    } finally {
      setTimeout(() => setIsRefreshingForex(false), 600);
    }
  };

  const isCurrentUserHarshil = isHarshilUser(currentUser.id);
  const isCurrentUserVismay = isVismayUser(currentUser.id);

  // Live forex rates
  const currentAedRate = liveForexRates?.ratesToInr?.AED || 26.02;
  const currentUsdRate = liveForexRates?.ratesToInr?.USD || 95.50;

  // --------------------------------------------------------------------------
  // 1. LIFECYCLE GOVERNANCE PIPELINE COUNTS
  // --------------------------------------------------------------------------
  const pipelineMetrics = useMemo(() => {
    let open = 0;
    let queried = 0;
    let inApproval = 0;
    let pendingHarshil = 0;
    let pendingVismay = 0;
    let closed = 0;

    scopedUserTransactions.forEach(t => {
      const hDone = hasHarshilApproved(t.id);
      const vDone = hasVismayApproved(t.id);
      const bothDone = (hDone && vDone) || t.status === 'approved';

      if (t.status === 'open') open++;
      if (t.status === 'queried') queried++;
      if (bothDone) {
        closed++;
      } else if (t.status === 'in_approval') {
        inApproval++;
        if (vDone && !hDone) pendingHarshil++;
        if (hDone && !vDone) pendingVismay++;
      }
    });

    return {
      open,
      queried,
      inApproval,
      pendingHarshil,
      pendingVismay,
      closed,
      total: scopedUserTransactions.length,
    };
  }, [scopedUserTransactions, hasHarshilApproved, hasVismayApproved]);

  // Personalized count for logged-in admin
  const myPendingActionCount = useMemo(() => {
    if (isCurrentUserHarshil) {
      return scopedUserTransactions.filter(t => t.status === 'in_approval' && !hasHarshilApproved(t.id)).length;
    }
    if (isCurrentUserVismay) {
      return scopedUserTransactions.filter(t => t.status === 'in_approval' && !hasVismayApproved(t.id)).length;
    }
    return pipelineMetrics.inApproval;
  }, [isCurrentUserHarshil, isCurrentUserVismay, scopedUserTransactions, hasHarshilApproved, hasVismayApproved, pipelineMetrics.inApproval]);

  // --------------------------------------------------------------------------
  // 2. MULTI-ENTITY TURNOVER & VOLUME CALCULATIONS
  // --------------------------------------------------------------------------
  const domesticAccounts = scopedAccounts.filter(a => a.company_id === 'COM1');
  const dubaiAccounts = scopedAccounts.filter(a => a.company_id === 'COM2');

  const domesticTxns = scopedUserTransactions.filter(t => domesticAccounts.some(a => a.id === t.account_id));
  const dubaiTxns = scopedUserTransactions.filter(t => dubaiAccounts.some(a => a.id === t.account_id));

  const domesticInrVolume = domesticTxns.reduce((acc, t) => acc + (t.amount || 0), 0);

  const dubaiAedVolume = dubaiTxns
    .filter(t => t.currency === 'AED')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const dubaiUsdVolume = dubaiTxns
    .filter(t => t.currency === 'USD')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const dubaiEstimatedInr = (dubaiAedVolume * currentAedRate) + (dubaiUsdVolume * currentUsdRate);

  // Consolidated Group Turnover in INR
  const consolidatedInrVolume = useMemo(() => {
    return scopedUserTransactions
      .filter(t => t.status !== 'rejected')
      .reduce((acc, t) => {
        if ((t.currency || 'INR') === 'INR') {
          return acc + (t.amount || 0);
        }
        if (t.amount_in_inr) {
          return acc + t.amount_in_inr;
        }
        if (t.exchange_rate) {
          return acc + (t.amount * t.exchange_rate);
        }
        if (t.currency === 'AED') return acc + (t.amount * currentAedRate);
        if (t.currency === 'USD') return acc + (t.amount * currentUsdRate);
        const genericRate = liveForexRates?.ratesToInr?.[t.currency];
        if (genericRate) return acc + (t.amount * genericRate);
        return acc + (t.amount || 0);
      }, 0);
  }, [scopedUserTransactions, currentAedRate, currentUsdRate, liveForexRates]);

  // --------------------------------------------------------------------------
  // 3. RECONCILIATION VARIANCE SUMMARY ACROSS ALL ACCOUNTS
  // --------------------------------------------------------------------------
  const reconciliationSummary = useMemo(() => {
    let balancedCount = 0;
    let discrepancyCount = 0;
    let totalVarianceInr = 0;

    scopedAccounts.forEach(acc => {
      const bankEntries = scopedBankTransactions
        .filter(b => b.account_id === acc.id)
        .sort((a, b) => new Date(a.value_date).getTime() - new Date(b.value_date).getTime());

      const userEntries = scopedUserTransactions
        .filter(u => u.account_id === acc.id && u.status !== 'open' && u.status !== 'queried')
        .sort((a, b) => new Date(a.date_of_transaction).getTime() - new Date(b.date_of_transaction).getTime());

      let stmtBal = 0;
      if (bankEntries.length > 0) {
        const last = bankEntries[bankEntries.length - 1];
        stmtBal = last.balance_after !== undefined && last.balance_after !== null
          ? last.balance_after
          : bankEntries.reduce((accu, b) => accu + (b.credit || 0) - (b.debit || 0), 0);
      }

      let bookBal = 0;
      userEntries.forEach(u => {
        const credit = u.direction === 'Receipt' ? u.amount : 0;
        const debit = u.direction === 'Payment' ? u.amount : 0;
        bookBal = bookBal + credit - debit;
      });

      const diff = Math.abs(stmtBal - bookBal);
      if (diff < 0.01) {
        balancedCount++;
      } else {
        discrepancyCount++;
        const fxRate = acc.account_currency === 'AED' ? currentAedRate : acc.account_currency === 'USD' ? currentUsdRate : 1;
        totalVarianceInr += diff * fxRate;
      }
    });

    return {
      balancedCount,
      discrepancyCount,
      totalAccounts: scopedAccounts.length,
      hasDiscrepancy: discrepancyCount > 0,
      totalVarianceInr,
    };
  }, [scopedAccounts, scopedBankTransactions, scopedUserTransactions, currentAedRate, currentUsdRate]);

  // Statement uploads compliance
  const totalUploadCells = scopedStatementUploads.length;
  const uploadedCells = scopedStatementUploads.filter(s => s.status === 'uploaded').length;
  const statementCompliancePct = totalUploadCells > 0 ? Math.round((uploadedCells / totalUploadCells) * 100) : 0;

  // Other action flags
  const unmappedAliasesCount = partyAliases.filter(a => a.status === 'unmapped').length;
  const unconfirmedCount = scopedUserTransactions.filter(t => t.amount_confirmed === 'Unconfirmed').length;

  // --------------------------------------------------------------------------
  // 4. RECENT TRANSACTIONS ACTIVITY FEED (LATEST 5)
  // --------------------------------------------------------------------------
  const recentTransactions = useMemo(() => {
    return [...scopedUserTransactions]
      .sort((a, b) => new Date(b.date_of_transaction).getTime() - new Date(a.date_of_transaction).getTime() || b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [scopedUserTransactions]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. EXECUTIVE WELCOME BANNER                                           */}
      {/* ==================================================================== */}
      <div className="bg-gradient-to-r from-rose-50/80 via-white to-amber-50/50 rounded-2xl p-6 text-slate-900 shadow-2xs border border-rose-100/90 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-rose-100/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-3">
          {/* User Role Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
              StarRuby.in Treasury Governance
            </span>
            <span className="text-xs text-slate-600 font-medium flex items-center space-x-1">
              <span>Logged in as</span>
              <strong className="text-slate-900 font-semibold">{currentUser.full_name}</strong>
              <span className="text-slate-400">&bull;</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                {isCurrentUserHarshil
                  ? 'Co-Founder & Group Admin (Harshil)'
                  : isCurrentUserVismay
                  ? 'Co-Founder & Group Admin (Vismay)'
                  : `${currentRole}`}
              </span>
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold font-serif tracking-tight text-slate-900">
              Multi-Company Banking &amp; Reconciliation Portal
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Enterprise Multi-Entity Treasury Management &bull; Dual Co-Founder Governance (Harshil &amp; Vismay)
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('user_entry')}
              className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Record User Transaction</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('match')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition flex items-center space-x-2 cursor-pointer"
            >
              <GitMerge className="w-4 h-4 text-blue-600" />
              <span>Match &amp; Reconcile</span>
              {pipelineMetrics.inApproval > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-mono">
                  {pipelineMetrics.inApproval}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('statement_ledger')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition flex items-center space-x-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Statement Running Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. TOP 4 EXECUTIVE KPI CARDS                                         */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Group Turnover Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Consolidated Book Turnover
            </span>
            <span className="p-1 bg-rose-50 text-rose-600 rounded">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
            ₹{consolidatedInrVolume.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>{scopedUserTransactions.length} Total Txns</span>
            <span className="font-semibold text-slate-700">Multi-Entity</span>
          </div>
        </div>

        {/* KPI 2: Co-Founder Governance Sign-off */}
        <div
          onClick={() => onNavigate('match')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-amber-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Co-Founder Governance
            </span>
            <span className="p-1 bg-amber-50 text-amber-600 rounded">
              <CheckCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums tracking-tight flex items-baseline space-x-2">
            <span>{pipelineMetrics.inApproval}</span>
            <span className="text-xs text-slate-500 font-sans font-normal">Awaiting Sign-off</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            {isCurrentUserHarshil ? (
              <span className="text-amber-800 font-semibold group-hover:underline">
                Pending Your Sign-off: {myPendingActionCount}
              </span>
            ) : isCurrentUserVismay ? (
              <span className="text-amber-800 font-semibold group-hover:underline">
                Pending Your Sign-off: {myPendingActionCount}
              </span>
            ) : (
              <span className="text-slate-600">
                Harshil: {pipelineMetrics.pendingHarshil} &bull; Vismay: {pipelineMetrics.pendingVismay}
              </span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700 transition" />
          </div>
        </div>

        {/* KPI 3: Reconciliation Variance Across Accounts */}
        <div
          onClick={() => onNavigate('statement_ledger')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-emerald-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Reconciliation Health
            </span>
            <span className={`p-1 rounded ${reconciliationSummary.hasDiscrepancy ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {reconciliationSummary.hasDiscrepancy ? (
                <Scale className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums tracking-tight flex items-baseline space-x-2">
            {reconciliationSummary.hasDiscrepancy ? (
              <span className="text-amber-700">Variance</span>
            ) : (
              <span className="text-emerald-700">100% Balanced</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="truncate">
              {reconciliationSummary.balancedCount} of {reconciliationSummary.totalAccounts} Accounts Balanced
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition" />
          </div>
        </div>

        {/* KPI 4: Monthly Statement Grid Compliance */}
        <div
          onClick={() => onNavigate('statement_uploads')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-blue-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Statement Archival (R2)
            </span>
            <span className="p-1 bg-blue-50 text-blue-600 rounded">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums tracking-tight">
            {statementCompliancePct}%
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>{uploadedCells} of {totalUploadCells} Statements Uploaded</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-700 transition" />
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. LIFECYCLE GOVERNANCE PIPELINE WIDGET                              */}
      {/* ==================================================================== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitMerge className="w-4 h-4 text-rose-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Reconciliation &amp; Governance Pipeline
            </h2>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              &bull; Click any stage to open Match &amp; Reconcile
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('match')}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center space-x-1 cursor-pointer"
          >
            <span>Open Workbench</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5-Stage Visual Workflow Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Stage 1: Open Queue */}
          <div
            onClick={() => onNavigate('match')}
            className="p-3 bg-rose-50/60 hover:bg-rose-50 rounded-xl border border-rose-200/90 transition cursor-pointer flex flex-col justify-between space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-950">Open Queue</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-rose-900">{pipelineMetrics.open}</span>
              <span className="text-[10px] text-rose-600 font-medium">Pending Match</span>
            </div>
          </div>

          {/* Stage 2: In Approval */}
          <div
            onClick={() => onNavigate('match')}
            className="p-3 bg-blue-50/60 hover:bg-blue-50 rounded-xl border border-blue-200/90 transition cursor-pointer flex flex-col justify-between space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-950">In Approval</span>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-blue-900">{pipelineMetrics.inApproval}</span>
              <span className="text-[10px] text-blue-600 font-medium">Layer 1 Done</span>
            </div>
          </div>

          {/* Stage 3: With Harshil */}
          <div
            onClick={() => onNavigate('match')}
            className="p-3 bg-indigo-50/60 hover:bg-indigo-50 rounded-xl border border-indigo-200/90 transition cursor-pointer flex flex-col justify-between space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-950">With Harshil</span>
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-indigo-900">{pipelineMetrics.pendingHarshil}</span>
              <span className="text-[10px] text-indigo-600 font-medium">USR1 Sign-off</span>
            </div>
          </div>

          {/* Stage 4: With Vismay */}
          <div
            onClick={() => onNavigate('match')}
            className="p-3 bg-sky-50/60 hover:bg-sky-50 rounded-xl border border-sky-200/90 transition cursor-pointer flex flex-col justify-between space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-950">With Vismay</span>
              <Clock className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-sky-900">{pipelineMetrics.pendingVismay}</span>
              <span className="text-[10px] text-sky-600 font-medium">USR2 Sign-off</span>
            </div>
          </div>

          {/* Stage 5: Closed */}
          <div
            onClick={() => onNavigate('match')}
            className="p-3 bg-emerald-50/60 hover:bg-emerald-50 rounded-xl border border-emerald-200/90 transition cursor-pointer flex flex-col justify-between space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-950">Closed (Settled)</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-emerald-900">{pipelineMetrics.closed}</span>
              <span className="text-[10px] text-emerald-600 font-medium">Both Signed</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. TREASURY & MULTI-CURRENCY LIQUIDITY PORTFOLIO                      */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
              <Landmark className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold font-serif text-slate-900">
                Treasury &amp; Multi-Currency Liquidity Portfolio
              </h2>
              <p className="text-[11px] text-slate-500">
                Cross-entity balances across Domestic INR and Dubai International Accounts
              </p>
            </div>
          </div>

          {/* Live FX Rates Heartbeat */}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live FX: 1 AED = ₹{currentAedRate} &bull; 1 USD = ₹{currentUsdRate}</span>
            </span>
            <button
              type="button"
              onClick={handleRefreshForex}
              disabled={isRefreshingForex}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer disabled:opacity-60"
              title="Refresh live market forex rates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingForex ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3 Entity Liquidity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: India Entity (INR) */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                Domestic Books (INR)
              </span>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded">
                StarRuby.in Pvt Ltd
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              ₹{domesticInrVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200/60">
              <span className="truncate">Accounts: ICICI (BNK1) + Kotak (BNK2)</span>
              <span className="font-semibold text-slate-700 shrink-0 ml-1">{domesticTxns.length} txns</span>
            </div>
          </div>

          {/* Card 2: Dubai Entity (AED & USD) */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Dubai DMCC Books (AED &amp; USD)
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded">
                Star Ruby Gems DMCC
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                AED {dubaiAedVolume.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-bold font-mono text-blue-700 tabular-nums">
                + USD {dubaiUsdVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200/60">
              <span>Live Market Valuation:</span>
              <span className="font-bold text-slate-800 font-mono">
                ~₹{dubaiEstimatedInr.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Card 3: Total Group Consolidated Liquidity */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50/70 to-amber-50/50 border border-rose-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Total Group Valuation (INR)
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                Consolidated
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
              ₹{consolidatedInrVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-600 flex justify-between pt-1 border-t border-rose-200/50">
              <span>Combined Multi-Entity Liquidity</span>
              <span className="font-semibold text-emerald-700">{scopedUserTransactions.length} Total Txns</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. RECENT ACTIVITY FEED & OPERATIONAL ACTION RADAR                   */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Recent Treasury Activity Feed (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200/90 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-rose-700" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recent Treasury Activity
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('statement_ledger')}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center space-x-1 cursor-pointer"
            >
              <span>View Full Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recent transactions recorded.
              </div>
            ) : (
              recentTransactions.map(txn => {
                const partyName = txn.party_id
                  ? partiesMap.get(txn.party_id)?.system_name || txn.party_name_raw
                  : txn.party_name_raw;

                const hDone = hasHarshilApproved(txn.id);
                const vDone = hasVismayApproved(txn.id);
                const isClosed = (hDone && vDone) || txn.status === 'approved';

                return (
                  <div
                    key={txn.id}
                    onClick={() => onNavigate('match')}
                    className="p-3.5 hover:bg-slate-50/80 transition flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        txn.direction === 'Payment' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {txn.direction === 'Payment' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]" title={partyName}>
                            {partyName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                            {txn.id}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <span>{formatDisplayDate(txn.date_of_transaction)}</span>
                          {txn.description && (
                            <>
                              <span>&bull;</span>
                              <span className="truncate max-w-[180px]">{txn.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`font-mono font-bold text-xs ${
                        txn.direction === 'Payment' ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {txn.direction === 'Payment' ? '-' : '+'}
                        {formatCurrencyAmount(txn.amount, txn.currency)}
                      </div>

                      <div className="mt-0.5">
                        {isClosed ? (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Both Approved</span>
                          </span>
                        ) : hDone && !vDone ? (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                            <span>With Vismay</span>
                          </span>
                        ) : vDone && !hDone ? (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                            <span>With Harshil</span>
                          </span>
                        ) : txn.status === 'in_approval' ? (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            <span>In Approval</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                            <span>Open</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Operational Action Radar (5 Cols) */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Action Card 1: Co-Founder Pending Sign-off */}
          <div
            onClick={() => onNavigate('match')}
            className="p-4 bg-gradient-to-r from-amber-50/80 to-white rounded-2xl border border-amber-200 shadow-2xs hover:border-amber-300 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-xs font-bold flex items-center space-x-1.5">
                <CheckCheck className="w-4 h-4 text-amber-700" />
                <span>Governance Sign-off Queue</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-mono font-bold text-[10px]">
                {pipelineMetrics.inApproval}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {isCurrentUserHarshil && myPendingActionCount > 0
                ? `You have ${myPendingActionCount} transaction${myPendingActionCount > 1 ? 's' : ''} awaiting your sign-off as Harshil Zaveri.`
                : isCurrentUserVismay && myPendingActionCount > 0
                ? `You have ${myPendingActionCount} transaction${myPendingActionCount > 1 ? 's' : ''} awaiting your sign-off as Vismay Zaveri.`
                : 'All transactions currently pending dual co-founder approvals.'}
            </p>
            <span className="text-[11px] text-amber-800 font-bold group-hover:underline flex items-center space-x-1 pt-0.5">
              <span>Open Match Workbench</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          {/* Action Card 2: Attention List (Unconfirmed Amounts) */}
          <div
            onClick={() => onNavigate('match')}
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-rose-300 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between text-rose-900">
              <span className="text-xs font-bold flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Unconfirmed Amounts List</span>
              </span>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-mono font-bold text-[10px]">
                {unconfirmedCount}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              User transactions flagged as Unconfirmed awaiting proof or statement confirmation.
            </p>
            <span className="text-[11px] text-rose-700 font-bold group-hover:underline flex items-center space-x-1 pt-0.5">
              <span>Resolve in Match &amp; Reconcile</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          {/* Action Card 3: Party Aliases Triage */}
          <div
            onClick={() => onNavigate('aliases')}
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-purple-300 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between text-purple-900">
              <span className="text-xs font-bold flex items-center space-x-1.5">
                <Tag className="w-4 h-4 text-purple-600" />
                <span>Party Aliases Triage</span>
              </span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-mono font-bold text-[10px]">
                {unmappedAliasesCount}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Bank statement narrations with raw party names awaiting mapping to system parties.
            </p>
            <span className="text-[11px] text-purple-700 font-bold group-hover:underline flex items-center space-x-1 pt-0.5">
              <span>Open Aliases Queue</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          {/* Action Card 4: Duplicates Scanner */}
          <div
            onClick={() => onNavigate('duplicates')}
            className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between text-slate-800">
              <span className="text-xs font-bold flex items-center space-x-1.5">
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Duplicates Scanner</span>
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-semibold">
                ±7 Days Auto
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Automated multi-currency duplicate detection across same accounts and amounts.
            </p>
            <span className="text-[11px] text-slate-700 font-bold group-hover:underline flex items-center space-x-1 pt-0.5">
              <span>Open Duplicates Triage</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
