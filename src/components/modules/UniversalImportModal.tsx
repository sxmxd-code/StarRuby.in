import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useApp } from '../../context/AppContext';
import {
  parseDelimitedText,
  fetchGoogleSheetCsv,
  extractLinesFromPdf,
  parseBankStatementDelimitedRows,
  parseBankStatementPdfLines,
  parseUserDelimitedRows,
  parseUserPdfLines,
  downloadSampleCsvTemplate,
  ParsedBankRow,
  ParsedUserRow,
} from '../../lib/importers';
import { formatDisplayDate } from '../../lib/formatters';
import { normalizeAlias } from '../../lib/alias';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  FileCode,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  Sparkles,
  Link as LinkIcon,
  ClipboardPaste,
  ShieldAlert,
  ArrowRight,
  CreditCard,
} from 'lucide-react';

interface UniversalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'bank' | 'user';
  selectedAccountId: string;
  onSuccess?: (count: number) => void;
}

export const UniversalImportModal: React.FC<UniversalImportModalProps> = ({
  isOpen,
  onClose,
  mode,
  selectedAccountId,
  onSuccess,
}) => {
  const {
    accounts,
    scopedAccounts,
    parties,
    addParty,
    scopedBankTransactions,
    scopedUserTransactions,
    addBankTransactionsBatch,
    addUserTransactionsBatch,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'csv' | 'sheets' | 'pdf'>('csv');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Staged Preview Rows
  const [bankRows, setBankRows] = useState<ParsedBankRow[]>([]);
  const [userRows, setUserRows] = useState<ParsedUserRow[]>([]);

  // Controls
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'duplicates' | 'errors'>('all');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Google Sheets Inputs
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [pastedText, setPastedText] = useState('');

  // Target Account state
  const availableAccounts = scopedAccounts.length > 0 ? scopedAccounts : accounts;
  const [targetAccountId, setTargetAccountId] = useState<string>(
    selectedAccountId || availableAccounts[0]?.id || ''
  );

  useEffect(() => {
    if (selectedAccountId) {
      setTargetAccountId(selectedAccountId);
    } else if (!targetAccountId && availableAccounts[0]?.id) {
      setTargetAccountId(availableAccounts[0].id);
    }
  }, [selectedAccountId, availableAccounts, targetAccountId]);

  // Freeze background scrolling when modal is active
  useBodyScrollLock(isOpen);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentAccount = accounts.find(a => a.id === targetAccountId) || availableAccounts[0];

  // Current Rows & Calculations (Unconditional Hooks)
  const currentRows = mode === 'bank' ? bankRows : userRows;
  const totalCount = currentRows.length;
  const validCount = currentRows.filter(r => r.valid && !r.isDuplicate).length;
  const duplicateCount = currentRows.filter(r => r.valid && r.isDuplicate).length;
  const errorCount = currentRows.filter(r => !r.valid).length;

  const filteredDisplayRows = useMemo(() => {
    return currentRows.map((r, originalIndex) => ({ row: r, originalIndex })).filter(({ row }) => {
      if (filterView === 'valid') return row.valid && !row.isDuplicate;
      if (filterView === 'duplicates') return row.valid && row.isDuplicate;
      if (filterView === 'errors') return !row.valid;
      return true;
    });
  }, [currentRows, filterView]);

  const importableCount = useMemo(() => {
    return currentRows.filter(r => {
      if (!r.valid) return false;
      if (skipDuplicates && r.isDuplicate) return false;
      return true;
    }).length;
  }, [currentRows, skipDuplicates]);

  // ALL HOOKS COMPLETE — SAFE TO CONDITIONAL RETURN AFTER HOOKS
  if (!isOpen) return null;

  // ----------------------------------------------------------------------------
  // TAB 1: CSV FILE UPLOADER
  // ----------------------------------------------------------------------------
  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus(`Reading CSV file: ${file.name}...`);
    setErrorFeedback(null);

    try {
      const text = await file.text();
      const matrix = parseDelimitedText(text);

      if (matrix.length < 2) {
        throw new Error('CSV file must have a header row and at least 1 transaction row.');
      }

      if (mode === 'bank') {
        const parsed = parseBankStatementDelimitedRows(
          matrix,
          targetAccountId,
          scopedBankTransactions,
          accounts
        );
        setBankRows(parsed);
      } else {
        const parsed = parseUserDelimitedRows(
          matrix,
          targetAccountId,
          scopedUserTransactions,
          accounts,
          parties
        );
        setUserRows(parsed);
      }
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      setErrorFeedback(err.message || 'Failed to parse CSV file.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // ----------------------------------------------------------------------------
  // TAB 2: GOOGLE SHEETS INGESTION (URL & PASTE)
  // ----------------------------------------------------------------------------
  const handleFetchGoogleSheet = async () => {
    if (!sheetsUrl.trim()) {
      setErrorFeedback('Please paste a valid Google Sheets URL.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Connecting to Google Sheets & fetching live data...');
    setErrorFeedback(null);

    try {
      const csvText = await fetchGoogleSheetCsv(sheetsUrl.trim());
      const matrix = parseDelimitedText(csvText);

      if (matrix.length < 2) {
        throw new Error('Google Sheet returned empty or has no data rows.');
      }

      if (mode === 'bank') {
        const parsed = parseBankStatementDelimitedRows(
          matrix,
          targetAccountId,
          scopedBankTransactions,
          accounts
        );
        setBankRows(parsed);
      } else {
        const parsed = parseUserDelimitedRows(
          matrix,
          targetAccountId,
          scopedUserTransactions,
          accounts,
          parties
        );
        setUserRows(parsed);
      }
    } catch (err: any) {
      console.error('Google Sheets Error:', err);
      setErrorFeedback(err.message || 'Failed to import Google Sheet.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      setErrorFeedback('Please paste copied table cells into the text box.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Parsing pasted cells...');
    setErrorFeedback(null);

    try {
      const matrix = parseDelimitedText(pastedText.trim());
      if (matrix.length === 0) {
        throw new Error('Could not identify table rows in pasted text.');
      }

      if (mode === 'bank') {
        const parsed = parseBankStatementDelimitedRows(
          matrix,
          targetAccountId,
          scopedBankTransactions,
          accounts
        );
        setBankRows(parsed);
      } else {
        const parsed = parseUserDelimitedRows(
          matrix,
          targetAccountId,
          scopedUserTransactions,
          accounts,
          parties
        );
        setUserRows(parsed);
      }
    } catch (err: any) {
      console.error('Pasted Text Parse Error:', err);
      setErrorFeedback(err.message || 'Failed to parse pasted table content.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // ----------------------------------------------------------------------------
  // TAB 3: PDF STATEMENT EXTRACTION (LOCAL AI/OCR PARSER)
  // ----------------------------------------------------------------------------
  const handlePdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus(`Parsing PDF Statement (${file.name})...`);
    setErrorFeedback(null);

    try {
      const lines = await extractLinesFromPdf(file);
      if (lines.length === 0) {
        throw new Error('No readable text found in PDF. If this is a scanned photo, please use Gemini OCR or export CSV from your online banking portal.');
      }

      setProcessingStatus(`Extracted ${lines.length} lines from PDF. Parsing statement ledger entries...`);

      if (mode === 'bank') {
        const parsed = parseBankStatementPdfLines(
          lines,
          targetAccountId,
          scopedBankTransactions,
          accounts
        );
        if (parsed.length === 0) {
          throw new Error('No transaction line items identified in PDF. Check if this is a supported bank statement format.');
        }
        setBankRows(parsed);
      } else {
        const parsed = parseUserPdfLines(
          lines,
          targetAccountId,
          scopedUserTransactions,
          accounts,
          parties
        );
        if (parsed.length === 0) {
          throw new Error('No transaction line items identified in PDF.');
        }
        setUserRows(parsed);
      }
    } catch (err: any) {
      console.error('PDF Extraction Error:', err);
      setErrorFeedback(err.message || 'Failed to extract transactions from PDF.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // ----------------------------------------------------------------------------
  // ROW REMOVAL & CONTROLS
  // ----------------------------------------------------------------------------
  const removeRow = (index: number) => {
    if (mode === 'bank') {
      setBankRows(prev => prev.filter((_, i) => i !== index));
    } else {
      setUserRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const clearStaged = () => {
    setBankRows([]);
    setUserRows([]);
    setErrorFeedback(null);
  };

  // ----------------------------------------------------------------------------
  // COMMIT IMPORT TO DATABASE
  // ----------------------------------------------------------------------------
  const handleCommitImport = () => {
    if (importableCount === 0) return;

    if (!targetAccountId) {
      setErrorFeedback('Please select a target Bank Account before importing.');
      return;
    }

    if (mode === 'bank') {
      const candidates = bankRows.filter(r => {
        if (!r.valid) return false;
        if (skipDuplicates && r.isDuplicate) return false;
        return true;
      });

      const toInsert = candidates.map(r => ({
        account_id: r.account_id || targetAccountId,
        value_date: r.value_date,
        narration: r.narration,
        party_name_raw: r.party_name || undefined,
        reference_no: r.reference_no,
        debit: r.debit,
        credit: r.credit,
        currency: currentAccount?.account_currency || 'INR',
        balance_after: r.balance_after,
        description: r.description,
        source: (activeTab === 'pdf' ? 'manual' : 'csv') as 'manual' | 'csv',
      }));

      const created = addBankTransactionsBatch(toInsert);
      if (onSuccess) onSuccess(created.length);
      onClose();
    } else {
      const candidates = userRows.filter(r => {
        if (!r.valid) return false;
        if (skipDuplicates && r.isDuplicate) return false;
        return true;
      });

      // 1. Auto-register any new parties in the database master
      const partyMap = new Map<string, string>(); // normalizedName -> partyId
      parties.forEach(p => {
        if (p.system_name) partyMap.set(normalizeAlias(p.system_name), p.id);
        if (p.party_name) partyMap.set(normalizeAlias(p.party_name), p.id);
        if (p.party_name_raw) {
          const rawArr = Array.isArray(p.party_name_raw) ? p.party_name_raw : [p.party_name_raw];
          rawArr.forEach(item => partyMap.set(normalizeAlias(item), p.id));
        }
      });

      candidates.forEach(r => {
        const rawName = r.party_name ? r.party_name.trim() : '';
        if (!rawName) return;
        const norm = normalizeAlias(rawName);
        if (!partyMap.has(norm)) {
          const created = addParty({
            system_name: rawName,
            party_name: rawName,
            party_name_raw: rawName,
          });
          partyMap.set(norm, created.id);
        }
      });

      // 2. Map user transactions to resolved party IDs
      const toInsert = candidates.map(r => {
        const accId = r.account_id || targetAccountId;
        const acc = accounts.find(a => a.id === accId);
        const curr = acc?.account_currency || currentAccount?.account_currency || 'INR';
        const rate = r.exchange_rate;
        const inr = rate && rate > 0 ? Number((r.amount * rate).toFixed(2)) : undefined;

        const rowPartyName = r.party_name ? r.party_name.trim() : '';
        const norm = normalizeAlias(rowPartyName);
        const resolvedPartyId = norm ? partyMap.get(norm) : undefined;

        return {
          account_id: accId,
          party_id: resolvedPartyId,
          party_name_raw: rowPartyName,
          date_of_transaction: r.date,
          currency: curr,
          amount: r.amount,
          amount_confirmed: r.amount_confirmed,
          direction: r.direction,
          exchange_rate: rate,
          amount_in_inr: inr,
          description: r.description,
          verified_with_bank: 'No' as const,
          source: (activeTab === 'pdf' ? 'manual' : 'csv') as 'manual' | 'csv',
        };
      });

      const created = addUserTransactionsBatch(toInsert);
      if (onSuccess) onSuccess(created.length);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Clean dark backdrop without blur to focus 100% on the active modal */}
      <div
        className="fixed inset-0 bg-slate-950/75 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-rose-100 text-rose-800 rounded-xl">
              <Upload className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <h3 className="text-base font-bold font-serif text-slate-900">
                  {mode === 'bank' ? 'Bulk Bank Statement Transactions Ingestion' : 'Bulk User Transactions Ingestion'}
                </h3>

                {/* Target Account Badge / Switcher */}
                {availableAccounts.length > 0 ? (
                  <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg text-xs">
                    <CreditCard className="w-3.5 h-3.5 text-rose-700" />
                    <span className="text-[10px] font-bold text-rose-900 uppercase">Target Account:</span>
                    <select
                      value={targetAccountId}
                      onChange={e => setTargetAccountId(e.target.value)}
                      className="bg-transparent text-rose-900 font-bold text-xs focus:outline-none cursor-pointer"
                    >
                      {availableAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.id} &bull; {a.bank_name} ({a.account_currency})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                    No Accounts Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-channel ingestion &bull; CSV, Google Sheets, PDF statements &bull; Live &plusmn; 7 Days Duplicate Scanner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="px-6 pt-3 border-b border-slate-100 flex items-center justify-between bg-white flex-wrap gap-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('csv')}
              className={`flex items-center space-x-2 pb-3 px-3 border-b-2 font-semibold text-xs transition cursor-pointer ${
                activeTab === 'csv'
                  ? 'border-rose-600 text-rose-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>1. CSV File</span>
            </button>
            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center space-x-2 pb-3 px-3 border-b-2 font-semibold text-xs transition cursor-pointer ${
                activeTab === 'sheets'
                  ? 'border-rose-600 text-rose-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>2. Google Sheets (URL / Paste)</span>
            </button>
            <button
              onClick={() => setActiveTab('pdf')}
              className={`flex items-center space-x-2 pb-3 px-3 border-b-2 font-semibold text-xs transition cursor-pointer ${
                activeTab === 'pdf'
                  ? 'border-rose-600 text-rose-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 text-purple-600" />
              <span>3. PDF Statement (OCR &amp; AI)</span>
            </button>
          </div>

          <button
            onClick={() => downloadSampleCsvTemplate(mode)}
            className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition border border-slate-200 cursor-pointer mb-2"
            title="Download formatted CSV template with valid sample rows"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Sample Template</span>
          </button>
        </div>

        {/* Modal Body / Active Ingestion Channel */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Warning if no account */}
          {availableAccounts.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>No bank accounts are registered in the system yet. Please configure bank accounts in Masters & Setup before importing transactions.</span>
            </div>
          )}

          {/* TAB 1: CSV INGESTION */}
          {activeTab === 'csv' && currentRows.length === 0 && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-center hover:bg-slate-100/70 transition">
                <FileCode className="w-10 h-10 text-rose-600 mx-auto mb-2" />
                <label className="text-sm text-rose-700 font-bold hover:underline cursor-pointer block">
                  <span>{isProcessing ? 'Processing CSV...' : 'Select or Drop CSV File Here'}</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvFile}
                    className="hidden"
                    disabled={isProcessing || availableAccounts.length === 0}
                  />
                </label>
                <p className="text-xs text-slate-400 mt-1">
                  Standard format: {mode === 'bank'
                    ? 'Account_ID, Date, Narration, Reference_No, Debit, Credit, Balance_After'
                    : 'Account_ID, Party_System_Name, Date, Amount, Confirmed_Status, Direction, Exchange_Rate, Description'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE SHEETS */}
          {activeTab === 'sheets' && currentRows.length === 0 && (
            <div className="space-y-4">
              {/* Option A: Direct URL */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <LinkIcon className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    Option A: Sync via Live Google Sheets URL
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={sheetsUrl}
                    onChange={e => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit#gid=0"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                  <button
                    onClick={handleFetchGoogleSheet}
                    disabled={isProcessing || !sheetsUrl.trim() || availableAccounts.length === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{isProcessing ? 'Fetching...' : 'Fetch Live Sheet'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800/80">
                  Ensure the sheet is set to "Anyone with the link can view". StarRuby directly parses the live sheet without storing private credentials.
                </p>
              </div>

              {/* Option B: Copy Paste */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ClipboardPaste className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Option B: Paste Cells from Google Sheets (Ctrl+V)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Tab-separated or comma-separated</span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder={`Paste cells copied directly from Google Sheets here...\nDate\tNarration\tDebit\tCredit\n28-Sep-2026\tBangkok Gems\t35000\t0`}
                  rows={4}
                  className="w-full p-3 font-mono text-[11px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleParsePastedText}
                    disabled={isProcessing || !pastedText.trim() || availableAccounts.length === 0}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    Parse Pasted Table
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PDF EXTRACTION */}
          {activeTab === 'pdf' && currentRows.length === 0 && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-purple-300 rounded-2xl bg-purple-50/40 text-center hover:bg-purple-50/80 transition">
                <FileText className="w-10 h-10 text-purple-700 mx-auto mb-2" />
                <label className="text-sm text-purple-800 font-bold hover:underline cursor-pointer block">
                  <span>{isProcessing ? 'Analyzing & Extracting PDF...' : 'Select or Drop Bank Statement / Invoices PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfFile}
                    className="hidden"
                    disabled={isProcessing || availableAccounts.length === 0}
                  />
                </label>
                <div className="flex items-center justify-center space-x-1.5 mt-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                  <span className="text-xs font-semibold text-purple-900">
                    High-Accuracy PDF Table Parser
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 max-w-lg mx-auto">
                  Automatically extracts transaction rows from HDFC, ICICI, SBI, Axis, Kotak, Emirates NBD, HSBC, Citibank, and other bank statements.
                </p>
              </div>
            </div>
          )}

          {/* Progress Banner */}
          {isProcessing && (
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex items-center space-x-3 text-xs text-slate-700 font-semibold">
              <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
              <span>{processingStatus || 'Processing financial data...'}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorFeedback && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorFeedback}</span>
              </div>
              <button onClick={() => setErrorFeedback(null)} className="text-rose-500 hover:text-rose-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* PREVIEW & VERIFICATION WORKBENCH */}
          {currentRows.length > 0 && (
            <div className="space-y-4">
              {/* Metrics & Control Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                
                {/* Status Badges */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setFilterView('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      filterView === 'all'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white border text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilterView('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                      filterView === 'valid'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid ({validCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterView('duplicates')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                      filterView === 'duplicates'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Duplicates ({duplicateCount})</span>
                  </button>
                  {errorCount > 0 && (
                    <button
                      onClick={() => setFilterView('errors')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                        filterView === 'errors'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Errors ({errorCount})</span>
                    </button>
                  )}
                </div>

                {/* Duplicate Handling Toggle */}
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={e => setSkipDuplicates(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="flex items-center space-x-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Skip Duplicates (&plusmn;7 Days)</span>
                    </span>
                  </label>

                  <button
                    onClick={clearStaged}
                    className="text-xs text-rose-700 hover:underline font-semibold cursor-pointer"
                  >
                    Upload Another File
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto shadow-inner bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                    <tr>
                      <th className="p-2.5 w-16 text-center">Status</th>
                      <th className="p-2.5 w-24">Date</th>
                      {mode === 'bank' ? (
                        <>
                          <th className="p-2.5 w-36">Party (Bank Alias)</th>
                          <th className="p-2.5">Narration / Particulars</th>
                          <th className="p-2.5 w-28">Ref / Chq</th>
                          <th className="p-2.5 w-24 text-right">Debit</th>
                          <th className="p-2.5 w-24 text-right">Credit</th>
                          <th className="p-2.5 w-24 text-right">Balance</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2.5">Party System Name</th>
                          <th className="p-2.5 w-24">Direction</th>
                          <th className="p-2.5 w-24 text-right">Amount</th>
                          <th className="p-2.5 w-20 text-center">Status</th>
                          <th className="p-2.5">Description</th>
                        </>
                      )}
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                          No rows match the selected filter view.
                        </td>
                      </tr>
                    ) : (
                      filteredDisplayRows.map(({ row, originalIndex }) => {
                        const isDup = row.valid && row.isDuplicate;
                        const isErr = !row.valid;

                        return (
                          <tr
                            key={originalIndex}
                            className={`transition hover:bg-slate-50/70 ${
                              isErr
                                ? 'bg-rose-50/40 text-rose-900'
                                : isDup
                                ? 'bg-amber-50/40 text-amber-950'
                                : 'text-slate-800'
                            }`}
                          >
                            {/* Status Column */}
                            <td className="p-2.5 text-center">
                              {isErr ? (
                                <span title={row.error} className="inline-flex">
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                </span>
                              ) : isDup ? (
                                <span title={row.duplicateReason} className="inline-flex">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                                </span>
                              ) : (
                                <span className="inline-flex">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                </span>
                              )}
                            </td>

                            {/* Mode Specific Columns */}
                            {mode === 'bank' ? (
                              <>
                                <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                                  {formatDisplayDate((row as ParsedBankRow).value_date)}
                                </td>
                                <td className="p-2.5 font-medium max-w-[140px] truncate" title={(row as ParsedBankRow).party_name || 'Unspecified'}>
                                  {(row as ParsedBankRow).party_name ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-200">
                                      {(row as ParsedBankRow).party_name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">-</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-medium max-w-xs truncate" title={(row as ParsedBankRow).narration}>
                                  <div>
                                    <span>{(row as ParsedBankRow).narration}</span>
                                    {isDup && (
                                      <span className="block text-[10px] text-amber-700 font-normal">
                                        ⚠️ {(row as ParsedBankRow).duplicateReason}
                                      </span>
                                    )}
                                    {isErr && (
                                      <span className="block text-[10px] text-rose-600 font-normal">
                                        ❌ {row.error}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5 font-mono text-[11px] text-slate-500">
                                  {(row as ParsedBankRow).reference_no || '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-[11px] font-bold text-rose-700">
                                  {(row as ParsedBankRow).debit > 0
                                    ? (row as ParsedBankRow).debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                                    : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-[11px] font-bold text-emerald-700">
                                  {(row as ParsedBankRow).credit > 0
                                    ? (row as ParsedBankRow).credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                                    : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-[11px] text-slate-500">
                                  {(row as ParsedBankRow).balance_after
                                    ? (row as ParsedBankRow).balance_after!.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                                    : '-'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                                  {formatDisplayDate((row as ParsedUserRow).date)}
                                </td>
                                <td className="p-2.5 font-bold text-slate-900 truncate" title={(row as ParsedUserRow).party_name}>
                                  <div>
                                    <span>{(row as ParsedUserRow).party_name || 'General Treasury'}</span>
                                    {isDup && (
                                      <span className="block text-[10px] text-amber-700 font-normal">
                                        ⚠️ {(row as ParsedUserRow).duplicateReason}
                                      </span>
                                    )}
                                    {isErr && (
                                      <span className="block text-[10px] text-rose-600 font-normal">
                                        ❌ {row.error}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    (row as ParsedUserRow).direction === 'Payment'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {(row as ParsedUserRow).direction}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono text-[11px] font-bold text-slate-900">
                                  {(row as ParsedUserRow).amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {(row as ParsedUserRow).amount_confirmed}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-500 truncate max-w-xs text-[11px]">
                                  {(row as ParsedUserRow).description || '-'}
                                </td>
                              </>
                            )}

                            {/* Delete Action */}
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => removeRow(originalIndex)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-200 transition cursor-pointer"
                                title="Remove row from staging"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="text-xs text-slate-500">
            {currentRows.length > 0 ? (
              <span>
                Ready to import: <strong className="text-emerald-800 font-bold">{importableCount}</strong> valid entries
                {skipDuplicates && duplicateCount > 0 && ` (${duplicateCount} duplicates will be skipped)`}.
              </span>
            ) : (
              <span>Select CSV, Google Sheets, or PDF above to begin.</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCommitImport}
              disabled={importableCount === 0 || isProcessing || availableAccounts.length === 0}
              className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Import {importableCount} Entries to Database</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
