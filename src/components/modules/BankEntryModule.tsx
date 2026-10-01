import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { resolvePartyFromNarration, normalizeAlias } from '../../lib/alias';
import { getDaysDifference } from '../../lib/matching';
import { formatDisplayDate, formatCurrencyAmount } from '../../lib/formatters';
import {
  Landmark,
  AlertCircle,
  CheckCircle2,
  Building2,
  CreditCard,
  RefreshCw,
  Trash2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  Filter,
  Upload,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { UniversalImportModal } from './UniversalImportModal';
import { BankTransactionBoardModal } from './BankTransactionBoardModal';
import { SearchablePartySelect } from '../common/SearchablePartySelect';
import { BankTransaction } from '../../types/database';

export const BankEntryModule: React.FC = () => {
  const {
    allowedCompanies,
    companies,
    accounts,
    scopedAccounts,
    parties,
    partyAliases,
    bankTransactions,
    scopedBankTransactions,
    addBankTransaction,
    deleteBankTransactionsBatch,
    activeCompanyId,
  } = useApp();

  // --------------------------------------------------------------------------
  // CASCADING COMPANY & ACCOUNT SELECTION
  // --------------------------------------------------------------------------
  const initialCompany = activeCompanyId !== 'ALL'
    ? activeCompanyId
    : (allowedCompanies[0]?.id || 'COM1');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompany);

  useEffect(() => {
    if (activeCompanyId !== 'ALL') {
      setSelectedCompanyId(activeCompanyId);
    } else if (allowedCompanies.length > 0 && !allowedCompanies.some(c => c.id === selectedCompanyId)) {
      setSelectedCompanyId(allowedCompanies[0].id);
    }
  }, [activeCompanyId, allowedCompanies, selectedCompanyId]);

  const companyAccounts = useMemo(() => {
    return scopedAccounts.filter(a => a.company_id === selectedCompanyId);
  }, [scopedAccounts, selectedCompanyId]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    companyAccounts[0]?.id || scopedAccounts[0]?.id || ''
  );

  useEffect(() => {
    if (companyAccounts.length > 0) {
      if (!companyAccounts.some(a => a.id === selectedAccountId)) {
        setSelectedAccountId(companyAccounts[0].id);
      }
    } else {
      setSelectedAccountId('');
    }
  }, [companyAccounts, selectedAccountId]);

  const activeAccount = accounts.find(a => a.id === selectedAccountId);
  const currency = activeAccount?.account_currency || 'INR';

  // --------------------------------------------------------------------------
  // FORM STATE
  // --------------------------------------------------------------------------
  const [valueDate, setValueDate] = useState(new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState<'Payment' | 'Receipt'>('Payment');
  const [amount, setAmount] = useState<string>('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [balanceAfter, setBalanceAfter] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedBankTxnForBoard, setSelectedBankTxnForBoard] = useState<BankTransaction | null>(null);
  const [isEntryPanelOpen, setIsEntryPanelOpen] = useState(false);

  // --------------------------------------------------------------------------
  // LIVE PARTY NARRATION AUTO-DETECTION
  // --------------------------------------------------------------------------
  const resolvedPartyInfo = useMemo(() => {
    if (!narration.trim()) return null;
    return resolvePartyFromNarration(narration, parties, partyAliases);
  }, [narration, parties, partyAliases]);

  // --------------------------------------------------------------------------
  // LIVE DUPLICATE SCANNER (±7 Days Window, Same Account, Same Direction & Amount)
  // --------------------------------------------------------------------------
  const liveDuplicates = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!valueDate || isNaN(numAmount) || numAmount <= 0 || !selectedAccountId) return [];

    return scopedBankTransactions.filter(b => {
      if (b.account_id !== selectedAccountId) return false;

      // Check Direction
      const isPayment = b.debit > 0 && b.credit === 0;
      const isReceipt = b.credit > 0 && b.debit === 0;
      if (direction === 'Payment' && !isPayment) return false;
      if (direction === 'Receipt' && !isReceipt) return false;

      // ±7 Days window
      const daysDiff = getDaysDifference(valueDate, b.value_date);
      if (daysDiff > 7) return false;

      // Amount matching (within 5 tolerance)
      const bAmount = direction === 'Payment' ? b.debit : b.credit;
      const amountMatches = Math.abs(bAmount - numAmount) <= 5;

      return amountMatches;
    });
  }, [scopedBankTransactions, selectedAccountId, direction, valueDate, amount]);

  // --------------------------------------------------------------------------
  // FORM SUBMISSION
  // --------------------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;

    if (!selectedAccountId) {
      setFeedback('Error: Please select a bank account.');
      return;
    }
    if (!narration.trim()) {
      setFeedback('Error: Statement narration printed by bank is required.');
      return;
    }
    if (numAmount <= 0) {
      setFeedback('Error: Please enter a valid transaction amount.');
      return;
    }

    const debit = direction === 'Payment' ? numAmount : 0;
    const credit = direction === 'Receipt' ? numAmount : 0;

    const newTxn = addBankTransaction({
      account_id: selectedAccountId,
      party_id: resolvedPartyInfo?.party?.id,
      value_date: valueDate,
      narration: narration.trim(),
      description: description.trim() || undefined,
      reference_no: referenceNo.trim() || undefined,
      debit,
      credit,
      currency,
      balance_after: balanceAfter ? parseFloat(balanceAfter) : undefined,
      source: 'manual',
    });

    setFeedback(`Success: Bank statement line ${newTxn.id} saved as supporting data.`);
    setNarration('');
    setDescription('');
    setReferenceNo('');
    setAmount('');
    setBalanceAfter('');
    setTimeout(() => setFeedback(null), 4000);
  };

  // --------------------------------------------------------------------------
  // TABLE FILTERS & SEARCH
  // --------------------------------------------------------------------------
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPartyId, setFilterPartyId] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'Payment' | 'Receipt'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<string>>(new Set());

  const resetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterPartyId('ALL');
    setFilterDirection('ALL');
    setSearchQuery('');
  };

  const filteredTransactions = useMemo(() => {
    return scopedBankTransactions.filter(b => {
      // Date filters
      if (filterStartDate && b.value_date < filterStartDate) return false;
      if (filterEndDate && b.value_date > filterEndDate) return false;

      // Direction filter
      if (filterDirection === 'Payment' && !(b.debit > 0)) return false;
      if (filterDirection === 'Receipt' && !(b.credit > 0)) return false;

      // Party filter
      if (filterPartyId && filterPartyId !== 'ALL') {
        if (b.party_id !== filterPartyId) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inId = b.id.toLowerCase().includes(q);
        const inNarration = b.narration.toLowerCase().includes(q);
        const inRef = b.reference_no?.toLowerCase().includes(q);
        const inDesc = b.description?.toLowerCase().includes(q);
        const party = b.party_id ? parties.find(p => p.id === b.party_id) : undefined;
        const inParty = Boolean(
          (party?.system_name && party.system_name.toLowerCase().includes(q)) ||
          (party?.id && party.id.toLowerCase().includes(q))
        );
        if (!inId && !inNarration && !inRef && !inDesc && !inParty) return false;
      }

      return true;
    });
  }, [scopedBankTransactions, filterStartDate, filterEndDate, filterDirection, filterPartyId, searchQuery, parties]);

  const handleToggleSelectAll = () => {
    if (selectedTxnIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxnIds(new Set());
    } else {
      setSelectedTxnIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedTxnIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedTxnIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedTxnIds.size} selected bank transactions?`)) {
      deleteBankTransactionsBatch(Array.from(selectedTxnIds));
      setFeedback(`Successfully deleted ${selectedTxnIds.size} bank transactions.`);
      setSelectedTxnIds(new Set());
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
            <Landmark className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Bank Statement Transactions</h1>
            <p className="text-xs text-slate-500">
              Supporting Data only &bull; Printed bank lines kept verbatim without altering raw narration &bull; Auto-detects parties
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsEntryPanelOpen(prev => !prev)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
            title={isEntryPanelOpen ? "Collapse entry form to view statement lines" : "Expand entry form to record statement line"}
          >
            {isEntryPanelOpen ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Collapse Entry Form &amp; Scanner</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-blue-700" />
                <span className="text-blue-900">Record Statement Line</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            title="Bulk import bank statement lines from CSV, Google Sheets, or PDF"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Import (CSV / Sheets / PDF)</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold ${
            feedback.startsWith('Error') ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {feedback}
        </div>
      )}

      {/* Collapsed State Quick Action Banner */}
      {!isEntryPanelOpen && (
        <div className="p-3.5 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center space-x-2.5 text-blue-950">
            <Landmark className="w-4 h-4 text-blue-700 shrink-0" />
            <div>
              <span className="font-bold">Record Bank Statement Form &amp; Duplicate Scanner are Collapsed</span>
              <p className="text-[11px] text-slate-500">Full screen allocated to statement lines table below.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEntryPanelOpen(true)}
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg transition text-xs shadow-xs cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open Entry Form</span>
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TOP: MAIN ENTRY FORM (7 COLS) + LIVE DUPLICATE SCANNER (5 COLS)      */}
      {/* ==================================================================== */}
      {isEntryPanelOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b pb-2 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <CreditCard className="w-4 h-4 text-blue-700" />
              <span>Add Statement Line</span>
            </span>
            <span className="text-[11px] font-normal text-slate-500">Manual Entry</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cascading Company */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Operating Entity / Company</span>
              </label>
              <select
                value={selectedCompanyId}
                onChange={e => setSelectedCompanyId(e.target.value)}
                disabled={activeCompanyId !== 'ALL'}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 cursor-pointer"
              >
                {allowedCompanies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.id} &bull; {c.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cascading Bank Account */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Bank Account</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                disabled={companyAccounts.length === 0}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 cursor-pointer"
              >
                {companyAccounts.length === 0 ? (
                  <option value="">No accounts available for selected company</option>
                ) : (
                  companyAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.id} &bull; {acc.bank_name} ({acc.account_currency}) &bull; {acc.account_number}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Direction Toggle: Payment (Debit) vs Receipt (Credit) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Transaction Direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('Payment')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                    direction === 'Payment'
                      ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                  <span>Payment (Debit)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('Receipt')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                    direction === 'Receipt'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  <span>Receipt (Credit)</span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Amount ({currency}) <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 font-mono">
                  {currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-12 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Bank statement amounts are always confirmed by default.
              </span>
            </div>

            {/* Value Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                <span>Value Date <span className="text-rose-600">*</span></span>
                {valueDate && (
                  <span className="text-[10px] font-mono font-medium text-blue-600">
                    {formatDisplayDate(valueDate)}
                  </span>
                )}
              </label>
              <input
                type="date"
                required
                value={valueDate}
                onChange={e => setValueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Printed Narration & Auto-Detect Party */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Printed Narration <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder="Exact statement line printed by the bank"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Kept verbatim forever (never aliased).
              </span>

              {/* Live Party Resolution Feedback */}
              {resolvedPartyInfo?.party ? (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Auto-matched Party:</span>{' '}
                    <span className="font-semibold">{resolvedPartyInfo.party.system_name}</span>{' '}
                    <span className="text-emerald-600 font-mono text-[10px]">({resolvedPartyInfo.party.id})</span>{' '}
                    <span className="text-[10px] text-emerald-600">
                      via {resolvedPartyInfo.matchedBy === 'system_name' ? 'System Name' : 'Learned Alias'}
                    </span>
                  </div>
                </div>
              ) : narration.trim().length >= 3 ? (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2 text-xs text-amber-800">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="text-[11px]">
                    <span className="font-bold">New Narration detected:</span> will auto-register as an unmapped alias to learn for future transactions.
                  </div>
                </div>
              ) : null}
            </div>

            {/* Internal Note (Description) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Internal Note (Description)
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Our internal note (typed separately)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Reference / UTR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Reference / UTR / Cheque #
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                placeholder="UTR or Cheque number"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Balance After */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Balance After (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={balanceAfter}
                onChange={e => setBalanceAfter(e.target.value)}
                placeholder="Running balance printed on statement"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Save Bank Statement Entry</span>
            </button>
          </form>
        </div>

        {/* RIGHT: Live Duplicate Scanner Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white text-slate-900 p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-blue-700" />
              <span>Live Duplicate Scanner (&plusmn; 7 Days)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Real-Time Safeguard</span>
          </div>

          <p className="text-xs text-slate-500">
            As you type, this panel surfaces bank statement lines already recorded within 1 week of the selected value date to prevent duplicate statement records before saving.
          </p>

          {liveDuplicates.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2 opacity-90" />
              <span>No potential duplicate statement lines found for this date &amp; amount.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {liveDuplicates.map(d => {
                const daysDiff = getDaysDifference(valueDate, d.value_date);
                const dAmount = direction === 'Payment' ? d.debit : d.credit;
                const numAmount = parseFloat(amount) || 0;
                const amountMatches = Math.abs(dAmount - numAmount) <= 5;

                return (
                  <div
                    key={d.id}
                    className={`p-3 rounded-xl border text-xs transition ${
                      amountMatches
                        ? 'bg-rose-50 border-rose-300 shadow-sm'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-blue-900 font-mono">{d.id}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatDisplayDate(d.value_date)} ({daysDiff}d apart)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={d.narration}>
                        {d.narration}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyAmount(dAmount, d.currency)}
                      </span>
                    </div>

                    {d.reference_no && (
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                        Ref/UTR: {d.reference_no}
                      </p>
                    )}

                    {d.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 italic line-clamp-1">
                        "{d.description}"
                      </p>
                    )}

                    {amountMatches && (
                      <div className="mt-2 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-lg flex items-center space-x-1 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-700 shrink-0" />
                        <span>Warning: Same amount &amp; close date! Verify before saving.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ==================================================================== */}
      {/* BOTTOM: STATEMENT LINES RECORDS TABLE (FULL WIDTH 12 COLS)           */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col space-y-4">
          {/* Table Header and Interactive Filter Bar */}
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>Supporting Bank Statement Lines</span>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border">
                    {filteredTransactions.length} of {scopedBankTransactions.length} entries
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Verbatim bank statement feed with instant search and multi-column filtering.
                </p>
              </div>

              {/* Text Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search narration, UTR, ref, ID..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Comprehensive Filter Bar (Matching User Transactions Module) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs">
              {/* Start Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              {/* Party Filter (Searchable Combobox) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Matched Party
                </label>
                <SearchablePartySelect
                  parties={parties}
                  selectedPartyId={filterPartyId}
                  onSelect={setFilterPartyId}
                  allLabel="All Parties"
                  placeholder="Search party by name or ID..."
                />
              </div>

              {/* Direction Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Direction
                </label>
                <select
                  value={filterDirection}
                  onChange={e => setFilterDirection(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 cursor-pointer"
                >
                  <option value="ALL">All Statement Lines</option>
                  <option value="Payment">Debits Only (Payments -)</option>
                  <option value="Receipt">Credits Only (Receipts +)</option>
                </select>
              </div>

              {/* Reset Filters */}
              <div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedTxnIds.size > 0 && (
            <div className="bg-rose-50 border-b border-rose-200 p-2.5 px-4 flex items-center justify-between text-xs animate-in fade-in">
              <span className="font-bold text-rose-950">
                {selectedTxnIds.size} statement line{selectedTxnIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedTxnIds(new Set())}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200/60 rounded font-medium cursor-pointer"
                >
                  Deselect All
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
              </div>
            </div>
          )}

          {/* Table Data with Isolated Scroll Container & Sticky Header */}
          <div className={`overflow-x-auto ${isEntryPanelOpen ? 'max-h-[460px]' : 'max-h-[calc(100vh-275px)] min-h-[380px]'} overflow-y-auto overscroll-contain border-t border-slate-200 flex-1`}>
            <table className="w-full text-left text-xs relative">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedTxnIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded text-blue-700 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">ID</th>
                  <th className="p-3">Value Date</th>
                  <th className="p-3">Narration & Notes</th>
                  <th className="p-3">Matched Party</th>
                  <th className="p-3 text-right">Debit (-)</th>
                  <th className="p-3 text-right">Credit (+)</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                      No bank statement entries found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(b => {
                    const party = b.party_id ? parties.find(p => p.id === b.party_id) : undefined;
                    const isSelected = selectedTxnIds.has(b.id);
                    return (
                      <tr key={b.id} className={`hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50/70' : ''}`}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(b.id)}
                            className="rounded text-blue-700 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-bold text-blue-900">
                          <button
                            type="button"
                            onClick={() => setSelectedBankTxnForBoard(b)}
                            className="hover:underline text-blue-900 font-bold cursor-pointer"
                            title="Open Board"
                          >
                            {b.id}
                          </button>
                        </td>
                        <td className="p-3 text-slate-600 font-sans whitespace-nowrap">
                          {formatDisplayDate(b.value_date)}
                        </td>
                        <td className="p-3 max-w-[200px] text-slate-800 font-sans" title={b.narration}>
                          <div className="truncate font-medium">{b.narration}</div>
                          {b.description && (
                            <div className="text-[10px] text-slate-400 truncate">{b.description}</div>
                          )}
                          {b.reference_no && (
                            <div className="text-[10px] text-blue-600 font-mono truncate">Ref: {b.reference_no}</div>
                          )}
                        </td>
                        <td className="p-3 font-sans">
                          {party ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {party.system_name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unmapped</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-rose-700 tabular-nums">
                          {b.debit > 0 ? `-${b.debit.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3 text-right text-emerald-700 tabular-nums">
                          {b.credit > 0 ? `+${b.credit.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                          {b.balance_after ? b.balance_after.toFixed(2) : '—'}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedBankTxnForBoard(b)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 cursor-pointer transition shadow-2xs"
                            title="Open Bank Statement Board & Version History"
                          >
                            <ExternalLink className="w-3 h-3 text-blue-600" />
                            <span>Board</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Universal Bulk Ingestion Modal (CSV, Google Sheets, PDF) */}
      {showImportModal && (
        <UniversalImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          mode="bank"
          selectedAccountId={selectedAccountId}
          onSuccess={(count) => {
            setFeedback(`Successfully imported ${count} bank statement transactions.`);
            setTimeout(() => setFeedback(null), 5000);
          }}
        />
      )}

      {/* Bank Transaction Board Modal (Real-time Audit & Admin Restore) */}
      {selectedBankTxnForBoard && (
        <BankTransactionBoardModal
          bankTransaction={selectedBankTxnForBoard}
          onClose={() => setSelectedBankTxnForBoard(null)}
        />
      )}
    </div>
  );
};
