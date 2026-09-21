import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, BankTransaction } from '../../types/database';
import { AlertTriangle, CheckCircle, HelpCircle, Landmark, ExternalLink } from 'lucide-react';
import { TransactionBoardModal } from './TransactionBoardModal';

export const DiscrepanciesModule: React.FC<{ onNavigateToMatch?: () => void }> = ({ onNavigateToMatch }) => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    txnBankLinks,
    partiesMap,
    accounts,
    updateUserTransactionCell,
    currentRole,
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<'unconfirmed' | 'unverified' | 'unlinked_bank'>('unconfirmed');
  const [selectedBoardTxn, setSelectedBoardTxn] = useState<UserTransaction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 1. Unconfirmed Amounts (scoped by company/role)
  const unconfirmedTxns = useMemo(() => {
    return scopedUserTransactions.filter(t => t.amount_confirmed === 'Unconfirmed');
  }, [scopedUserTransactions]);

  // 2. Unverified Closed / In-Approval Transactions (verified_with_bank = No)
  const unverifiedTxns = useMemo(() => {
    return scopedUserTransactions.filter(t => t.verified_with_bank === 'No' && (t.status === 'in_approval' || t.status === 'approved'));
  }, [scopedUserTransactions]);

  // 3. Unlinked Bank Statement Entries (0 user links)
  const unlinkedBankTxns = useMemo(() => {
    const linkedBankIds = new Set(txnBankLinks.map(l => l.bank_txn_id));
    return scopedBankTransactions.filter(b => !linkedBankIds.has(b.id));
  }, [scopedBankTransactions, txnBankLinks]);

  const handleConfirmAmount = (txnId: string) => {
    if (currentRole === 'Staff') {
      setFeedback('Error: Confirming amount is reserved for Manager, Accountant, or Admin.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    updateUserTransactionCell(txnId, 'amount_confirmed', 'Confirmed');
    setFeedback(`Transaction ${txnId} marked as Confirmed.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleVerifyBank = (txnId: string) => {
    if (currentRole === 'Staff') {
      setFeedback('Error: Setting bank verification is reserved for Manager, Accountant, or Admin.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    updateUserTransactionCell(txnId, 'verified_with_bank', 'Yes');
    setFeedback(`Transaction ${txnId} marked as Verified with Bank.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-rose-50 text-rose-700 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Pending Discrepancies & Attention Queue</h1>
            <p className="text-xs text-slate-500">
              Unconfirmed amounts &bull; Unverified items &bull; Unlinked bank lines needing investigation
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setActiveCategory('unconfirmed')}
            className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${
              activeCategory === 'unconfirmed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Unconfirmed ({unconfirmedTxns.length})
          </button>
          <button
            onClick={() => setActiveCategory('unverified')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeCategory === 'unverified' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Unverified Bank ({unverifiedTxns.length})
          </button>
          <button
            onClick={() => setActiveCategory('unlinked_bank')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeCategory === 'unlinked_bank' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Unlinked Bank Lines ({unlinkedBankTxns.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* UNCONFIRMED AMOUNTS */}
      {activeCategory === 'unconfirmed' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Transactions with Unconfirmed Amounts ({unconfirmedTxns.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Entered as approximate; verify against invoice and confirm before final approval
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase text-[10px] text-slate-600 border-b">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Party</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unconfirmedTxns.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-rose-900">{t.id}</td>
                    <td className="p-3 text-slate-600">{t.date_of_transaction}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      {partiesMap.get(t.party_id || '')?.system_name || t.party_name_raw}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {t.currency} {t.amount.toFixed(2)}
                    </td>
                    <td className="p-3 text-slate-600">{t.description || '—'}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => setSelectedBoardTxn(t)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                      >
                        Board
                      </button>
                      <button
                        onClick={() => handleConfirmAmount(t.id)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs shadow-sm"
                      >
                        Mark Confirmed
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UNVERIFIED WITH BANK */}
      {activeCategory === 'unverified' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Transactions Closed with verified_with_bank = No ({unverifiedTxns.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Team proceeded without bank data; cross-check against physical statements when available
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase text-[10px] text-slate-600 border-b">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Party</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unverifiedTxns.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-rose-900">{t.id}</td>
                    <td className="p-3 text-slate-600">{t.date_of_transaction}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      {partiesMap.get(t.party_id || '')?.system_name || t.party_name_raw}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {t.currency} {t.amount.toFixed(2)}
                    </td>
                    <td className="p-3 uppercase font-bold text-amber-800 text-[10px]">{t.status}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => setSelectedBoardTxn(t)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                      >
                        Board
                      </button>
                      <button
                        onClick={() => handleVerifyBank(t.id)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs shadow-sm"
                      >
                        Set Verified: Yes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UNLINKED BANK ENTRIES */}
      {activeCategory === 'unlinked_bank' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-blue-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Unlinked Bank Statement Entries ({unlinkedBankTxns.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Entries printed on bank statement with zero corresponding user transactions recorded
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase text-[10px] text-slate-600 border-b">
                <tr>
                  <th className="p-3">Bank Txn ID</th>
                  <th className="p-3">Value Date</th>
                  <th className="p-3">Printed Narration</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {unlinkedBankTxns.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50/50">
                    <td className="p-3 font-bold text-blue-900">{b.id}</td>
                    <td className="p-3 text-slate-600">{b.value_date}</td>
                    <td className="p-3 text-slate-800 font-sans max-w-[280px] truncate" title={b.narration}>
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
      )}

      {selectedBoardTxn && (
        <TransactionBoardModal
          transaction={selectedBoardTxn}
          onClose={() => setSelectedBoardTxn(null)}
        />
      )}

    </div>
  );
};
