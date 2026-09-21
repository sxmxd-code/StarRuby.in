import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction } from '../../types/database';
import { CheckCheck, Shield, AlertCircle, CheckCircle, Clock, ArrowRight, UserCheck, ExternalLink, ShieldAlert } from 'lucide-react';
import { TransactionBoardModal } from './TransactionBoardModal';
import confetti from 'canvas-confetti';

export const ApprovalsModule: React.FC = () => {
  const {
    scopedUserTransactions,
    approvals,
    partiesMap,
    accounts,
    allUsers,
    submitApproval,
    currentUser,
    currentRole,
  } = useApp();

  const [selectedTxnForBoard, setSelectedTxnForBoard] = useState<UserTransaction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState<{ [id: string]: string }>({});

  // 1. Transactions waiting for Layer 2 (1st Admin Approval)
  // These are closed in Match Tab (status = 'in_approval') and have Layer 1 approval but not Layer 2
  const layer2Queue = useMemo(() => {
    return scopedUserTransactions.filter(t => {
      const txnApprovals = approvals.filter(a => a.user_txn_id === t.id && a.decision === 'approved');
      const hasL1 = txnApprovals.some(a => a.layer === 1);
      const hasL2 = txnApprovals.some(a => a.layer === 2);
      return (t.status === 'in_approval' || hasL1) && !hasL2;
    });
  }, [scopedUserTransactions, approvals]);

  // 2. Transactions waiting for Layer 3 (Final Review by the OTHER Admin)
  // These have Layer 2 approved, but not Layer 3
  const layer3Queue = useMemo(() => {
    return scopedUserTransactions.filter(t => {
      const txnApprovals = approvals.filter(a => a.user_txn_id === t.id && a.decision === 'approved');
      const hasL2 = txnApprovals.some(a => a.layer === 2);
      const hasL3 = txnApprovals.some(a => a.layer === 3);
      return hasL2 && !hasL3;
    });
  }, [scopedUserTransactions, approvals]);

  const handleApproveLayer2 = (txnId: string) => {
    const res = submitApproval(txnId, 2, 'approved', 'Layer 2 approved by Admin. Ready for accounting entry.');
    setFeedback(res.message);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleApproveLayer3 = (txnId: string) => {
    const res = submitApproval(txnId, 3, 'approved', 'Layer 3 final review complete. Transaction closed.');
    setFeedback(res.message);
    if (res.success) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleReject = (txnId: string, layer: 2 | 3) => {
    const reason = rejectComment[txnId] || 'Rejected by Admin';
    const res = submitApproval(txnId, layer, 'rejected', reason);
    setFeedback(res.message);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
            <CheckCheck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">3-Layer Approvals Governance</h1>
            <p className="text-xs text-slate-500">
              Layer 1: Closed in Match &bull; Layer 2: 1st Admin Approval (Ready for Accounting) &bull; Layer 3: 2nd Admin Review (Closed)
            </p>
          </div>
        </div>

        {/* Current Active Approver Pill */}
        <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs">
          <Shield className="w-3.5 h-3.5 text-rose-700" />
          <span className="text-slate-500 font-medium">Current Approver:</span>
          <span className="font-bold text-slate-900">{currentUser.full_name}</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            {currentRole}
          </span>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${
          feedback.includes('Admin Exclusivity') || feedback.includes('Only Admins')
            ? 'bg-rose-100 text-rose-800 border border-rose-200'
            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        }`}>
          {feedback}
        </div>
      )}

      {/* Non-Admin Informative Notice */}
      {currentRole !== 'Admin' && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block">Admin Exclusivity Governance</span>
            <p className="mt-0.5 text-amber-800">
              Layer 2 (Ready for Accounting) and Layer 3 (Final Review & Closure) are strictly executed by Group Admins (Harshil Zaveri & Vismay Zaveri). As <strong>{currentRole}</strong>, you have full view and audit status rights.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: LAYER 2 QUEUE (READY FOR ACCOUNTING) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-2">
              <span>Layer 2 Queue — Awaiting 1st Admin Approval ({layer2Queue.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Approved by Harshil OR Vismay. Once approved here, the transaction is immediately <strong>READY FOR ACCOUNTING ENTRY</strong>.
            </p>
          </div>
        </div>

        {layer2Queue.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
            No transactions waiting for Layer 2 approval.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {layer2Queue.map(txn => {
              const party = txn.party_id ? partiesMap.get(txn.party_id) : null;
              const acc = accounts.find(a => a.id === txn.account_id);
              const l1 = approvals.find(a => a.user_txn_id === txn.id && a.layer === 1);

              return (
                <div key={txn.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 font-mono text-sm">{txn.id}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{txn.date_of_transaction}</span>
                  </div>

                  <div className="space-y-1">
                    <p><span className="text-slate-400">Party:</span> <strong className="text-slate-900">{party?.system_name || txn.party_name_raw}</strong></p>
                    <p><span className="text-slate-400">Account:</span> <span className="text-slate-700">{acc?.bank_name}</span></p>
                    <p><span className="text-slate-400">Amount:</span> <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">{txn.currency} {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
                    {txn.description && <p className="text-slate-600 italic">"{txn.description}"</p>}
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      txn.amount_confirmed === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {txn.amount_confirmed} Amount
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      txn.verified_with_bank === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      Bank Verified: {txn.verified_with_bank}
                    </span>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <button
                      onClick={() => setSelectedTxnForBoard(txn)}
                      className="text-rose-700 font-semibold hover:underline flex items-center space-x-1"
                    >
                      <span>Open Board</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <div className="flex items-center space-x-2">
                      {currentRole === 'Admin' ? (
                        <>
                          <button
                            onClick={() => handleReject(txn.id, 2)}
                            className="px-2.5 py-1 bg-slate-200 text-rose-800 font-semibold rounded hover:bg-rose-100 cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveLayer2(txn.id)}
                            className="px-3 py-1 bg-rose-700 text-white font-bold rounded hover:bg-rose-800 shadow-sm cursor-pointer"
                          >
                            Approve Layer 2
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                          Admin Approval Only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: LAYER 3 QUEUE (FINAL CLOSURE BY THE OTHER ADMIN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-900 flex items-center space-x-2">
              <span>Layer 3 Queue — Final Review & Closure ({layer3Queue.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <strong>Admin Exclusivity Rule</strong>: Must be reviewed and closed by the <strong>OTHER Admin</strong> who did not approve Layer 2.
            </p>
          </div>
        </div>

        {layer3Queue.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
            No transactions waiting for Layer 3 review.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {layer3Queue.map(txn => {
              const party = txn.party_id ? partiesMap.get(txn.party_id) : null;
              const acc = accounts.find(a => a.id === txn.account_id);
              
              // Determine who approved Layer 2
              const l2 = approvals.find(a => a.user_txn_id === txn.id && a.layer === 2 && a.decision === 'approved');
              const l2Approver = l2 ? allUsers.find(u => u.id === l2.approver_id) : null;
              const requiredApprover = l2?.approver_id === 'USR1' ? 'Vismay Zaveri (Admin 2)' : 'Harshil Zaveri (Admin 1)';
              const isCurrentUserEligible = currentUser.id !== l2?.approver_id && currentRole === 'Admin';

              return (
                <div key={txn.id} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 font-mono text-sm">{txn.id}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{txn.date_of_transaction}</span>
                  </div>

                  <div className="space-y-1">
                    <p><span className="text-slate-400">Party:</span> <strong className="text-slate-900">{party?.system_name || txn.party_name_raw}</strong></p>
                    <p><span className="text-slate-400">Amount:</span> <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">{txn.currency} {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
                    <p className="text-[11px] text-emerald-800">
                      &check; Layer 2 Approved by: <strong>{l2Approver?.full_name || 'Admin'}</strong>
                    </p>
                  </div>

                  {/* Explicit Waiting Badge */}
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Awaiting Final Review By:</span>
                    <span className="font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                      {requiredApprover}
                    </span>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <button
                      onClick={() => setSelectedTxnForBoard(txn)}
                      className="text-rose-700 font-semibold hover:underline flex items-center space-x-1"
                    >
                      <span>Open Board</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <div className="flex items-center space-x-2">
                      {currentRole === 'Admin' ? (
                        <>
                          <button
                            onClick={() => handleReject(txn.id, 3)}
                            className="px-2.5 py-1 bg-slate-200 text-rose-800 font-semibold rounded hover:bg-rose-100 cursor-pointer"
                          >
                            Reject
                          </button>

                          <button
                            onClick={() => handleApproveLayer3(txn.id)}
                            disabled={!isCurrentUserEligible}
                            className={`px-3 py-1 text-white font-bold rounded shadow-sm transition ${
                              isCurrentUserEligible
                                ? 'bg-emerald-700 hover:bg-emerald-800 cursor-pointer'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-80'
                            }`}
                            title={!isCurrentUserEligible ? `Must be approved by ${requiredApprover}. (Admin Exclusivity Rule)` : 'Approve & Close'}
                          >
                            {isCurrentUserEligible ? 'Final Review & Close' : `Awaiting ${requiredApprover.split(' ')[0]}`}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                          Admin Approval Only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Board Modal */}
      {selectedTxnForBoard && (
        <TransactionBoardModal
          transaction={selectedTxnForBoard}
          onClose={() => setSelectedTxnForBoard(null)}
        />
      )}

    </div>
  );
};
