import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, PartyDescriptionTemplate } from '../../types/database';
import { normalizeAlias } from '../../lib/alias';
import { getDaysDifference } from '../../lib/matching';
import {
  ArrowDownLeft,
  Upload,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Plus,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  Layers,
} from 'lucide-react';
import { TransactionBoardModal } from './TransactionBoardModal';

export const UserEntryModule: React.FC = () => {
  const {
    accounts,
    parties,
    partiesMap,
    partyTemplates,
    addPartyTemplate,
    incrementTemplateUsage,
    scopedAccounts,
    scopedUserTransactions,
    addUserTransaction,
    activeCompanyId,
    currentUser,
    liveForexRates,
  } = useApp();

  // Form State using Scoped Accounts
  const [selectedAccountId, setSelectedAccountId] = useState(scopedAccounts[0]?.id || '');
  const [partyInput, setPartyInput] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  const [dateOfTxn, setDateOfTxn] = useState(new Date().toISOString().slice(0, 10));

  // Sync selectedAccountId when scopedAccounts changes
  React.useEffect(() => {
    if (scopedAccounts.length > 0 && !scopedAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(scopedAccounts[0].id);
    }
  }, [scopedAccounts, selectedAccountId]);
  const [amount, setAmount] = useState<string>('');
  const [amountConfirmed, setAmountConfirmed] = useState<'Confirmed' | 'Unconfirmed'>('Confirmed');
  const [direction, setDirection] = useState<'Payment' | 'Receipt'>('Payment');
  const [description, setDescription] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Selected Account Currency
  const activeAccount = accounts.find(a => a.id === selectedAccountId);
  const currency = activeAccount?.account_currency || 'INR';

  // Automatically fetch & pre-fill live forex rate when selecting foreign currency
  React.useEffect(() => {
    if (currency !== 'INR') {
      const liveRate = liveForexRates?.ratesToInr?.[currency];
      if (liveRate) {
        setExchangeRate(String(liveRate));
      }
    } else {
      setExchangeRate('');
    }
  }, [currency, liveForexRates]);

  // Selected Transaction for Board Modal
  const [selectedBoardTxn, setSelectedBoardTxn] = useState<UserTransaction | null>(null);

  // CSV Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);

  // Calculated INR amount if exchange rate provided
  const amountInInr = useMemo(() => {
    const numAmount = parseFloat(amount);
    const numRate = parseFloat(exchangeRate);
    if (!isNaN(numAmount) && !isNaN(numRate) && numRate > 0) {
      return Number((numAmount * numRate).toFixed(2));
    }
    return undefined;
  }, [amount, exchangeRate]);

  // Available Templates for selected party
  const availableTemplates = useMemo(() => {
    if (!selectedPartyId) return [];
    return partyTemplates
      .filter(t => t.party_id === selectedPartyId)
      .sort((a, b) => b.use_count - a.use_count);
  }, [selectedPartyId, partyTemplates]);


  // Party Auto-Suggestions
  const partySuggestions = useMemo(() => {
    if (!partyInput.trim()) return [];
    const q = partyInput.toLowerCase();
    return parties.filter(p =>
      (p.system_name && p.system_name.toLowerCase().includes(q)) ||
      p.party_name.toLowerCase().includes(q) ||
      (p.cid_number && p.cid_number.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [partyInput, parties]);

  // LIVE DUPLICATE-CHECK PANEL (Look at window of 1 WEEK ± 7 days)
  const liveDuplicates = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!dateOfTxn) return [];

    return scopedUserTransactions.filter(t => {
      // Must be same account and direction
      if (t.account_id !== selectedAccountId || t.direction !== direction) return false;

      // ± 7 days window
      const daysDiff = getDaysDifference(dateOfTxn, t.date_of_transaction);
      if (daysDiff > 7) return false;

      // If party is specified, prioritize same party or group
      if (partyInput.trim()) {
        const inputNorm = normalizeAlias(partyInput);
        const txnNorm = normalizeAlias(t.party_name_raw);
        const sameParty = inputNorm === txnNorm || (selectedPartyId && selectedPartyId === t.party_id);
        if (sameParty) return true;
      }

      // Or if amount is close (within ± 5)
      if (!isNaN(numAmount) && Math.abs(t.amount - numAmount) <= 5) return true;

      return false;
    });
  }, [scopedUserTransactions, selectedAccountId, direction, dateOfTxn, partyInput, selectedPartyId, amount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (!selectedAccountId) {
      setFormFeedback('Error: Please choose a valid bank account.');
      return;
    }
    if (!partyInput.trim()) {
      setFormFeedback('Error: Party name is required.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormFeedback('Error: Amount must be greater than 0.');
      return;
    }

    // Save as template if checked
    if (saveAsTemplate && selectedPartyId && description.trim()) {
      addPartyTemplate(selectedPartyId, description.trim(), 'manual');
    }

    const newTxn = addUserTransaction({
      account_id: selectedAccountId,
      party_id: selectedPartyId,
      party_name_raw: partyInput.trim(),
      description: description.trim() || undefined,
      date_of_transaction: dateOfTxn,
      currency,
      amount: numAmount,
      amount_confirmed: amountConfirmed,
      amount_in_inr: amountInInr,
      exchange_rate: exchangeRate ? parseFloat(exchangeRate) : undefined,
      direction,
      verified_with_bank: 'No', // Rule 4: Bank side is supporting; default No
      source: 'manual',
    });

    setFormFeedback(`Success: Transaction ${newTxn.id} recorded successfully!`);
    setAmount('');
    setDescription('');
    setSaveAsTemplate(false);
    setTimeout(() => setFormFeedback(null), 4000);
  };

  // CSV Mock Importer
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    // Mock parsing sample CSV lines
    const mockParsed = [
      { party_name: 'Bangkok Gems & Stones Co.', date: '2026-09-12', amount: 35000, direction: 'Payment', confirmed: 'Confirmed', valid: true },
      { party_name: 'Blue Ocean Trading LLC', date: '2026-09-12', amount: 82000, direction: 'Payment', confirmed: 'Unconfirmed', valid: true },
      { party_name: 'Raw Gem Importer', date: '2026-09-13', amount: 0, direction: 'Payment', confirmed: 'Unconfirmed', valid: false, error: 'Amount cannot be 0' },
    ];
    setCsvPreviewRows(mockParsed);
  };

  const executeCsvImport = () => {
    let importedCount = 0;
    csvPreviewRows.forEach(row => {
      if (row.valid) {
        addUserTransaction({
          account_id: selectedAccountId,
          party_name_raw: row.party_name,
          date_of_transaction: row.date,
          currency,
          amount: row.amount,
          amount_confirmed: row.confirmed,
          direction: row.direction,
          verified_with_bank: 'No',
          source: 'csv',
        });
        importedCount++;
      }
    });

    setShowCsvModal(false);
    setCsvPreviewRows([]);
    setCsvFile(null);
    setFormFeedback(`Successfully imported ${importedCount} transactions from CSV.`);
    setTimeout(() => setFormFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
              <ArrowDownLeft className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold font-serif text-slate-900">User Transactions — Entry</h1>
              <p className="text-xs text-slate-500">
                The Source of Truth for StarRuby.in &bull; Records what WE paid or received (works with zero bank data)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Upload Batch CSV</span>
          </button>
        </div>
      </div>

      {formFeedback ? (
        <div className={`p-3 rounded-lg text-xs font-semibold ${
          formFeedback.startsWith('Error') ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        }`}>
          {formFeedback}
        </div>
      ) : null}

      {/* Main Grid: Left Form + Right Live Duplicate Check Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: The Entry Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-900 border-b pb-2">
            Record Bank Transaction
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Account Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Bank Account <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-600"
              >
                {scopedAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.id} &bull; {acc.bank_name} ({acc.account_number}) — {acc.account_currency}
                  </option>
                ))}
              </select>
            </div>

            {/* Party / Payer Field with autocomplete */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Party / Payer Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={partyInput}
                onChange={e => {
                  setPartyInput(e.target.value);
                  // Check exact party match
                  const match = parties.find(p => p.system_name?.toLowerCase() === e.target.value.toLowerCase());
                  setSelectedPartyId(match?.id);
                }}
                placeholder="Type party name (saved verbatim; clean system name snaps automatically)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              />

              {/* Suggestions Dropdown */}
              {partySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  <div className="p-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                    Known Parties
                  </div>
                  {partySuggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPartyInput(p.system_name || p.party_name);
                        setSelectedPartyId(p.id);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800">{p.system_name || p.party_name}</span>
                      {p.cid_number && <span className="text-[10px] bg-purple-100 text-purple-800 px-1 rounded font-mono">{p.cid_number}</span>}
                    </button>
                  ))}
                </div>
              )}

              {selectedPartyId && (
                <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                  &check; Mapped to Party: {partiesMap.get(selectedPartyId)?.system_name}
                </span>
              )}
            </div>

            {/* Date & Amount Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Transaction Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={dateOfTxn}
                  onChange={e => setDateOfTxn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Amount ({currency}) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono font-bold tabular-nums focus:outline-none focus:border-rose-600"
                />
              </div>
            </div>

            {/* Description & Templates */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Description / Purpose
                </label>
                {availableTemplates.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-normal">
                    {availableTemplates.length} saved templates available
                  </span>
                )}
              </div>

              {availableTemplates.length > 0 && (
                <div className="mb-2">
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        setDescription(e.target.value);
                        const tpl = availableTemplates.find(t => t.template_text === e.target.value);
                        if (tpl) incrementTemplateUsage(tpl.id);
                      }
                    }}
                    className="w-full bg-rose-50/60 border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-rose-900 focus:outline-none"
                  >
                    <option value="">-- Quick Pick Saved Template --</option>
                    {availableTemplates.map(t => (
                      <option key={t.id} value={t.template_text}>
                        {t.template_text} (Used {t.use_count}x)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What was this transaction for? (or type fresh line)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              />

              {selectedPartyId && description.trim() && (
                <label className="flex items-center space-x-2 mt-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Save as reusable template for this party</span>
                </label>
              )}
            </div>

            {/* Amount Confirmed & Direction Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Amount Confirmation <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountConfirmed('Confirmed')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      amountConfirmed === 'Confirmed'
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountConfirmed('Unconfirmed')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      amountConfirmed === 'Unconfirmed'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Unconfirmed
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Direction <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('Payment')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      direction === 'Payment'
                        ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Payment (Out)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('Receipt')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      direction === 'Receipt'
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Receipt (In)
                  </button>
                </div>
              </div>
            </div>

            {/* Real-Time Currency Conversion (Foreign Accounts) */}
            {currency !== 'INR' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 block">INR Valuation (Live Multi-Currency)</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-800 font-mono font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Market: 1 {currency} = ₹{liveForexRates?.ratesToInr?.[currency] || 26.02}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-slate-600 text-[11px] block">Exchange Rate to INR</span>
                      <button
                        type="button"
                        onClick={() => {
                          const rate = liveForexRates?.ratesToInr?.[currency];
                          if (rate) setExchangeRate(String(rate));
                        }}
                        className="text-[10px] text-rose-700 hover:underline cursor-pointer"
                      >
                        Reset to Live
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.0001"
                      value={exchangeRate}
                      onChange={e => setExchangeRate(e.target.value)}
                      placeholder="Auto-synced from market"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-slate-600 text-[11px] block">Estimated INR Amount</span>
                    <span className="font-bold font-mono text-emerald-800 text-sm mt-1 block tabular-nums">
                      {amountInInr ? `₹ ${amountInInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Save User Transaction (Source of Truth)
            </button>
          </form>
        </div>

        {/* RIGHT: Live Duplicate-Check Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white text-slate-900 p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-rose-700" />
              <span>Live Duplicate Scanner (± 7 Days)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Real-Time Check</span>
          </div>

          <p className="text-xs text-slate-500">
            As you type, this panel surfaces transactions already recorded within 1 week of the selected date so duplicate payments are prevented before saving.
          </p>

          {liveDuplicates.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2 opacity-90" />
              <span>No potential duplicate entries found for this date & party.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {liveDuplicates.map(d => {
                const daysDiff = getDaysDifference(dateOfTxn, d.date_of_transaction);
                const amountMatches = amount && Math.abs(d.amount - parseFloat(amount)) <= 5;

                return (
                  <div
                    key={d.id}
                    className={`p-3 rounded-xl border text-xs transition ${
                      amountMatches
                        ? 'bg-rose-50 border-rose-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-rose-800">{d.id}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {d.date_of_transaction} ({daysDiff}d apart)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                        {d.party_name_raw}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {d.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {d.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                        "{d.description}"
                      </p>
                    )}

                    {amountMatches && (
                      <div className="mt-2 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-lg flex items-center space-x-1 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-700" />
                        <span>Warning: Same amount & close date! Verify before saving.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Transaction History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recently Recorded User Transactions</h3>
            <span className="text-xs text-slate-500">Click any row to open the complete Transaction Board</span>
          </div>
          <span className="text-xs font-semibold text-slate-600">Total: {scopedUserTransactions.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b">
              <tr>
                <th className="p-3">Txn ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Account</th>
                <th className="p-3">Party Name</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Amount Confirmed</th>
                <th className="p-3 text-center">Verified with Bank</th>
                <th className="p-3 text-center">Workflow Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopedUserTransactions.map(txn => {
                const acc = accounts.find(a => a.id === txn.account_id);
                return (
                  <tr
                    key={txn.id}
                    onClick={() => setSelectedBoardTxn(txn)}
                    className="hover:bg-rose-50/50 cursor-pointer transition"
                  >
                    <td className="p-3 font-bold text-rose-900">{txn.id}</td>
                    <td className="p-3 text-slate-600">{txn.date_of_transaction}</td>
                    <td className="p-3 text-slate-800 font-medium">
                      {acc?.bank_name} ({acc?.account_currency})
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      {txn.party_name_raw}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      <div>{txn.currency} {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      {txn.currency !== 'INR' && txn.amount_in_inr ? (
                        <div className="text-[10px] text-slate-500 font-normal">
                          (~₹{txn.amount_in_inr.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        txn.amount_confirmed === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {txn.amount_confirmed}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        txn.verified_with_bank === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {txn.verified_with_bank}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        txn.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        txn.status === 'in_approval' ? 'bg-amber-100 text-amber-800' :
                        txn.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {txn.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-rose-700 hover:underline font-semibold text-[11px] flex items-center justify-end space-x-1">
                        <span>Board</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <h3 className="text-base font-bold font-serif text-slate-900">Upload Transactions CSV</h3>
            <p className="text-xs text-slate-500">
              Import multiple entries at once. Column names: party_name, date, amount, direction, amount_confirmed (Confirmed/Unconfirmed).
            </p>

            <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50">
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="text-xs text-slate-700" />
            </div>

            {csvPreviewRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden text-xs max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2">Party</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((r, idx) => (
                      <tr key={idx} className={r.valid ? 'bg-emerald-50/50' : 'bg-rose-50/50'}>
                        <td className="p-2">{r.party_name}</td>
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{r.amount}</td>
                        <td className="p-2">{r.valid ? <span className="text-emerald-700 font-bold">Valid</span> : <span className="text-rose-700 font-bold">{r.error}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button onClick={() => setShowCsvModal(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={executeCsvImport}
                disabled={csvPreviewRows.filter(r => r.valid).length === 0}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                Import {csvPreviewRows.filter(r => r.valid).length} Valid Entries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Board Modal */}
      {selectedBoardTxn && (
        <TransactionBoardModal
          transaction={selectedBoardTxn}
          onClose={() => setSelectedBoardTxn(null)}
        />
      )}

    </div>
  );
};
