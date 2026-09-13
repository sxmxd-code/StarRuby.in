import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, BankTransaction } from '../../types/database';
import { uploadToR2, getR2DownloadUrl } from '../../lib/storage';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
    partiesMap,
    bankTransactions,
    txnBankLinks,
    unlinkTxnBank,
    approvals,
    comments,
    addComment,
    documents,
    attachDocument,
    submitApproval,
    updateUserTransactionCell,
  } = useApp();

  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Find Account & Company
  const account = accounts.find(a => a.id === transaction.account_id);
  const company = account ? companies.find(c => c.id === account.company_id) : null;
  const party = transaction.party_id ? partiesMap.get(transaction.party_id) : null;

  // Find Linked Bank Transactions
  const linkedLinks = txnBankLinks.filter(l => l.user_txn_id === transaction.id);
  const linkedBankTxns = bankTransactions.filter(b => linkedLinks.some(l => l.bank_txn_id === b.id));

  // Find Comments & Documents
  const txnComments = comments.filter(c => c.user_txn_id === transaction.id);
  const txnDocs = documents.filter(d => d.user_txn_id === transaction.id);

  // Find Approvals History
  const txnApprovals = approvals.filter(a => a.user_txn_id === transaction.id);
  const layer1 = txnApprovals.find(a => a.layer === 1 && a.decision === 'approved');
  const layer2 = txnApprovals.find(a => a.layer === 2 && a.decision === 'approved');
  const layer3 = txnApprovals.find(a => a.layer === 3 && a.decision === 'approved');

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addComment(transaction.id, newComment.trim());
    setNewComment('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadToR2(file, 'documents', transaction.id);
      attachDocument({
        file_name: file.name,
        r2_bucket: result.bucket,
        r2_object_key: result.objectKey,
        content_type: file.type || 'application/pdf',
        size_bytes: result.sizeBytes,
        doc_type: 'invoice',
        user_txn_id: transaction.id,
      });
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
    }
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

  const handleReject = (layer: 1 | 2 | 3) => {
    const res = submitApproval(transaction.id, layer, 'rejected', approvalComment || 'Rejected by approver');
    setApprovalFeedback(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-rose-50/90 via-white to-slate-50 text-slate-900 p-5 border-b border-slate-200/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-100 rounded-xl border border-rose-200 text-rose-800">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold font-serif tracking-wide text-slate-900">{transaction.id}</h2>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg border ${
                  transaction.status === 'approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  transaction.status === 'in_approval' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  transaction.status === 'rejected' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {transaction.status.replace('_', ' ')}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                  transaction.amount_confirmed === 'Confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {transaction.amount_confirmed} Amount
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {company?.full_name} &bull; Account: {account?.bank_name} ({account?.account_number})
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          
          {/* Feedback banner if any */}
          {approvalFeedback ? (
            <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
              approvalFeedback.startsWith('Error') ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              <span>{approvalFeedback}</span>
              <button onClick={() => setApprovalFeedback(null)} className="underline text-[11px] ml-2">Dismiss</button>
            </div>
          ) : null}

          {/* 3-Layer Approval Progress Gauge */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              3-Layer Approval Journey
            </h4>
            <div className="grid grid-cols-3 gap-4">
              
              {/* Layer 1 */}
              <div className={`p-3 rounded-lg border text-xs ${
                layer1 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Layer 1: Closing</span>
                  {layer1 ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {layer1 ? `Closed in Match Tab by ${layer1.approver_id}` : 'Pending Match Tab Closing'}
                </p>
              </div>

              {/* Layer 2 */}
              <div className={`p-3 rounded-lg border text-xs ${
                layer2 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                layer1 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Layer 2: 1st Admin Approval</span>
                  {layer2 ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-amber-500" />}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {layer2 ? `Approved by Admin ${layer2.approver_id} (Ready for Accounting)` : 'Awaiting Harshil or Vismay'}
                </p>
              </div>

              {/* Layer 3 */}
              <div className={`p-3 rounded-lg border text-xs ${
                layer3 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                layer2 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Layer 3: 2nd Admin Review</span>
                  {layer3 ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {layer3 ? `Closed by Admin ${layer3.approver_id}` : layer2 ? 'Awaiting the OTHER Admin' : 'Pending Layer 2'}
                </p>
              </div>

            </div>
          </div>

          {/* Key Transaction Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Box: Entered Details */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 border-b pb-2 flex items-center justify-between">
                <span>User Transaction Details</span>
                <span className="text-[11px] text-slate-500 font-normal">Source of Truth</span>
              </h3>

              <div className="grid grid-cols-2 gap-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Party / Payer</span>
                  <span className="font-semibold text-slate-900">{party?.system_name || transaction.party_name_raw}</span>
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
                  <span className="text-slate-400 block text-[10px] uppercase">Amount & Currency</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {transaction.currency} {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  {transaction.amount_in_inr ? (
                    <span className="text-[11px] text-slate-500 block tabular-nums">
                      (INR ~₹{transaction.amount_in_inr.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </span>
                  ) : null}
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Date of Transaction</span>
                  <span className="font-medium text-slate-800">{transaction.date_of_transaction}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Direction</span>
                  <span className={`font-bold ${transaction.direction === 'Receipt' ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {transaction.direction}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase">Description / Purpose</span>
                  <p className="text-slate-800 font-medium bg-slate-50 p-2 rounded border border-slate-100 mt-0.5">
                    {transaction.description || 'No description entered'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Verified with Bank?</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                      transaction.verified_with_bank === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {transaction.verified_with_bank}
                    </span>
                    {(currentRole === 'Admin' || currentRole === 'Accountant' || currentRole === 'Manager') && (
                      <button
                        onClick={() => {
                          const nextVal = transaction.verified_with_bank === 'Yes' ? 'No' : 'Yes';
                          updateUserTransactionCell(transaction.id, 'verified_with_bank', nextVal);
                        }}
                        className="text-[10px] text-rose-700 hover:underline"
                      >
                        Toggle Manual
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Amount Status</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                      transaction.amount_confirmed === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {transaction.amount_confirmed}
                    </span>
                    <button
                      onClick={() => {
                        const nextVal = transaction.amount_confirmed === 'Confirmed' ? 'Unconfirmed' : 'Confirmed';
                        updateUserTransactionCell(transaction.id, 'amount_confirmed', nextVal);
                      }}
                      className="text-[10px] text-rose-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
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
                    <div key={b.id} className="p-2.5 rounded-lg border border-blue-100 bg-blue-50/50 text-xs flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-950">{b.id}</span>
                          <span className="text-[11px] text-slate-500">{b.value_date}</span>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {b.debit > 0 ? `Debit: -${b.debit.toFixed(2)}` : `Credit: +${b.credit.toFixed(2)}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 mt-1 line-clamp-1 font-mono">{b.narration}</p>
                        {b.reference_no && <span className="text-[10px] text-slate-500">Ref: {b.reference_no}</span>}
                      </div>

                      <button
                        onClick={() => unlinkTxnBank(transaction.id, b.id)}
                        className="text-slate-400 hover:text-rose-700 p-1"
                        title="Unlink bank line"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
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
                  {txnDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate font-medium text-slate-800">{doc.file_name}</span>
                      </div>
                      <a
                        href={doc.download_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-700 text-[11px] hover:underline shrink-0 ml-2"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Admin Approval Decision Bar */}
          {currentRole === 'Admin' && (
            <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-rose-700" />
                <span>Admin Approval Panel ({currentUser.full_name})</span>
              </h4>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Optional approval/rejection note..."
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  className="flex-1 bg-white border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-600 w-full"
                />

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  {!layer2 && (
                    <button
                      onClick={() => handleApprove(2)}
                      className="px-4 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-bold hover:bg-rose-800 shadow-sm shrink-0"
                    >
                      Layer 2 Approve (Ready for Accounting)
                    </button>
                  )}

                  {layer2 && !layer3 && (
                    <button
                      onClick={() => handleApprove(3)}
                      className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 shadow-sm shrink-0"
                    >
                      Layer 3 Review & Close
                    </button>
                  )}

                  <button
                    onClick={() => handleReject(layer2 ? 3 : 2)}
                    className="px-3 py-1.5 bg-slate-200 text-rose-900 rounded-lg text-xs font-semibold hover:bg-rose-200 shrink-0"
                  >
                    Reject
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
                        <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
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

        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
          >
            Close Board
          </button>
        </div>

      </div>
    </div>
  );
};
