import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { FileSpreadsheet, Landmark, Download } from 'lucide-react';

export const StatementReconciliationModule: React.FC = () => {
  const { accounts, bankTransactions, scopedAccounts } = useApp();

  const [selectedAccountId, setSelectedAccountId] = useState(scopedAccounts[0]?.id || '');

  // Sync selectedAccountId when scopedAccounts change
  React.useEffect(() => {
    if (scopedAccounts.length > 0 && !scopedAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(scopedAccounts[0].id);
    }
  }, [scopedAccounts, selectedAccountId]);

  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  // Filter bank transactions for this account in chronological order
  const accountEntries = useMemo(() => {
    return bankTransactions
      .filter(b => b.account_id === selectedAccountId)
      .sort((a, b) => new Date(a.value_date).getTime() - new Date(b.value_date).getTime());
  }, [bankTransactions, selectedAccountId]);

  // Compute running balance
  const ledgerRows = useMemo(() => {
    let running = 0;
    return accountEntries.map(entry => {
      if (entry.balance_after !== undefined && entry.balance_after !== null) {
        running = entry.balance_after;
      } else {
        running = running + (entry.credit || 0) - (entry.debit || 0);
      }
      return {
        ...entry,
        computedBalance: running,
      };
    });
  }, [accountEntries]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Statement Running Ledger</h1>
            <p className="text-xs text-slate-500">
              Read-Only Physical Cross-Check Report &bull; Line-by-line running balance verification against bank statement
            </p>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-500">Select Account:</label>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
          >
            {scopedAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.id} &bull; {acc.bank_name} ({acc.account_currency})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Account Balance Summary Card */}
      {activeAccount && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-800">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Bank Account</span>
            <span className="font-bold text-sm text-slate-900">{activeAccount.bank_name}</span>
            <span className="text-[11px] text-slate-500 block font-mono">{activeAccount.account_number}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Holder & Country</span>
            <span className="font-semibold text-slate-800">{activeAccount.account_holder}</span>
            <span className="text-[11px] text-slate-500 block">{activeAccount.bank_country}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Currency</span>
            <span className="font-bold text-base text-rose-700 font-mono">{activeAccount.account_currency}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Closing Statement Balance</span>
            <span className="font-bold text-lg text-emerald-700 font-mono tabular-nums">
              {activeAccount.account_currency} {ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Transactions Running Balance ({ledgerRows.length} lines)
          </h3>
          <span className="text-[11px] text-slate-500">Cross-check against PDF statement lines</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 uppercase text-[10px] text-slate-700 font-sans border-b">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Value Date</th>
                <th className="p-3 font-sans">Narration (Printed Line)</th>
                <th className="p-3">Ref / Cheque</th>
                <th className="p-3 text-right">Debit (Out)</th>
                <th className="p-3 text-right">Credit (In)</th>
                <th className="p-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {ledgerRows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-blue-900">{row.id}</td>
                  <td className="p-3 text-slate-600">{row.value_date}</td>
                  <td className="p-3 font-sans max-w-xs truncate text-slate-800" title={row.narration}>
                    {row.narration}
                  </td>
                  <td className="p-3 text-slate-500">{row.reference_no || '—'}</td>
                  <td className="p-3 text-right text-rose-700 tabular-nums">
                    {row.debit > 0 ? `-${row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="p-3 text-right text-emerald-700 tabular-nums">
                    {row.credit > 0 ? `+${row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                    {row.computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
