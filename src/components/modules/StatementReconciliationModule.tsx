import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { FileSpreadsheet, Landmark, Download, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatDisplayDate, formatCurrencyAmount } from '../../lib/formatters';

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
  } = useApp();

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

  // Compute running balance & link details
  const ledgerRows = useMemo(() => {
    let running = 0;
    return accountEntries.map(entry => {
      if (entry.balance_after !== undefined && entry.balance_after !== null) {
        running = entry.balance_after;
      } else {
        running = running + (entry.credit || 0) - (entry.debit || 0);
      }

      // Check linked user transaction & 3-layer approvals
      const links = txnBankLinks.filter(l => l.bank_txn_id === entry.id);
      const linkedUserTxns = userTransactions.filter(u => links.some(l => l.user_txn_id === u.id));
      const primaryLinkedTxn = linkedUserTxns[0] || null;

      let l1Status = 'No';
      let l2Status = 'No';
      let l3Status = 'No';
      let adminStatus = 'Unlinked';
      let approvedBy = '—';

      if (primaryLinkedTxn) {
        adminStatus = primaryLinkedTxn.status;
        const txnApprs = approvals.filter(a => a.user_txn_id === primaryLinkedTxn.id && a.decision === 'approved');
        const l1 = txnApprs.find(a => a.layer === 1);
        const l2 = txnApprs.find(a => a.layer === 2);
        const l3 = txnApprs.find(a => a.layer === 3);

        if (l1) l1Status = 'Yes';
        if (l2) l2Status = 'Yes';
        if (l3) l3Status = 'Yes';

        if (l3) {
          const uObj = allUsers.find(usr => usr.id === l3.approver_id);
          approvedBy = uObj ? uObj.full_name : l3.approver_id;
        } else if (l2) {
          const uObj = allUsers.find(usr => usr.id === l2.approver_id);
          approvedBy = uObj ? `${uObj.full_name} (L2)` : `${l2.approver_id} (L2)`;
        }
      }

      return {
        ...entry,
        computedBalance: running,
        primaryLinkedTxn,
        linkedCount: linkedUserTxns.length,
        l1Status,
        l2Status,
        l3Status,
        adminStatus,
        approvedBy,
      };
    });
  }, [accountEntries, txnBankLinks, userTransactions, approvals, allUsers]);

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
              Read-Only Cross-Check Report &bull; Line-by-line running balance &bull; 3-Layer Approval Governance tracking
            </p>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-500">Select Account:</label>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            disabled={scopedAccounts.length === 0}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium disabled:opacity-60 cursor-pointer"
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

      {!activeAccount && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
          No bank accounts registered. Please add a bank account in Masters &amp; Setup.
        </div>
      )}

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
              {formatCurrencyAmount(
                ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].computedBalance : 0,
                activeAccount.account_currency
              )}
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
          <span className="text-[11px] text-slate-500">Cross-check against PDF statement lines with approval statuses</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 uppercase text-[10px] text-slate-700 font-sans border-b">
              <tr>
                <th className="p-3">Bank ID</th>
                <th className="p-3">Value Date</th>
                <th className="p-3 font-sans">Narration (Printed Line)</th>
                <th className="p-3 text-right">Debit (Out)</th>
                <th className="p-3 text-right">Credit (In)</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 font-sans">Linked User Txn</th>
                <th className="p-3 text-center font-sans">Layer 1</th>
                <th className="p-3 text-center font-sans">Layer 2</th>
                <th className="p-3 text-center font-sans">Layer 3</th>
                <th className="p-3 text-center font-sans">Admin Status</th>
                <th className="p-3 font-sans">Approved By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 font-sans">
                    No statement transactions recorded for this account.
                  </td>
                </tr>
              ) : (
                ledgerRows.map(row => {
                  const linkedParty = row.primaryLinkedTxn?.party_id
                    ? partiesMap.get(row.primaryLinkedTxn.party_id)?.system_name
                    : row.primaryLinkedTxn?.party_name_raw;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-blue-900">{row.id}</td>
                      <td className="p-3 text-slate-600 font-sans whitespace-nowrap">
                        {formatDisplayDate(row.value_date)}
                      </td>
                      <td className="p-3 font-sans max-w-xs truncate text-slate-800" title={row.narration}>
                        <div className="truncate font-medium">{row.narration}</div>
                        {row.reference_no && (
                          <div className="text-[10px] text-blue-600 font-mono">Ref: {row.reference_no}</div>
                        )}
                      </td>
                      <td className="p-3 text-right text-rose-700 tabular-nums">
                        {row.debit > 0 ? `-${row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3 text-right text-emerald-700 tabular-nums">
                        {row.credit > 0 ? `+${row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                        {row.computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Linked User Txn */}
                      <td className="p-3 font-sans">
                        {row.primaryLinkedTxn ? (
                          <div className="max-w-[160px]">
                            <span className="font-bold text-rose-900 font-mono text-[10px] block">
                              {row.primaryLinkedTxn.id}
                            </span>
                            <span className="text-[11px] text-slate-700 truncate block" title={linkedParty || ''}>
                              {linkedParty || '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Unlinked</span>
                        )}
                      </td>

                      {/* Layer 1 (Closed in Match) */}
                      <td className="p-3 text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.l1Status === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {row.l1Status}
                        </span>
                      </td>

                      {/* Layer 2 (Admin 1 Approval) */}
                      <td className="p-3 text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.l2Status === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {row.l2Status}
                        </span>
                      </td>

                      {/* Layer 3 (Admin 2 Final Review) */}
                      <td className="p-3 text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.l3Status === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {row.l3Status}
                        </span>
                      </td>

                      {/* Admin Status */}
                      <td className="p-3 text-center font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.adminStatus === 'approved' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          row.adminStatus === 'in_approval' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {row.adminStatus.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Approved By */}
                      <td className="p-3 font-sans text-slate-700 whitespace-nowrap">
                        {row.approvedBy}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
