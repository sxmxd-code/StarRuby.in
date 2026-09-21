import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, Plus, Check, X, Sparkles, Building2, CheckCircle2 } from 'lucide-react';

export const PendingQueueModule: React.FC = () => {
  const {
    scopedPendingTransactions,
    addPendingTransaction,
    mapAndClosePending,
    cancelPendingTransaction,
    scopedUserTransactions,
    scopedAccounts,
    accounts,
    partiesMap,
    activeCompanyId,
  } = useApp();

  const [showAddForm, setShowAddForm] = useState(false);
  const [accountId, setAccountId] = useState(scopedAccounts[0]?.id || '');
  const [partyInput, setPartyInput] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'Payment' | 'Receipt'>('Payment');
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sync accountId when scopedAccounts change
  React.useEffect(() => {
    if (scopedAccounts.length > 0 && !scopedAccounts.some(a => a.id === accountId)) {
      setAccountId(scopedAccounts[0].id);
    }
  }, [scopedAccounts, accountId]);

  const activeAccount = accounts.find(a => a.id === accountId);
  const currency = activeAccount?.account_currency || 'INR';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!accountId || isNaN(num) || num <= 0) {
      alert('Please fill valid account and amount.');
      return;
    }

    addPendingTransaction({
      account_id: accountId,
      party_name_raw: partyInput.trim() || undefined,
      amount: num,
      currency,
      direction,
      expected_date: expectedDate,
      description: description.trim() || undefined,
    });

    setShowAddForm(false);
    setAmount('');
    setDescription('');
    setPartyInput('');
    setFeedback('Expected pending transaction added to money calendar queue.');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-amber-50 text-amber-700 rounded-lg">
            <Clock className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Pending Queue (Money Calendar)</h1>
            <p className="text-xs text-slate-500">
              Anticipated transactions (rent, salary, expected receipts) &bull; Auto-suggests candidate when matching user entry arrives
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expected Item</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-rose-200 shadow-md space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900 border-b pb-2">
            Schedule Anticipated Transaction
          </h2>

          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Account</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full bg-slate-50 border rounded-lg p-2"
              >
                {scopedAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.id} &bull; {acc.bank_name} ({acc.account_currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Party / Vendor</label>
              <input
                type="text"
                value={partyInput}
                onChange={e => setPartyInput(e.target.value)}
                placeholder="e.g. Hubtown Office Landlord"
                className="w-full bg-slate-50 border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Expected Amount ({currency})</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border rounded-lg p-2 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Expected Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
                className="w-full bg-slate-50 border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Direction</label>
              <select
                value={direction}
                onChange={e => setDirection(e.target.value as any)}
                className="w-full bg-slate-50 border rounded-lg p-2 font-semibold"
              >
                <option value="Payment">Payment (Money Out)</option>
                <option value="Receipt">Receipt (Money In)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. September Office Rent"
                className="w-full bg-slate-50 border rounded-lg p-2"
              />
            </div>

            <div className="md:col-span-3 flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-700 text-white rounded-lg font-bold shadow-sm"
              >
                Save to Pending Queue
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Items List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active Money Calendar Queue ({scopedPendingTransactions.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {scopedPendingTransactions.map(p => {
            const acc = accounts.find(a => a.id === p.account_id);
            // Check for suggested candidate transaction (scoped by user's company)
            const candidateTxn = scopedUserTransactions.find(t =>
              t.account_id === p.account_id &&
              t.direction === p.direction &&
              Math.abs(t.amount - p.amount) <= 0.01
            );

            return (
              <div key={p.id} className="p-4 hover:bg-slate-50 transition space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-rose-950 font-mono">{p.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === 'done' ? 'bg-emerald-100 text-emerald-800' :
                      p.status === 'suggested' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                      p.status === 'cancelled' ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {p.status}
                    </span>
                    <span className="font-medium text-slate-800">{p.party_name_raw || 'Unspecified Party'}</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="text-[11px] text-slate-500">Expected: {p.expected_date}</span>
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                      {p.currency} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {p.description && <p className="text-slate-600 italic text-[11px]">"{p.description}"</p>}

                {/* Candidate Suggestion Box */}
                {p.status === 'suggested' && candidateTxn && (
                  <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2 text-amber-900">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Matching Entry Found: <strong className="font-bold">{candidateTxn.id}</strong> &bull; {candidateTxn.date_of_transaction} &bull; {candidateTxn.party_name_raw} ({candidateTxn.currency} {candidateTxn.amount.toLocaleString()})
                      </span>
                    </div>

                    <button
                      onClick={() => mapAndClosePending(p.id, candidateTxn.id)}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-sm text-xs flex items-center space-x-1 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Map & Close</span>
                    </button>
                  </div>
                )}

                {p.status === 'done' && p.linked_user_txn_id && (
                  <div className="text-[11px] text-emerald-800 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Fulfilled by User Transaction: {p.linked_user_txn_id}</span>
                  </div>
                )}

                {p.status === 'pending' && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => cancelPendingTransaction(p.id)}
                      className="text-[11px] text-slate-400 hover:text-rose-700"
                    >
                      Cancel Item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
