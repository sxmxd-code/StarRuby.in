import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Landmark, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

export const BankEntryModule: React.FC = () => {
  const {
    accounts,
    scopedAccounts,
    scopedBankTransactions,
    addBankTransaction,
    activeCompanyId,
  } = useApp();

  const [selectedAccountId, setSelectedAccountId] = useState(scopedAccounts[0]?.id || '');
  const [valueDate, setValueDate] = useState(new Date().toISOString().slice(0, 10));

  // Sync selectedAccountId when scopedAccounts changes
  React.useEffect(() => {
    if (scopedAccounts.length > 0 && !scopedAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(scopedAccounts[0].id);
    }
  }, [scopedAccounts, selectedAccountId]);
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [balanceAfter, setBalanceAfter] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeAccount = accounts.find(a => a.id === selectedAccountId);
  const currency = activeAccount?.account_currency || 'INR';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const debit = parseFloat(debitAmount) || 0;
    const credit = parseFloat(creditAmount) || 0;

    if (!selectedAccountId) {
      setFeedback('Error: Please select a bank account.');
      return;
    }
    if (!narration.trim()) {
      setFeedback('Error: Statement narration printed by bank is required.');
      return;
    }
    if (debit <= 0 && credit <= 0) {
      setFeedback('Error: Enter either Debit or Credit amount.');
      return;
    }

    const newTxn = addBankTransaction({
      account_id: selectedAccountId,
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
    setDebitAmount('');
    setCreditAmount('');
    setBalanceAfter('');
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
            <Landmark className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Bank Statement Transactions</h1>
            <p className="text-xs text-slate-500">
              Supporting Data only &bull; Printed bank lines kept verbatim without altering raw narration
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${
          feedback.startsWith('Error') ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
        }`}>
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b pb-2">
            Add Statement Line
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bank Account</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                disabled={scopedAccounts.length === 0}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs disabled:opacity-60"
              >
                {scopedAccounts.length === 0 ? (
                  <option value="">No bank accounts available</option>
                ) : (
                  scopedAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.id} &bull; {acc.bank_name} ({acc.account_currency})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Value Date</label>
              <input
                type="date"
                value={valueDate}
                onChange={e => setValueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Printed Narration <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder="Exact statement line printed by the bank"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Kept verbatim forever (never aliased).</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Internal Note (Description)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Our internal note (typed separately)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / UTR / Cheque #</label>
              <input
                type="text"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                placeholder="UTR / Cheque number"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Debit (Money Out)</label>
                <input
                  type="number"
                  step="0.01"
                  value={debitAmount}
                  onChange={e => {
                    setDebitAmount(e.target.value);
                    if (e.target.value) setCreditAmount('');
                  }}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Credit (Money In)</label>
                <input
                  type="number"
                  step="0.01"
                  value={creditAmount}
                  onChange={e => {
                    setCreditAmount(e.target.value);
                    if (e.target.value) setDebitAmount('');
                  }}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Balance After (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={balanceAfter}
                onChange={e => setBalanceAfter(e.target.value)}
                placeholder="Running balance printed on statement"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm"
            >
              Save Bank Statement Entry
            </button>
          </form>
        </div>

        {/* Table of Statement Entries (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Statement Lines ({scopedBankTransactions.length})</h3>
            <span className="text-[11px] text-slate-500">Supporting bank records</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Narration</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {scopedBankTransactions.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50/50">
                    <td className="p-3 font-bold text-blue-900">{b.id}</td>
                    <td className="p-3 text-slate-600">{b.value_date}</td>
                    <td className="p-3 max-w-[220px] truncate text-slate-800 font-sans" title={b.narration}>
                      {b.narration}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
