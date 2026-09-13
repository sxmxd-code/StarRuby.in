import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, BankTransaction } from '../../types/database';
import { getMatchCandidatesForUserTxn, MatchCandidate } from '../../lib/matching';
import { GitMerge, Check, AlertCircle, Sparkles, Filter, ExternalLink, ShieldAlert, Landmark, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export const MatchModule: React.FC = () => {
  const {
    scopedUserTransactions,
    scopedBankTransactions,
    accounts,
    partiesMap,
    txnBankLinks,
    closeInMatchTab,
    currentRole,
    activeCompanyId,
  } = useApp();

  // Filter user transactions that need matching or are open/in_approval
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [verifiedToggle, setVerifiedToggle] = useState<'Yes' | 'No'>('Yes');
  const [closeNote, setCloseNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');

  // Filterable user transactions (scoped by company/role)
  const openUserTxns = useMemo(() => {
    return scopedUserTransactions.filter(t => {
      if (statusFilter === 'all') return true;
      return t.status === statusFilter;
    });
  }, [scopedUserTransactions, statusFilter]);

  // Active selected transaction
  const selectedTxn = useMemo(() => {
    if (!selectedTxnId) return openUserTxns[0] || null;
    return scopedUserTransactions.find(t => t.id === selectedTxnId) || null;
  }, [selectedTxnId, openUserTxns, scopedUserTransactions]);

  // Compute match candidates for selected transaction
  const candidates: MatchCandidate[] = useMemo(() => {
    if (!selectedTxn) return [];
    const partyName = selectedTxn.party_id ? partiesMap.get(selectedTxn.party_id)?.system_name : selectedTxn.party_name_raw;
    return getMatchCandidatesForUserTxn(selectedTxn, scopedBankTransactions, partyName, 7, 0.6);
  }, [selectedTxn, scopedBankTransactions, partiesMap]);

  const toggleBankSelection = (bankId: string) => {
    setSelectedBankIds(prev => {
      const next = new Set(prev);
      if (next.has(bankId)) next.delete(bankId);
      else next.add(bankId);
      return next;
    });
  };

  const handleCloseTransaction = () => {
    if (!selectedTxn) return;

    if (currentRole === 'Staff') {
      alert('Staff users can view match candidates but cannot close transactions. Please ask a Manager, Accountant or Admin.');
      return;
    }

    const linkedIds = Array.from(selectedBankIds);
    closeInMatchTab(selectedTxn.id, linkedIds, verifiedToggle, closeNote);

    setFeedback(`Success: Transaction ${selectedTxn.id} closed at Layer 1 and moved to Admin Approvals!`);
    setSelectedBankIds(new Set());
    setCloseNote('');
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
            <GitMerge className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Match & Reconcile (Layer 1 Approval)</h1>
            <p className="text-xs text-slate-500">
              Select User Transaction &bull; Review Bank Candidates by Confidence % &bull; Close with links or without bank data
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-semibold">Filter:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800"
          >
            <option value="open">Open (Needs Layer 1)</option>
            <option value="in_approval">In Approval</option>
            <option value="approved">Approved</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Main 2-Column Matching Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: User Transactions Queue (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[750px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              User Transactions ({openUserTxns.length})
            </h3>
            <span className="text-[11px] text-slate-500">Pick one to match</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {openUserTxns.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No user transactions matching this filter.
              </div>
            ) : (
              openUserTxns.map(t => {
                const isSelected = selectedTxn?.id === t.id;
                const party = t.party_id ? partiesMap.get(t.party_id) : null;
                const existingLinks = txnBankLinks.filter(l => l.user_txn_id === t.id);

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTxnId(t.id);
                      // Pre-populate already linked bank ids if any
                      setSelectedBankIds(new Set(existingLinks.map(l => l.bank_txn_id)));
                    }}
                    className={`p-4 cursor-pointer transition ${
                      isSelected
                        ? 'bg-rose-50/90 border-l-4 border-rose-600 shadow-inner'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-rose-950">{t.id}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{t.date_of_transaction}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 truncate max-w-[190px]">
                        {party?.system_name || t.party_name_raw}
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-900 tabular-nums">
                        {t.currency} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80 text-[10px]">
                      <span className={`px-1.5 py-0.2 rounded font-bold ${
                        t.amount_confirmed === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.amount_confirmed}
                      </span>

                      <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                        t.status === 'approved' ? 'text-emerald-700' :
                        t.status === 'in_approval' ? 'text-amber-700' : 'text-slate-500'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>

                      {existingLinks.length > 0 && (
                        <span className="text-blue-700 font-semibold font-mono">
                          {existingLinks.length} bank link(s)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Candidate Bank Statement Entries & Close Box (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col justify-between">
          
          {selectedTxn ? (
            <>
              {/* Selected Transaction Summary Header */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50/80 via-white to-slate-50 border border-rose-200/80 shadow-xs space-y-2 text-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-rose-800 text-sm font-mono">{selectedTxn.id}</span>
                    <span className="text-xs text-slate-500">&bull; {selectedTxn.date_of_transaction}</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
                    {selectedTxn.currency} {selectedTxn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="text-xs">
                  <span className="text-slate-500">Party:</span>{' '}
                  <strong className="text-slate-900 font-bold">
                    {partiesMap.get(selectedTxn.party_id || '')?.system_name || selectedTxn.party_name_raw}
                  </strong>
                </div>

                {selectedTxn.description && (
                  <p className="text-[11px] text-slate-600 italic">"{selectedTxn.description}"</p>
                )}
              </div>

              {/* Confidence Candidate List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Bank Statement Candidates (± 7 Days, Confidence Ranked)</span>
                  </h3>
                  <span className="text-[10px] text-slate-500">{candidates.length} candidate(s)</span>
                </div>

                {candidates.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-xs text-slate-400 space-y-2">
                    <p>No matching bank statement lines found within ± 7 days.</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      Note: You can still CLOSE this transaction right now without bank data!
                    </p>
                  </div>
                ) : (
                  candidates.map(c => {
                    const isChecked = selectedBankIds.has(c.bankTxn.id);
                    const bAmount = selectedTxn.direction === 'Payment' ? c.bankTxn.debit : c.bankTxn.credit;

                    return (
                      <div
                        key={c.bankTxn.id}
                        onClick={() => toggleBankSelection(c.bankTxn.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition text-xs space-y-2 ${
                          isChecked
                            ? 'bg-blue-50/90 border-blue-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold text-blue-900 font-mono">{c.bankTxn.id}</span>
                            <span className="text-[11px] text-slate-500">{c.bankTxn.value_date}</span>
                          </div>

                          {/* Confidence Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.confidenceScore >= 80 ? 'bg-emerald-100 text-emerald-800' :
                            c.confidenceScore >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {c.confidenceScore}% Confidence
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[11px] text-slate-800 max-w-[280px] truncate" title={c.bankTxn.narration}>
                            {c.bankTxn.narration}
                          </p>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {c.bankTxn.currency} {bAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Match Reasons */}
                        {c.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {c.reasons.map((r, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-100/60 text-blue-800 rounded">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Close Action Box (Layer 1 Approval) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase">
                      Execute Layer 1 Closing
                    </h4>
                    <span className="text-[11px] text-slate-500 block">
                      {selectedBankIds.size > 0
                        ? `${selectedBankIds.size} bank line(s) selected for many-to-many link`
                        : 'No bank lines selected. Closing with verified_with_bank = No.'}
                    </span>
                  </div>

                  {/* Verified With Bank Toggle */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-600 font-semibold">Verified with Bank?</span>
                    <button
                      type="button"
                      onClick={() => setVerifiedToggle(prev => (prev === 'Yes' ? 'No' : 'Yes'))}
                      className={`px-3 py-1 rounded font-bold text-xs border ${
                        verifiedToggle === 'Yes' ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                    >
                      {verifiedToggle}
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Optional closing comment / note..."
                  value={closeNote}
                  onChange={e => setCloseNote(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                />

                <div className="flex items-center justify-end space-x-3 pt-1">
                  {currentRole === 'Staff' ? (
                    <div className="w-full sm:w-auto px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Staff View-Only: Closing transactions (Layer 1) is reserved for Manager, Accountant, or Admin.</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleCloseTransaction}
                      disabled={selectedTxn.status !== 'open'}
                      className="w-full sm:w-auto px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {selectedTxn.status !== 'open'
                          ? 'Transaction Already Closed'
                          : selectedBankIds.size > 0
                          ? `Close & Link (${selectedBankIds.size} Bank Line)`
                          : 'Close Without Bank Links (Ready for Approvals)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-slate-400 text-xs">
              Select a user transaction from the left queue to begin matching.
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
