import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileSpreadsheet,
  Landmark,
  Scale,
  CheckCircle2,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
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
    hasHarshilApproved,
    hasVismayApproved,
  } = useApp();

  const [selectedAccountId, setSelectedAccountId] = useState(scopedAccounts[0]?.id || '');
  const [ledgerMode, setLedgerMode] = useState<'bank_statement' | 'user_book'>('bank_statement');

  // Sync selectedAccountId when scopedAccounts change
  React.useEffect(() => {
    if (scopedAccounts.length > 0 && !scopedAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(scopedAccounts[0].id);
    }
  }, [scopedAccounts, selectedAccountId]);

  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  // =========================================================================
  // 1. BANK STATEMENT RUNNING LEDGER (Passbook Feed)
  // Excludes lines linked to user transactions with 'open' or 'queried' status
  // =========================================================================
  const bankAccountEntries = useMemo(() => {
    return bankTransactions
      .filter(b => b.account_id === selectedAccountId)
      .sort((a, b) => new Date(a.value_date).getTime() - new Date(b.value_date).getTime());
  }, [bankTransactions, selectedAccountId]);

  const bankLedgerRows = useMemo(() => {
    let running = 0;
    const rows = [];

    for (const entry of bankAccountEntries) {
      if (entry.balance_after !== undefined && entry.balance_after !== null) {
        running = entry.balance_after;
      } else {
        running = running + (entry.credit || 0) - (entry.debit || 0);
      }

      // Check linked user transaction & 3-layer approvals
      const links = txnBankLinks.filter(l => l.bank_txn_id === entry.id);
      const linkedUserTxns = userTransactions.filter(u => links.some(l => l.user_txn_id === u.id));
      const primaryLinkedTxn = linkedUserTxns[0] || null;

      // EXCLUSION RULE: Exclude statement lines linked to user transactions with 'open' or 'queried' status
      if (primaryLinkedTxn && (primaryLinkedTxn.status === 'open' || primaryLinkedTxn.status === 'queried')) {
        continue;
      }

      let l1Status = 'No';
      let harshilStatus = 'No';
      let vismayStatus = 'No';
      let adminStatus = 'Unlinked';
      let approvedBy = '—';

      if (primaryLinkedTxn) {
        adminStatus = primaryLinkedTxn.status;
        const txnApprs = approvals.filter(a => a.user_txn_id === primaryLinkedTxn.id && a.decision === 'approved');
        const l1 = txnApprs.find(a => a.layer === 1);

        if (l1) l1Status = 'Yes';
        if (hasHarshilApproved(primaryLinkedTxn.id)) harshilStatus = 'Yes';
        if (hasVismayApproved(primaryLinkedTxn.id)) vismayStatus = 'Yes';

        if (harshilStatus === 'Yes' && vismayStatus === 'Yes') {
          approvedBy = 'Both (Harshil & Vismay)';
        } else if (harshilStatus === 'Yes') {
          approvedBy = 'Harshil Zaveri';
        } else if (vismayStatus === 'Yes') {
          approvedBy = 'Vismay Zaveri';
        } else if (l1) {
          approvedBy = 'Layer 1 (Accountant)';
        }
      }

      rows.push({
        ...entry,
        computedBalance: running,
        primaryLinkedTxn,
        linkedCount: linkedUserTxns.length,
        l1Status,
        harshilStatus,
        vismayStatus,
        adminStatus,
        approvedBy,
      });
    }

    return rows;
  }, [bankAccountEntries, txnBankLinks, userTransactions, approvals, allUsers, hasHarshilApproved, hasVismayApproved]);

  // =========================================================================
  // 2. USER TRANSACTIONS RUNNING BOOK LEDGER (Company Cash / Bank Book)
  // Strictly excludes user transactions with 'open' or 'queried' status
  // =========================================================================
  const userAccountEntries = useMemo(() => {
    return userTransactions
      .filter(u => u.account_id === selectedAccountId)
      .filter(u => u.status !== 'open' && u.status !== 'queried')
      .sort((a, b) => new Date(a.date_of_transaction).getTime() - new Date(b.date_of_transaction).getTime());
  }, [userTransactions, selectedAccountId]);

  const userLedgerRows = useMemo(() => {
    let running = 0;
    return userAccountEntries.map(txn => {
      const isReceipt = txn.direction === 'Receipt';
      const debit = isReceipt ? 0 : txn.amount;
      const credit = isReceipt ? txn.amount : 0;
      running = running + credit - debit;

      // Find linked bank transactions
      const links = txnBankLinks.filter(l => l.user_txn_id === txn.id);
      const linkedBankEntries = bankTransactions.filter(b => links.some(l => l.bank_txn_id === b.id));

      const txnApprs = approvals.filter(a => a.user_txn_id === txn.id && a.decision === 'approved');
      const l1 = txnApprs.find(a => a.layer === 1);

      const l1Status = l1 ? 'Yes' : 'No';
      const harshilStatus = hasHarshilApproved(txn.id) ? 'Yes' : 'No';
      const vismayStatus = hasVismayApproved(txn.id) ? 'Yes' : 'No';

      let approvedBy = '—';
      if (harshilStatus === 'Yes' && vismayStatus === 'Yes') {
        approvedBy = 'Both (Harshil & Vismay)';
      } else if (harshilStatus === 'Yes') {
        approvedBy = 'Harshil Zaveri';
      } else if (vismayStatus === 'Yes') {
        approvedBy = 'Vismay Zaveri';
      } else if (l1) {
        approvedBy = 'Layer 1 (Accountant)';
      }

      return {
        ...txn,
        debit,
        credit,
        computedBalance: running,
        linkedBankEntries,
        l1Status,
        harshilStatus,
        vismayStatus,
        adminStatus: txn.status,
        approvedBy,
      };
    });
  }, [userAccountEntries, txnBankLinks, bankTransactions, approvals, allUsers, hasHarshilApproved, hasVismayApproved]);

  // Closing balances
  const closingStatementBalance = bankLedgerRows.length > 0 ? bankLedgerRows[bankLedgerRows.length - 1].computedBalance : 0;
  const closingBookBalance = userLedgerRows.length > 0 ? userLedgerRows[userLedgerRows.length - 1].computedBalance : 0;
  const reconciliationVariance = closingStatementBalance - closingBookBalance;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Statement Running Ledger</h1>
            <p className="text-xs text-slate-500">
              Read-Only Cross-Check Report &bull; Line-by-line running balances &bull; Strictly excludes Open &amp; Queried transactions
            </p>
          </div>
        </div>

        {/* Dual Ledger Mode Switcher & Account Switcher */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLedgerMode('bank_statement')}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
                ledgerMode === 'bank_statement'
                  ? 'bg-white text-blue-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Statement ({bankLedgerRows.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLedgerMode('user_book')}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
                ledgerMode === 'user_book'
                  ? 'bg-white text-rose-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>User Transactions Book ({userLedgerRows.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-500">Account:</label>
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
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Closing Statement (Bank)</span>
            <span className="font-bold text-base text-blue-700 font-mono tabular-nums">
              {formatCurrencyAmount(closingStatementBalance, activeAccount.account_currency)}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">Verbatim statement balance</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Closing Book (User Txns)</span>
            <span className="font-bold text-base text-rose-700 font-mono tabular-nums">
              {formatCurrencyAmount(closingBookBalance, activeAccount.account_currency)}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">Excluding open &amp; queried</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Reconciliation Variance</span>
            <div className="flex items-center space-x-2">
              <span className={`font-bold text-lg font-mono tabular-nums ${
                Math.abs(reconciliationVariance) < 0.01 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {formatCurrencyAmount(reconciliationVariance, activeAccount.account_currency)}
              </span>
              {Math.abs(reconciliationVariance) < 0.01 ? (
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Balanced</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Scale className="w-3 h-3" />
                  <span>Difference</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BANK STATEMENT RUNNING LEDGER TABLE                                      */}
      {/* ========================================================================= */}
      {ledgerMode === 'bank_statement' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <Landmark className="w-3.5 h-3.5 text-blue-700" />
                <span>Bank Statement Running Balance ({bankLedgerRows.length} lines)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Passbook entries from bank statements with running balance &bull; Lines linked to Open/Queried transactions excluded
              </p>
            </div>
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
                  <th className="p-3 text-right">Statement Balance</th>
                  <th className="p-3 font-sans">Linked User Txn</th>
                  <th className="p-3 text-center font-sans">Layer 1</th>
                  <th className="p-3 text-center font-sans">Harshil Appr.</th>
                  <th className="p-3 text-center font-sans">Vismay Appr.</th>
                  <th className="p-3 text-center font-sans">Admin Status</th>
                  <th className="p-3 font-sans">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {bankLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400 font-sans">
                      No eligible statement transactions recorded for this account.
                    </td>
                  </tr>
                ) : (
                  bankLedgerRows.map(row => {
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

                        {/* Harshil Appr. */}
                        <td className="p-3 text-center font-sans">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.harshilStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {row.harshilStatus}
                          </span>
                        </td>

                        {/* Vismay Appr. */}
                        <td className="p-3 text-center font-sans">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.vismayStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {row.vismayStatus}
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
      )}

      {/* ========================================================================= */}
      {/* 2. USER TRANSACTIONS RUNNING BOOK LEDGER TABLE                            */}
      {/* ========================================================================= */}
      {ledgerMode === 'user_book' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <BookOpen className="w-3.5 h-3.5 text-rose-700" />
                <span>User Transactions Book Ledger ({userLedgerRows.length} lines)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                General Cash/Bank book running balance for StarRuby.in &bull; Open &amp; Queried transactions excluded
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 uppercase text-[10px] text-slate-700 font-sans border-b">
                <tr>
                  <th className="p-3">User Txn ID</th>
                  <th className="p-3">Txn Date</th>
                  <th className="p-3 font-sans">Party / Description</th>
                  <th className="p-3 text-center font-sans">Direction</th>
                  <th className="p-3 text-right">Debit (Payment -)</th>
                  <th className="p-3 text-right">Credit (Receipt +)</th>
                  <th className="p-3 text-right">Book Balance</th>
                  <th className="p-3 font-sans">Linked Bank Statement</th>
                  <th className="p-3 text-center font-sans">Layer 1</th>
                  <th className="p-3 text-center font-sans">Harshil Appr.</th>
                  <th className="p-3 text-center font-sans">Vismay Appr.</th>
                  <th className="p-3 text-center font-sans">Admin Status</th>
                  <th className="p-3 font-sans">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {userLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400 font-sans">
                      No eligible user transactions recorded for this account.
                    </td>
                  </tr>
                ) : (
                  userLedgerRows.map(row => {
                    const partyName = row.party_id
                      ? partiesMap.get(row.party_id)?.system_name || row.party_name_raw
                      : row.party_name_raw;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-rose-900">{row.id}</td>
                        <td className="p-3 text-slate-600 font-sans whitespace-nowrap">
                          {formatDisplayDate(row.date_of_transaction)}
                        </td>
                        <td className="p-3 font-sans max-w-xs truncate text-slate-800" title={row.description || partyName}>
                          <div className="truncate font-medium">{partyName}</div>
                          {row.description && (
                            <div className="text-[10px] text-slate-500 truncate">{row.description}</div>
                          )}
                        </td>
                        <td className="p-3 text-center font-sans">
                          <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.direction === 'Payment'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {row.direction === 'Payment' ? (
                              <>
                                <ArrowDownLeft className="w-3 h-3" />
                                <span>Payment</span>
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Receipt</span>
                              </>
                            )}
                          </span>
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

                        {/* Linked Bank Statement Entries */}
                        <td className="p-3 font-sans">
                          {row.linkedBankEntries.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.linkedBankEntries.map(b => (
                                <div key={b.id} className="text-[10px]">
                                  <span className="font-bold text-blue-900 font-mono">{b.id}</span>
                                  {b.reference_no && (
                                    <span className="text-slate-500 ml-1">({b.reference_no})</span>
                                  )}
                                </div>
                              ))}
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

                        {/* Harshil Appr. */}
                        <td className="p-3 text-center font-sans">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.harshilStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {row.harshilStatus}
                          </span>
                        </td>

                        {/* Vismay Appr. */}
                        <td className="p-3 text-center font-sans">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.vismayStatus === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {row.vismayStatus}
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
      )}
    </div>
  );
};
