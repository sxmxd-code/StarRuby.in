import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { BankTransaction, UserTransaction } from '../../types/database';
import { formatDisplayDate, formatDisplayDateTime, formatCurrencyAmount } from '../../lib/formatters';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  X,
  Landmark,
  Shield,
  FileText,
  Clock,
  User,
  Building,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Unlink,
  ExternalLink,
  Edit3,
  Save,
  Tag,
  Hash,
  ArrowRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

interface BankTransactionBoardModalProps {
  bankTransaction: BankTransaction;
  onClose: () => void;
  onOpenUserBoard?: (userTxn: UserTransaction) => void;
}

export const BankTransactionBoardModal: React.FC<BankTransactionBoardModalProps> = ({
  bankTransaction,
  onClose,
  onOpenUserBoard,
}) => {
  const {
    currentUser,
    currentRole,
    allUsers,
    accounts,
    companies,
    parties,
    partiesMap,
    bankTransactions,
    userTransactions,
    txnBankLinks,
    unlinkTxnBank,
    recordVersions,
    restoreCellVersion,
    updateBankTransaction,
    updateBankTransactionCell,
    deleteBankTransaction,
  } = useApp();

  // Dual Body & Main Scroll Lock
  useBodyScrollLock(true);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Real-time active bank transaction from context
  const currentBankTxn = bankTransactions.find(b => b.id === bankTransaction.id) || bankTransaction;

  // Account & Company details
  const account = accounts.find(a => a.id === currentBankTxn.account_id);
  const company = account ? companies.find(c => c.id === account.company_id) : null;
  const party = currentBankTxn.party_id ? partiesMap.get(currentBankTxn.party_id) : null;

  // Linked User Transactions
  const linkedLinks = txnBankLinks.filter(l => l.bank_txn_id === currentBankTxn.id);
  const linkedUserTxns = userTransactions.filter(u => linkedLinks.some(l => l.user_txn_id === u.id));

  // Cell-Level Audit Versions for this Bank Transaction
  const bankVersions = useMemo(() => {
    return recordVersions
      .filter(v => v.table_name === 'transactions_bank' && v.record_id === currentBankTxn.id)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  }, [recordVersions, currentBankTxn.id]);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editNarration, setEditNarration] = useState(currentBankTxn.narration || '');
  const [editDescription, setEditDescription] = useState(currentBankTxn.description || '');
  const [editReferenceNo, setEditReferenceNo] = useState(currentBankTxn.reference_no || '');
  const [editValueDate, setEditValueDate] = useState(currentBankTxn.value_date);
  const [editPartyId, setEditPartyId] = useState(currentBankTxn.party_id || '');
  const [editDebit, setEditDebit] = useState(String(currentBankTxn.debit || 0));
  const [editCredit, setEditCredit] = useState(String(currentBankTxn.credit || 0));

  // Feedback State
  const [feedback, setFeedback] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);

  // Sync edit state if currentBankTxn changes
  useEffect(() => {
    setEditNarration(currentBankTxn.narration || '');
    setEditDescription(currentBankTxn.description || '');
    setEditReferenceNo(currentBankTxn.reference_no || '');
    setEditValueDate(currentBankTxn.value_date);
    setEditPartyId(currentBankTxn.party_id || '');
    setEditDebit(String(currentBankTxn.debit || 0));
    setEditCredit(String(currentBankTxn.credit || 0));
  }, [currentBankTxn]);

  const handleSaveEdits = (e: React.FormEvent) => {
    e.preventDefault();
    const debitNum = parseFloat(editDebit) || 0;
    const creditNum = parseFloat(editCredit) || 0;

    updateBankTransaction(currentBankTxn.id, {
      narration: editNarration.trim(),
      description: editDescription.trim(),
      reference_no: editReferenceNo.trim(),
      value_date: editValueDate,
      party_id: editPartyId || undefined,
      debit: debitNum,
      credit: creditNum,
    });

    setIsEditing(false);
    setFeedback(`Bank statement transaction ${currentBankTxn.id} updated. Audit delta recorded.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRestoreVersion = (versionId: number) => {
    if (currentRole !== 'Admin') {
      setFeedback('Unauthorized: Only Administrators have permission to restore historical versions.');
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const targetVer = recordVersions.find(v => v.id === versionId);
    if (!targetVer) return;

    if (
      !window.confirm(
        `Are you sure you want to restore "${targetVer.column_name}" back to "${targetVer.old_value || '(empty)'}"? A new version row will be created recording this restore.`
      )
    ) {
      return;
    }

    setRestoringVersionId(versionId);
    try {
      const res = restoreCellVersion(versionId);
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleDeleteTransaction = () => {
    if (currentRole !== 'Admin') {
      alert('Unauthorized: Only Administrators have permission to delete statement lines.');
      return;
    }
    const reason = window.prompt(`Are you sure you want to permanently delete bank statement line ${currentBankTxn.id}? Please enter deletion reason:`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Deletion cancelled: A reason is required for the audit record.');
      return;
    }
    const ok = deleteBankTransaction(currentBankTxn.id, reason.trim());
    if (ok) {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Crisp Solid Scrim Backdrop (No blur) */}
      <div className="fixed inset-0 bg-slate-950/75 transition-opacity" onClick={onClose} aria-hidden="true" />

      {/* Main Board Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-50/90 via-white to-slate-50 text-slate-900 p-3.5 sm:p-5 border-b border-slate-200/90 flex items-start sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-xl border border-blue-200 text-blue-800 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base sm:text-lg font-bold font-serif tracking-wide text-slate-900 font-mono">
                  {currentBankTxn.id}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg border bg-blue-50 text-blue-800 border-blue-200">
                  Bank Statement Line
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                    linkedUserTxns.length > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {linkedUserTxns.length > 0 ? `Reconciled (${linkedUserTxns.length} linked)` : 'Unlinked / Open'}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                    currentBankTxn.debit > 0
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {currentBankTxn.debit > 0 ? 'Debit (-)' : 'Credit (+)'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {company?.full_name} &bull; Account: {account?.bank_name} ({account?.account_number}) &bull; Currency: {currentBankTxn.currency}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {currentRole === 'Admin' && (
              <button
                type="button"
                onClick={handleDeleteTransaction}
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                title="Delete Statement Line (Admin)"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Close Board (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 bg-slate-50">
          
          {/* Feedback Banner */}
          {feedback ? (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs ${
                feedback.startsWith('Error') || feedback.startsWith('Unauthorized')
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <span>{feedback}</span>
              <button onClick={() => setFeedback(null)} className="underline text-[11px] ml-2 cursor-pointer">
                Dismiss
              </button>
            </div>
          ) : null}

          {/* Grid: Bank Transaction Details & Linked User Entries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Box: Bank Statement Details & Edit */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Statement Record Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit Details'}</span>
                </button>
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Value Date</span>
                    <span className="font-semibold text-slate-800">{formatDisplayDate(currentBankTxn.value_date)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount</span>
                    <span className={`text-base font-bold tabular-nums font-mono ${currentBankTxn.debit > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {currentBankTxn.debit > 0
                        ? `-${formatCurrencyAmount(currentBankTxn.debit, currentBankTxn.currency)}`
                        : `+${formatCurrencyAmount(currentBankTxn.credit, currentBankTxn.currency)}`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Running Balance</span>
                    <span className="font-mono font-medium text-slate-800">
                      {currentBankTxn.balance_after ? formatCurrencyAmount(currentBankTxn.balance_after, currentBankTxn.currency) : '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference / UTR</span>
                    <span className="font-mono font-semibold text-blue-800">{currentBankTxn.reference_no || '—'}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Matched Party</span>
                    <div className="mt-0.5">
                      {party ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {party.system_name} {party.group_name ? `(${party.group_name})` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No party linked</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Raw Narration</span>
                    <p className="text-slate-900 font-mono text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1 break-words">
                      {currentBankTxn.narration}
                    </p>
                  </div>

                  {currentBankTxn.description && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Internal Note</span>
                      <p className="text-slate-700 italic mt-0.5">{currentBankTxn.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSaveEdits} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Raw Narration</label>
                    <textarea
                      value={editNarration}
                      onChange={e => setEditNarration(e.target.value)}
                      rows={2}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Value Date</label>
                      <input
                        type="date"
                        value={editValueDate}
                        onChange={e => setEditValueDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Reference / UTR</label>
                      <input
                        type="text"
                        value={editReferenceNo}
                        onChange={e => setEditReferenceNo(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                        placeholder="UTR / Check No"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Debit Amount (-)</label>
                      <input
                        type="number"
                        step="any"
                        value={editDebit}
                        onChange={e => setEditDebit(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Credit Amount (+)</label>
                      <input
                        type="number"
                        step="any"
                        value={editCredit}
                        onChange={e => setEditCredit(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Assigned Party</label>
                    <select
                      value={editPartyId}
                      onChange={e => setEditPartyId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="">(No Party Assigned)</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.system_name} {p.group_name ? `(${p.group_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Internal Note</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      placeholder="Add reconciliation notes..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save & Log Version</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Box: Linked User Transactions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-rose-600" />
                  <span>Linked User Transactions ({linkedUserTxns.length})</span>
                </h3>
                <span className="text-[10px] text-slate-500">Reconciled Workload</span>
              </div>

              {linkedUserTxns.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <p>Zero user transactions currently linked to this statement line.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Link with user transactions in the Match &amp; Reconcile tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {linkedUserTxns.map(u => {
                    const uParty = u.party_id ? partiesMap.get(u.party_id) : null;
                    return (
                      <div
                        key={u.id}
                        className="p-3 rounded-lg border border-rose-100 bg-rose-50/40 text-xs flex items-center justify-between gap-3 hover:bg-rose-50/70 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-rose-950 font-mono">{u.id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-white text-rose-900 border border-rose-200">
                              {u.direction}
                            </span>
                            <span className="text-[11px] text-slate-500">{formatDisplayDate(u.date_of_transaction)}</span>
                          </div>
                          <div className="text-slate-800 font-semibold">
                            {uParty?.system_name || u.party_name_raw}
                          </div>
                          <div className="font-mono text-emerald-800 font-bold">
                            {formatCurrencyAmount(u.amount, u.currency)}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {onOpenUserBoard && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenUserBoard(u);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-semibold flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title="Open User Transaction Board"
                            >
                              <span>Board</span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => unlinkTxnBank(u.id, currentBankTxn.id)}
                            className="text-slate-400 hover:text-rose-700 p-1.5 rounded hover:bg-rose-100 transition cursor-pointer"
                            title="Unlink from this bank statement line"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Cell-Level Version & Audit History */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Transaction Audit Trail &amp; Version History ({bankVersions.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-normal">
                Realtime database mutations &bull; 1-click Admin restore
              </span>
            </div>

            {bankVersions.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-2">
                No modification history recorded yet for this bank statement line.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {bankVersions.map(v => {
                  const author = allUsers.find(u => u.id === v.changed_by);
                  return (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-2 hover:bg-slate-100/60 transition"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded border border-slate-300/80">
                            #{v.id} &bull; {v.column_name}
                          </span>
                          <span className="text-slate-600 font-medium">
                            by <strong className="text-slate-800">{author ? author.full_name : v.changed_by}</strong>
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {formatDisplayDateTime(v.changed_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 font-mono text-[11px] overflow-hidden">
                          <span
                            className="text-rose-700 line-through bg-rose-50 px-2 py-0.5 rounded border border-rose-200 truncate max-w-[240px]"
                            title={v.old_value}
                          >
                            {v.old_value !== undefined && v.old_value !== '' ? String(v.old_value) : '(empty)'}
                          </span>
                          <span className="text-slate-400 shrink-0">&rarr;</span>
                          <span
                            className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[240px]"
                            title={v.new_value}
                          >
                            {v.new_value !== undefined && v.new_value !== '' ? String(v.new_value) : '(empty)'}
                          </span>
                        </div>

                        {/* Admin 1-Click Restore Action */}
                        <div>
                          {currentRole === 'Admin' ? (
                            <button
                              type="button"
                              onClick={() => handleRestoreVersion(v.id)}
                              disabled={restoringVersionId === v.id || v.column_name.includes('DELETED')}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                              title={`Restore ${v.column_name} to "${v.old_value}"`}
                            >
                              <RotateCcw className={`w-3 h-3 ${restoringVersionId === v.id ? 'animate-spin' : ''}`} />
                              <span>{restoringVersionId === v.id ? 'Restoring...' : 'Restore'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Admin only</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close Board
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
