import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useApp } from '../../context/AppContext';
import { UserTransaction, BankTransaction } from '../../types/database';
import { uploadToR2, getR2DownloadUrl } from '../../lib/storage';
import { formatDisplayDate, formatDisplayDateTime, formatCurrencyAmount } from '../../lib/formatters';
import {
  X,
  Send,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Landmark,
  Shield,
  FileText,
  Clock,
  User,
  Building,
  Unlink,
  Check,
  ShieldAlert,
  History,
  RotateCcw,
  Trash2,
  Edit3,
  Save,
  ExternalLink,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BankTransactionBoardModal } from './BankTransactionBoardModal';

interface TransactionBoardModalProps {
  transaction: UserTransaction;
  onClose: () => void;
}

export const TransactionBoardModal: React.FC<TransactionBoardModalProps> = ({ transaction, onClose }) => {
  const {
    currentUser,
    currentRole,
    allUsers,
    accounts,
    companies,
    parties,
    partiesMap,
    userTransactions,
    bankTransactions,
    txnBankLinks,
    unlinkTxnBank,
    approvals,
    comments,
    addComment,
    documents,
    attachDocument,
    deleteDocument,
    submitApproval,
    undoLayer2Approval,
    hasHarshilApproved,
    hasVismayApproved,
    submitAdminApproval,
    undoAdminApproval,
    isHarshilUser,
    isVismayUser,
    deleteUserTransaction,
    updateUserTransaction,
    updateUserTransactionCell,
    recordVersions,
    restoreCellVersion,
    moveDiscrepancyToOpen,
    markTransactionAsQueried,
  } = useApp();

  // Active real-time transaction from AppContext
  const currentTxn = userTransactions.find(t => t.id === transaction.id) || transaction;

  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [viewingBankTxn, setViewingBankTxn] = useState<BankTransaction | null>(null);

  // Inline Transaction Editing State
  const [isEditingTxn, setIsEditingTxn] = useState(false);
  const [editPartyId, setEditPartyId] = useState(currentTxn.party_id || '');
  const [editAmount, setEditAmount] = useState(String(currentTxn.amount));
  const [editDate, setEditDate] = useState(currentTxn.date_of_transaction);
  const [editDescription, setEditDescription] = useState(currentTxn.description || '');
  const [editDirection, setEditDirection] = useState(currentTxn.direction);
  const [editExchangeRate, setEditExchangeRate] = useState(String(currentTxn.exchange_rate || 1));

  useEffect(() => {
    setEditPartyId(currentTxn.party_id || '');
    setEditAmount(String(currentTxn.amount));
    setEditDate(currentTxn.date_of_transaction);
    setEditDescription(currentTxn.description || '');
    setEditDirection(currentTxn.direction);
    setEditExchangeRate(String(currentTxn.exchange_rate || 1));
  }, [currentTxn]);

  // Lock body & main scrolling while board modal is open
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

  // Find Account & Company
  const account = accounts.find(a => a.id === currentTxn.account_id);
  const company = account ? companies.find(c => c.id === account.company_id) : null;
  const party = currentTxn.party_id ? partiesMap.get(currentTxn.party_id) : null;

  // Find Linked Bank Transactions
  const linkedLinks = txnBankLinks.filter(l => l.user_txn_id === currentTxn.id);
  const linkedBankTxns = bankTransactions.filter(b => linkedLinks.some(l => l.bank_txn_id === b.id));

  // Find Documents
  const txnDocs = documents.filter(d => d.user_txn_id === currentTxn.id);

  // Find Approvals
  const txnApprovals = approvals.filter(a => a.user_txn_id === currentTxn.id);
  const layer1 = txnApprovals.find(a => a.layer === 1 && a.decision === 'approved');
  const layer2 = txnApprovals.find(a => a.layer === 2 && a.decision === 'approved');
  const layer3 = txnApprovals.find(a => a.layer === 3 && a.decision === 'approved');
  const harshilApproval = txnApprovals.find(a => a.decision === 'approved' && isHarshilUser(a.approver_id));
  const vismayApproval = txnApprovals.find(a => a.decision === 'approved' && isVismayUser(a.approver_id));
  const userIsHarshil = isHarshilUser(currentUser.id);
  const userIsVismay = isVismayUser(currentUser.id);
  const myApprovalDone = (userIsHarshil && hasHarshilApproved(currentTxn.id)) ||
                         (userIsVismay && hasVismayApproved(currentTxn.id)) ||
                         (!userIsHarshil && !userIsVismay && txnApprovals.some(a => a.decision === 'approved' && a.approver_id === currentUser.id));

  // Find Comments
  const txnComments = comments.filter(c => c.user_txn_id === currentTxn.id);

  // Find Cell-Level Audit Versions
  const txnVersions = useMemo(() => {
    return recordVersions
      .filter(v => v.table_name === 'transactions_user' && v.record_id === currentTxn.id)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  }, [recordVersions, currentTxn.id]);

  const handleSaveTxnEdits = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(editAmount) || 0;
    const rate = parseFloat(editExchangeRate) || 1;
    const inrAmt = currentTxn.currency === 'INR' ? amt : amt * rate;
    const selectedParty = editPartyId ? parties.find(p => p.id === editPartyId) : undefined;

    updateUserTransaction(currentTxn.id, {
      party_id: editPartyId || undefined,
      party_name_raw: selectedParty?.system_name || currentTxn.party_name_raw,
      amount: amt,
      currency: currentTxn.currency,
      amount_in_inr: inrAmt,
      exchange_rate: rate,
      date_of_transaction: editDate,
      direction: editDirection as 'Payment' | 'Receipt',
      description: editDescription.trim(),
    });

    setIsEditingTxn(false);
    setApprovalFeedback(`Transaction ${currentTxn.id} updated. Audit delta recorded.`);
    setTimeout(() => setApprovalFeedback(null), 4000);
  };

  const handleRestoreVersion = (versionId: number) => {
    if (currentRole !== 'Admin') {
      setApprovalFeedback('Unauthorized: Only Administrators have permission to restore historical versions.');
      setTimeout(() => setApprovalFeedback(null), 4000);
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
      setApprovalFeedback(res.message);
      setTimeout(() => setApprovalFeedback(null), 4000);
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    addComment(currentTxn.id, newComment.trim());
    setNewComment('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadToR2(file, 'documents', transaction.id);
      attachDocument({
        file_name: file.name,
        r2_bucket: res.bucket,
        r2_object_key: res.objectKey,
        content_type: file.type || 'application/pdf',
        size_bytes: res.sizeBytes,
        doc_type: 'invoice',
        user_txn_id: transaction.id,
        download_url: res.publicUrl,
      });
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAdminApprove = () => {
    const res = submitAdminApproval(currentTxn.id, approvalComment);
    if (res.success) {
      setApprovalFeedback(res.message);
      setApprovalComment('');
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
    } else {
      setApprovalFeedback(`Error: ${res.message}`);
    }
  };

  const handleUndoAdminApproval = () => {
    if (!window.confirm(`Undo your approval for transaction ${currentTxn.id}? It will return to pending review.`)) {
      return;
    }
    const res = undoAdminApproval(currentTxn.id);
    setApprovalFeedback(res.message);
    setTimeout(() => setApprovalFeedback(null), 4000);
  };

  const handleApprove = (layer: 1 | 2 | 3) => {
    const res = submitApproval(transaction.id, layer, 'approved', approvalComment);
    if (res.success) {
      setApprovalFeedback(res.message);
      if (layer === 3) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      }
    } else {
      setApprovalFeedback(`Error: ${res.message}`);
    }
  };

  const handleMoveToOpen = () => {
    const reason = approvalComment.trim() || 'Moved to Open for review / queries';
    moveDiscrepancyToOpen(transaction.id, reason);
    if (approvalComment.trim()) {
      addComment(transaction.id, `[Query Raised]: ${approvalComment.trim()}`);
    }
    setApprovalFeedback('Transaction moved back to Open for review with query recorded.');
    setApprovalComment('');
    setTimeout(() => setApprovalFeedback(null), 4000);
  };

  const handleUndoLayer2 = handleUndoAdminApproval;

  const handleDeleteTransaction = () => {
    if (currentRole !== 'Admin') {
      alert('Unauthorized: Only Administrators have permission to delete transactions.');
      return;
    }
    const reason = window.prompt(`Are you sure you want to permanently delete transaction ${currentTxn.id}? Please enter deletion reason:`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Deletion cancelled: A reason is required for the audit record.');
      return;
    }
    const ok = deleteUserTransaction(currentTxn.id, reason.trim());
    if (ok) {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Crisp Solid Scrim Backdrop (No blur, locks focus onto the modal) */}
      <div
        className="fixed inset-0 bg-slate-950/75 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-rose-50/90 via-white to-slate-50 text-slate-900 p-3.5 sm:p-5 border-b border-slate-200/90 flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 bg-rose-100 rounded-xl border border-rose-200 text-rose-800 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base sm:text-lg font-bold font-serif tracking-wide text-slate-900">{transaction.id}</h2>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg border ${
                  transaction.status === 'approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  transaction.status === 'in_approval' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  transaction.status === 'queried' ? 'bg-purple-100 text-purple-900 border-purple-300 font-extrabold animate-pulse' :
                  transaction.status === 'rejected' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {transaction.status === 'queried' ? 'QUERY' : transaction.status.replace('_', ' ')}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                  transaction.amount_confirmed === 'Confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {transaction.amount_confirmed} Amount
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {company?.full_name} &bull; Account: {account?.bank_name} ({account?.account_number})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {currentRole === 'Admin' && (
              <button
                type="button"
                onClick={handleDeleteTransaction}
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                title="Delete Transaction Permanently"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 bg-slate-50">
          
          {/* Feedback banner if any */}
          {approvalFeedback ? (
            <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
              approvalFeedback.startsWith('Error') ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              <span>{approvalFeedback}</span>
              <button onClick={() => setApprovalFeedback(null)} className="underline text-[11px] ml-2">Dismiss</button>
            </div>
          ) : null}

          {/* Dual Admin Governance Stepper */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                <span>Approval Governance &amp; Dual Co-Founder Sign-off</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-semibold">
                Requires Both Harshil &amp; Vismay to Close
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Layer 1: Closed in Match */}
              <div className={`p-3 rounded-lg border text-xs ${
                layer1 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Layer 1: Closed in Match</span>
                  {layer1 ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {layer1 ? `Closed by ${layer1.approver_id}` : 'Pending user action in Match Tab'}
                </p>
              </div>

              {/* Admin 1: Harshil Zaveri */}
              <div className={`p-3 rounded-lg border text-xs ${
                harshilApproval ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                layer1 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Harshil Zaveri (Co-Founder)</span>
                  {harshilApproval ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {harshilApproval ? `Approved (${formatDisplayDateTime(harshilApproval.decided_at)})` : 'Pending sign-off from Harshil'}
                </p>
              </div>

              {/* Admin 2: Vismay Zaveri */}
              <div className={`p-3 rounded-lg border text-xs ${
                vismayApproval ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                layer1 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Vismay Zaveri (Co-Founder)</span>
                  {vismayApproval ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {vismayApproval ? `Approved (${formatDisplayDateTime(vismayApproval.decided_at)})` : 'Pending sign-off from Vismay'}
                </p>
              </div>
            </div>
          </div>

          {/* Key Transaction Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Box: Entered Details */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>User Transaction Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTxn(!isEditingTxn)}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center space-x-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingTxn ? 'Cancel Edit' : 'Edit Details'}</span>
                </button>
              </div>

              {!isEditingTxn ? (
                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Party / Payer</span>
                    <span className="font-semibold text-slate-900">{party?.system_name || currentTxn.party_name_raw}</span>
                    {party?.group_name ? (
                      <span className="text-[10px] text-slate-500 block">Group: {party.group_name}</span>
                    ) : null}
                    {party?.cid_number ? (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                        CID: {party.cid_number}
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount & Currency</span>
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      {formatCurrencyAmount(currentTxn.amount, currentTxn.currency)}
                    </span>
                    {currentTxn.amount_in_inr && currentTxn.currency !== 'INR' ? (
                      <span className="text-[11px] text-slate-500 block tabular-nums">
                        (INR ~₹{currentTxn.amount_in_inr.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Date of Transaction</span>
                    <span className="font-medium text-slate-800">{formatDisplayDate(currentTxn.date_of_transaction)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Direction</span>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded ${
                      currentTxn.direction === 'Payment' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {currentTxn.direction}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Description / Note</span>
                    <p className="text-slate-800 italic mt-0.5">{currentTxn.description || '—'}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Verified Flag</span>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded ${
                      currentTxn.verified_with_bank === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {currentTxn.verified_with_bank}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount Status</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                        currentTxn.amount_confirmed === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {currentTxn.amount_confirmed}
                      </span>
                      <button
                        onClick={() => {
                          const nextVal = currentTxn.amount_confirmed === 'Confirmed' ? 'Unconfirmed' : 'Confirmed';
                          updateUserTransactionCell(currentTxn.id, 'amount_confirmed', nextVal);
                        }}
                        className="text-[10px] text-rose-700 hover:underline cursor-pointer"
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveTxnEdits} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Party / Payer</label>
                    <select
                      value={editPartyId}
                      onChange={e => setEditPartyId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      required
                    >
                      <option value="">Select Party</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.system_name} {p.group_name ? `(${p.group_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Amount ({currentTxn.currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Direction</label>
                      <select
                        value={editDirection}
                        onChange={e => setEditDirection(e.target.value as 'Payment' | 'Receipt')}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="Payment">Payment</option>
                        <option value="Receipt">Receipt</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Transaction Date</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Exchange Rate to INR</label>
                      <input
                        type="number"
                        step="any"
                        value={editExchangeRate}
                        onChange={e => setEditExchangeRate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                        disabled={currentTxn.currency === 'INR'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Description / Note</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      placeholder="Add transaction note or purpose..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setIsEditingTxn(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save & Log Version</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Box: Linked Bank Entries (Supporting Data) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center space-x-1.5">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  <span>Linked Bank Entries ({linkedBankTxns.length})</span>
                </h3>
                <span className="text-[10px] text-slate-500">Supporting Data</span>
              </div>

              {linkedBankTxns.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <p>Zero bank entries linked yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Remember: Bank data is optional. Transactions close & approve fully with 0 bank links.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedBankTxns.map((b) => (
                    <div key={b.id} className="p-2.5 rounded-lg border border-blue-100 bg-blue-50/50 text-xs flex items-start justify-between gap-2 hover:bg-blue-50/80 transition">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-950 font-mono">{b.id}</span>
                          <span className="text-[11px] text-slate-500 font-sans">{formatDisplayDate(b.value_date)}</span>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {b.debit > 0 ? `Debit: -${b.debit.toFixed(2)}` : `Credit: +${b.credit.toFixed(2)}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 line-clamp-1 font-mono">{b.narration}</p>
                        {b.reference_no && <span className="text-[10px] text-slate-500">Ref: {b.reference_no}</span>}
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingBankTxn(b)}
                          className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[11px] font-semibold inline-flex items-center space-x-1 cursor-pointer shadow-2xs transition"
                          title="Open Bank Statement Line Board"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                          <span>Board</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => unlinkTxnBank(currentTxn.id, b.id)}
                          className="text-slate-400 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer transition"
                          title="Unlink bank line"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Document Attachments */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Attached Documents ({txnDocs.length})</span>
                  </span>

                  <label className="text-[11px] text-rose-700 font-semibold hover:underline cursor-pointer">
                    <span>{isUploading ? 'Uploading...' : '+ Upload File'}</span>
                    <input type="file" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                  </label>
                </div>

                <div className="space-y-1.5">
                  {txnDocs.length === 0 ? (
                    <p className="text-slate-400 text-xs italic">No documents attached.</p>
                  ) : (
                    txnDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border text-xs">
                        <div className="flex items-center space-x-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="truncate font-medium text-slate-800">{doc.file_name}</span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          <a
                            href={doc.download_url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-rose-700 text-[11px] hover:underline"
                          >
                            View
                          </a>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Delete document "${doc.file_name}" from Cloudflare R2?`)) {
                                await deleteDocument(doc.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 cursor-pointer transition"
                            title="Delete file permanently from Cloudflare R2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Admin Approval Decision Bar */}
          {currentRole === 'Admin' && (
            <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-rose-700" />
                <span>Admin Governance Panel ({currentUser.full_name})</span>
              </h4>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Optional approval note or query reason for staff..."
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  className="flex-1 bg-white border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-600 w-full"
                />

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {!myApprovalDone ? (
                    <button
                      onClick={handleAdminApprove}
                      className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 shadow-sm text-center flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {userIsHarshil
                          ? 'Approve as Harshil'
                          : userIsVismay
                          ? 'Approve as Vismay'
                          : `Approve as Admin (${currentUser.full_name})`}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={handleUndoAdminApproval}
                      className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 shadow-sm text-center flex items-center justify-center space-x-1.5 cursor-pointer"
                      title="Undo your approval and return transaction to pending review"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo My Approval</span>
                    </button>
                  )}

                  <button
                    onClick={handleMoveToOpen}
                    className="px-3 py-2 sm:py-1.5 bg-slate-200 text-rose-900 rounded-lg text-xs font-semibold hover:bg-rose-200 cursor-pointer"
                  >
                    Move to Open
                  </button>

                      <button
                        type="button"
                        onClick={() => {
                          const reason = approvalComment.trim() || prompt('Enter query question or note for Admin review:');
                          if (reason && reason.trim()) {
                            markTransactionAsQueried(transaction.id, reason.trim());
                            setApprovalFeedback(`Transaction status changed to QUERIED: "${reason.trim()}"`);
                            setApprovalComment('');
                            setTimeout(() => setApprovalFeedback(null), 4000);
                          }
                        }}
                        className="px-3 py-2 sm:py-1.5 bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-xs font-semibold hover:bg-purple-200 cursor-pointer"
                      >
                        Raise Query (QUERY Tag)
                      </button>

                  <button
                    type="button"
                    onClick={handleDeleteTransaction}
                    className="px-3 py-2 sm:py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Delete Transaction Permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Board Comments / Chat Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Board Discussion & Queries ({txnComments.length})
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {txnComments.length === 0 ? (
                <p className="text-slate-400 text-xs italic">No comments yet. Raise queries or add internal notes below.</p>
              ) : (
                txnComments.map(c => {
                  const author = allUsers.find(u => u.id === c.author_id);
                  return (
                    <div key={c.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800">{author ? author.full_name : c.author_id}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{formatDisplayDateTime(c.created_at)}</span>
                      </div>
                      <p className="text-slate-700">{c.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {currentRole === 'Staff' ? (
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Staff Read-Only View: Discussion is read-only for Staff. Managers, Accountant, and Admins can post comments and queries.</span>
              </div>
            ) : (
              <form onSubmit={handleSendComment} className="flex items-center space-x-2 pt-2 border-t">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Write a comment or query to staff..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-600"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 bg-rose-700 text-white rounded-lg hover:bg-rose-800 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Cell-Level Version & Audit History */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <History className="w-4 h-4 text-blue-600" />
                <span>Transaction Audit Trail & Version History ({txnVersions.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-normal">
                Realtime database mutations &bull; 1-click Admin restore
              </span>
            </div>

            {txnVersions.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-2">No modification history recorded yet for this transaction.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {txnVersions.map(v => {
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
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close Board
          </button>
        </div>

      </div>

      {/* Linked Bank Transaction Board Inspection */}
      {viewingBankTxn && (
        <BankTransactionBoardModal
          bankTransaction={viewingBankTxn}
          onClose={() => setViewingBankTxn(null)}
        />
      )}
    </div>,
    document.body
  );
};
