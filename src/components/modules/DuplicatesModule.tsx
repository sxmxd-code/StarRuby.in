import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { detectUserDuplicates, detectBankDuplicates, DuplicatePair } from '../../lib/matching';
import { UserTransaction, BankTransaction } from '../../types/database';
import { Copy, Trash2, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

export const DuplicatesModule: React.FC = () => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    partiesMap,
    deleteUserTransaction,
    deleteBankTransaction,
    currentRole,
    currentUser,
  } = useApp();

  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'user' | 'bank'>('user');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Compute duplicate pairs (scoped by role/company)
  const userDuplicatePairs = useMemo(() => {
    const rawPairs = detectUserDuplicates(scopedUserTransactions, partiesMap, 3, 5);
    return rawPairs.filter(p => !dismissedPairs.has(p.id));
  }, [scopedUserTransactions, partiesMap, dismissedPairs]);

  const bankDuplicatePairs = useMemo(() => {
    const rawPairs = detectBankDuplicates(scopedBankTransactions, 3, 5);
    return rawPairs.filter(p => !dismissedPairs.has(p.id));
  }, [scopedBankTransactions, dismissedPairs]);

  const handleDismiss = (pairId: string) => {
    setDismissedPairs(prev => new Set([...prev, pairId]));
    setFeedback('Pair marked as genuine (not a duplicate). Dismissed from queue.');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDeleteUserCopy = (copyId: string, pairId: string) => {
    if (!window.confirm(`Are you sure you want to delete suspected duplicate entry ${copyId}? This will be logged with your user ID (${currentUser.full_name}).`)) {
      return;
    }
    const success = deleteUserTransaction(copyId, 'Duplicate entry removed via Duplicates Triage');
    if (success) {
      setDismissedPairs(prev => new Set([...prev, pairId]));
      setFeedback(`Duplicate entry ${copyId} deleted. Audit trail preserved in record_versions.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDeleteBankCopy = (copyId: string, pairId: string) => {
    if (!window.confirm(`Are you sure you want to delete bank entry ${copyId}?`)) {
      return;
    }
    const success = deleteBankTransaction(copyId, 'Duplicate bank entry removed');
    if (success) {
      setDismissedPairs(prev => new Set([...prev, pairId]));
      setFeedback(`Bank entry ${copyId} deleted successfully.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const canDelete = currentRole === 'Admin' || currentRole === 'Accountant' || currentRole === 'Manager';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-amber-50 text-amber-700 rounded-lg">
            <Copy className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Duplicates Triage</h1>
            <p className="text-xs text-slate-500">
              System identifies suspected duplicates: Same Date (± 3 days) &bull; Same Party &bull; Amount (± 5)
            </p>
          </div>
        </div>

        {/* Section Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('user')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'user' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User Transactions ({userDuplicatePairs.length})
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'bank' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bank Statement Entries ({bankDuplicatePairs.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Staff View-Only Notice */}
      {!canDelete && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Staff View-Only: Suspected duplicate pairs can be reviewed. Removal of duplicate transactions is reserved for Manager, Accountant, and Admin.</span>
        </div>
      )}

      {/* USER TRANSACTIONS DUPLICATE PAIRS */}
      {activeTab === 'user' && (
        <div className="space-y-4">
          {userDuplicatePairs.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-700">Zero duplicate user transactions detected.</p>
              <p className="text-slate-400 mt-1">All dates, parties, and amounts are within normal variance.</p>
            </div>
          ) : (
            userDuplicatePairs.map(pair => {
              const a = pair.itemA;
              const b = pair.itemB;
              return (
                <div key={pair.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 text-xs">
                    <span className="font-bold text-amber-900 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Suspected Duplicate Pair &bull; Date Diff: {pair.daysDiff} days &bull; Amount Diff: {pair.amountDiff.toFixed(2)}</span>
                    </span>

                    <button
                      onClick={() => handleDismiss(pair.id)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      Not a Duplicate (Keep Both)
                    </button>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Item A */}
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-900">{a.id}</span>
                        <span className="text-[10px] text-slate-400">Entered: {a.date_of_entry}</span>
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-slate-400">Date:</span> <span className="font-semibold">{a.date_of_transaction}</span></p>
                        <p><span className="text-slate-400">Party:</span> <span className="font-semibold text-slate-900">{a.party_name_raw}</span></p>
                        <p><span className="text-slate-400">Amount:</span> <span className="font-mono font-bold text-slate-900">{a.currency} {a.amount.toFixed(2)}</span></p>
                        <p><span className="text-slate-400">Description:</span> <span>{a.description || '—'}</span></p>
                        <p><span className="text-slate-400">Created By:</span> <span>{a.created_by}</span></p>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteUserCopy(a.id, pair.id)}
                          className="mt-3 w-full py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded font-semibold text-xs flex items-center justify-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete {a.id} (Remove Copy)</span>
                        </button>
                      )}
                    </div>

                    {/* Item B */}
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-900">{b.id}</span>
                        <span className="text-[10px] text-slate-400">Entered: {b.date_of_entry}</span>
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-slate-400">Date:</span> <span className="font-semibold">{b.date_of_transaction}</span></p>
                        <p><span className="text-slate-400">Party:</span> <span className="font-semibold text-slate-900">{b.party_name_raw}</span></p>
                        <p><span className="text-slate-400">Amount:</span> <span className="font-mono font-bold text-slate-900">{b.currency} {b.amount.toFixed(2)}</span></p>
                        <p><span className="text-slate-400">Description:</span> <span>{b.description || '—'}</span></p>
                        <p><span className="text-slate-400">Created By:</span> <span>{b.created_by}</span></p>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteUserCopy(b.id, pair.id)}
                          className="mt-3 w-full py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded font-semibold text-xs flex items-center justify-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete {b.id} (Remove Copy)</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* BANK TRANSACTIONS DUPLICATE PAIRS */}
      {activeTab === 'bank' && (
        <div className="space-y-4">
          {bankDuplicatePairs.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-700">Zero duplicate bank statement lines detected.</p>
            </div>
          ) : (
            bankDuplicatePairs.map(pair => (
              <div key={pair.id} className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b pb-2 text-xs">
                  <span className="font-bold text-blue-950">
                    Suspected Bank Line Duplicate &bull; Value Date Diff: {pair.daysDiff} days
                  </span>
                  <button
                    onClick={() => handleDismiss(pair.id)}
                    className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 bg-slate-100 rounded"
                  >
                    Not a Duplicate
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-slate-50 border text-xs space-y-2">
                    <span className="font-bold text-blue-900">{pair.itemA.id}</span>
                    <p className="font-mono">{pair.itemA.narration}</p>
                    <p className="font-bold">{pair.itemA.currency} {(pair.itemA.debit || pair.itemA.credit).toFixed(2)}</p>
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteBankCopy(pair.itemA.id, pair.id)}
                        className="text-xs text-rose-700 hover:underline font-semibold"
                      >
                        Delete Copy {pair.itemA.id}
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border text-xs space-y-2">
                    <span className="font-bold text-blue-900">{pair.itemB.id}</span>
                    <p className="font-mono">{pair.itemB.narration}</p>
                    <p className="font-bold">{pair.itemB.currency} {(pair.itemB.debit || pair.itemB.credit).toFixed(2)}</p>
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteBankCopy(pair.itemB.id, pair.id)}
                        className="text-xs text-rose-700 hover:underline font-semibold"
                      >
                        Delete Copy {pair.itemB.id}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};
