import React, { useState } from 'react';
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
  CalendarCheck,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { NavTab } from '../layout/Sidebar';

export const DashboardModule: React.FC<{ onNavigate: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    partyAliases,
    scopedStatementUploads,
    pendingTransactions,
    companies,
    currentUser,
    currentRole,
    activeCompanyId,
    liveForexRates,
    refreshForexRates,
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

  const inrTransactions = scopedUserTransactions.filter(t => (t.currency || 'INR') === 'INR');
  const aedTransactions = scopedUserTransactions.filter(t => t.currency === 'AED');
  const usdTransactions = scopedUserTransactions.filter(t => t.currency === 'USD');

  const inrVolume = inrTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const aedVolume = aedTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const usdVolume = usdTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  const currentAedRate = liveForexRates?.ratesToInr?.AED || 26.02;
  const currentUsdRate = liveForexRates?.ratesToInr?.USD || 95.50;

  // Accurate Consolidated Group Turnover in INR using dynamic live market rates
  const consolidatedInrVolume = scopedUserTransactions.reduce((acc, t) => {
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
    return acc + (t.amount || 0);
  }, 0);

  const unmappedAliasesCount = partyAliases.filter(a => a.status === 'unmapped').length;
  const inApprovalCount = scopedUserTransactions.filter(t => t.status === 'in_approval').length;
  const unconfirmedCount = scopedUserTransactions.filter(t => t.amount_confirmed === 'Unconfirmed').length;

  const totalUploadCells = scopedStatementUploads.length;
  const uploadedCells = scopedStatementUploads.filter(s => s.status === 'uploaded').length;
  const statementCompliancePct = totalUploadCells > 0 ? Math.round((uploadedCells / totalUploadCells) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner with StarRuby.in Branding */}
      <div className="bg-gradient-to-r from-rose-50/70 via-white to-amber-50/40 rounded-2xl p-6 text-slate-900 shadow-xs border border-rose-100/90 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-rose-100/30 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
              StarRuby.in Treasury Governance
            </span>
            <span className="text-xs text-slate-500">Logged in as {currentUser.full_name} ({currentRole})</span>
          </div>

          <h1 className="text-2xl font-bold font-serif tracking-wide text-slate-900">
            Multi-Company Banking & Reconciliation Portal
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            Immutable transaction source of truth &bull; 3-Layer Admin approvals &bull; Cloudflare R2 object storage &bull; Zero bank dependency workflow.
          </p>

          <div className="flex flex-wrap gap-2 pt-3">
            <button
              onClick={() => onNavigate('user_entry')}
              className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Record User Transaction</span>
            </button>

            <button
              onClick={() => onNavigate('match')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
            >
              <span>Match & Reconcile (L1)</span>
            </button>

            <button
              onClick={() => onNavigate('approvals')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
            >
              <span>3-Layer Approvals ({inApprovalCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: User Txns Volume (Multi-Currency Aware) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">User Txns (Truth)</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {scopedUserTransactions.length}
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            {activeCompanyId === 'COM1' ? (
              <span className="font-semibold text-slate-800">
                Vol: ₹{inrVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            ) : activeCompanyId === 'COM2' ? (
              <div>
                <span className="font-semibold text-slate-800 block">
                  Vol: AED {aedVolume.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">
                  (~₹{consolidatedInrVolume.toLocaleString('en-IN', { minimumFractionDigits: 0 })} @ 22.85)
                </span>
              </div>
            ) : (
              <div>
                <span className="font-semibold text-slate-800 block">
                  Consolidated: ₹{consolidatedInrVolume.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  ₹{inrVolume.toLocaleString('en-IN')} + AED {aedVolume.toLocaleString('en-AE')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Approvals Queue</span>
            <CheckCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {inApprovalCount}
          </div>
          <span className="text-[11px] text-slate-500 block">
            Awaiting Admin Layer 2 or 3
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unmapped Aliases</span>
            <Tag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 font-mono tabular-nums">
            {unmappedAliasesCount}
          </div>
          <span className="text-[11px] text-slate-500 block">
            Waiting in Party Triage
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Statement Uploads</span>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {statementCompliancePct}%
          </div>
          <span className="text-[11px] text-slate-500 block">
            {uploadedCells} of {totalUploadCells} monthly statements in R2
          </span>
        </div>

      </div>

      {/* Treasury & Multi-Currency Liquidity Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-rose-700" />
            <h2 className="text-base font-bold font-serif text-slate-900">
              Treasury & Multi-Currency Liquidity Portfolio
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live FX: 1 AED = ₹{currentAedRate} &bull; 1 USD = ₹{currentUsdRate}
            </span>
            <button
              onClick={handleRefreshForex}
              disabled={isRefreshingForex}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
              title="Refresh live market rates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingForex ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Box 1: India Entity (INR) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                Domestic Books (INR)
              </span>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded">
                StarRuby.in Pvt Ltd
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              ₹{inrVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200/60">
              <span>Accounts: ICICI (BNK1) + Kotak (BNK2)</span>
              <span className="font-semibold text-slate-700">{inrTransactions.length} txns</span>
            </div>
          </div>

          {/* Box 2: Dubai Entity (AED & USD) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Dubai DMCC Books (AED)
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded">
                Star Ruby Gems DMCC
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              AED {aedVolume.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200/60">
              <span>Live Market Valuation:</span>
              <span className="font-bold text-slate-800 font-mono">
                ~₹{(aedVolume * currentAedRate).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Box 3: Total Consolidated Valuation */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50/80 to-amber-50/50 border border-rose-200/90 space-y-2">
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

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Box 1: Duplicates */}
        <div
          onClick={() => onNavigate('duplicates')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 cursor-pointer transition space-y-2"
        >
          <div className="flex items-center space-x-2 text-amber-800">
            <Copy className="w-4 h-4" />
            <h3 className="font-bold text-sm">Duplicates Scanner</h3>
          </div>
          <p className="text-xs text-slate-500">
            Automated scanning for duplicate payments within ± 3 days and ± 5 amount tolerance.
          </p>
          <span className="text-xs text-amber-700 font-semibold hover:underline block pt-2">
            Open Duplicates Triage &rarr;
          </span>
        </div>

        {/* Box 2: Pending Discrepancies */}
        <div
          onClick={() => onNavigate('discrepancies')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-rose-300 cursor-pointer transition space-y-2"
        >
          <div className="flex items-center space-x-2 text-rose-800">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="font-bold text-sm">Attention List ({unconfirmedCount})</h3>
          </div>
          <p className="text-xs text-slate-500">
            Unconfirmed transaction amounts and items proceeding without bank verification.
          </p>
          <span className="text-xs text-rose-700 font-semibold hover:underline block pt-2">
            Resolve Discrepancies &rarr;
          </span>
        </div>

        {/* Box 3: Monthly Matrix */}
        <div
          onClick={() => onNavigate('statement_uploads')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 cursor-pointer transition space-y-2"
        >
          <div className="flex items-center space-x-2 text-emerald-800">
            <CalendarCheck className="w-4 h-4" />
            <h3 className="font-bold text-sm">Monthly Statement Tracker</h3>
          </div>
          <p className="text-xs text-slate-500">
            Check accounts matrix for missing monthly bank statements (Red cells) and upload to R2.
          </p>
          <span className="text-xs text-emerald-700 font-semibold hover:underline block pt-2">
            View Statement Matrix &rarr;
          </span>
        </div>

      </div>

    </div>
  );
};
