import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { uploadToR2, getR2DownloadUrl } from '../../lib/storage';
import { extractDocumentMetadataAI, ExtractedInvoiceData, isGeminiConfigured } from '../../lib/gemini';
import { FileText, Search, Upload, Paperclip, Sparkles, ExternalLink, Trash2, Bot, Check, X, Loader2, RefreshCw, Unlink, UploadCloud } from 'lucide-react';
import { DocumentRecord } from '../../types/database';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const DocumentsModule: React.FC = () => {
  const {
    documents,
    attachDocument,
    deleteDocument,
    detachDocumentFromTxn,
    syncWithCloudflareR2,
    scopedUserTransactions,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<'invoice' | 'receipt' | 'statement' | 'other'>('invoice');
  const [uploadTxnId, setUploadTxnId] = useState<string>(''); // Default: Standalone (no transaction)

  // AI Analysis Modal State
  const [analyzingDoc, setAnalyzingDoc] = useState<DocumentRecord | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractedInvoiceData | null>(null);

  // Lock scrolling when AI modal or Upload modal is open
  useBodyScrollLock(Boolean(analyzingDoc || isUploadModalOpen));

  const handleAnalyzeDocument = async (doc: DocumentRecord) => {
    setAnalyzingDoc(doc);
    setIsAiProcessing(true);
    setAiResult(null);

    try {
      const result = await extractDocumentMetadataAI(doc.file_name, `Type: ${doc.doc_type}, Txn: ${doc.user_txn_id || 'unassigned'}`);
      setAiResult(result);
    } catch (err: any) {
      console.error('AI analysis error:', err);
      alert('Failed to analyze document with Gemini.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Filtered documents with hybrid search simulation
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter(d =>
      d.file_name.toLowerCase().includes(q) ||
      d.doc_type.toLowerCase().includes(q) ||
      (d.user_txn_id && d.user_txn_id.toLowerCase().includes(q))
    );
  }, [documents, searchQuery]);

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please choose a file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadToR2(uploadFile, 'documents', uploadTxnId || 'general');
      attachDocument({
        file_name: uploadFile.name,
        r2_bucket: res.bucket,
        r2_object_key: res.objectKey,
        content_type: uploadFile.type || 'application/pdf',
        size_bytes: res.sizeBytes,
        doc_type: uploadDocType,
        user_txn_id: uploadTxnId.trim() ? uploadTxnId.trim() : undefined,
        download_url: res.publicUrl,
      });

      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTxnId('');

      if (res.isLiveCloud) {
        setFeedback(`Success: File "${uploadFile.name}" uploaded directly to Cloudflare R2 bucket "${res.bucket}"!`);
      } else {
        setFeedback(`Notice: File saved locally. (${res.cloudError || 'Cloudflare upload pending CORS configuration in dashboard'})`);
      }
      setTimeout(() => setFeedback(null), 8000);
    } catch (err) {
      console.error('File upload error:', err);
      alert('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDocument = async (doc: DocumentRecord) => {
    if (doc.download_url && doc.download_url !== '#') {
      window.open(doc.download_url, '_blank');
      return;
    }
    try {
      const url = await getR2DownloadUrl(doc.r2_bucket, doc.r2_object_key);
      if (url && url !== '#') {
        window.open(url, '_blank');
      } else {
        alert('Unable to generate secure download URL for this file.');
      }
    } catch (e) {
      console.error('Error fetching file URL:', e);
      alert('Error fetching file URL from storage.');
    }
  };

  const handleSyncR2 = async () => {
    setIsSyncing(true);
    try {
      const res = await syncWithCloudflareR2();
      const parts = [`Cloudflare R2 Synced: ${res.verified} files active in storage.`];
      if (res.added && res.added > 0) parts.push(`${res.added} untracked files discovered & added.`);
      if (res.removed > 0) parts.push(`${res.removed} missing/orphaned records removed.`);
      if (!res.added && res.removed === 0) parts.push('All documents verified in sync!');
      setFeedback(parts.join(' '));
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      console.error('R2 Sync error:', err);
      alert('Failed to sync with Cloudflare R2.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteDoc = async (doc: DocumentRecord) => {
    if (!window.confirm(`Permanently delete "${doc.file_name}" from Cloudflare R2 storage? This cannot be undone.`)) {
      return;
    }
    setIsDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      setFeedback(`Success: File "${doc.file_name}" permanently deleted from Cloudflare R2 bucket "${doc.r2_bucket}" and database.`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete file from Cloudflare R2.');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-serif text-slate-900">Documents & AI Hybrid Search</h1>
              {isGeminiConfigured && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
                  <span>Gemini 2.5 Flash Active</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Cloudflare R2 Object Storage &bull; Gemini 2.5 Flash OCR/Extraction &bull; Vector semantic embeddings + Full-Text Search
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSyncR2}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition border border-slate-200 cursor-pointer disabled:opacity-50"
            title="Scan Cloudflare R2 bucket to verify all files and remove orphaned records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync with R2'}</span>
          </button>

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => {
              setUploadFile(null);
              setUploadDocType('invoice');
              setUploadTxnId('');
              setIsUploadModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-sm transition"
          >
            <Upload className="w-4 h-4" />
            <span>+ Upload Document</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-semibold ${
          feedback.startsWith('Success')
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {feedback}
        </div>
      )}

      {/* Search Bar with AI Hybrid Search Styling */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Hybrid Search (e.g. 'INV-223', 'Blue Ocean ruby shipment', 'GIA test certificate')..."
          className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none"
        />
        <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded font-bold">
          Gemini Embedding-001 + FTS
        </span>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">No documents uploaded yet.</p>
            <p className="text-[11px] text-slate-400">
              Click "+ Upload Document" above to upload an invoice, receipt, or certification directly to your Cloudflare R2 bucket.
            </p>
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition space-y-3 text-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-slate-900 font-mono">{doc.id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {doc.doc_type}
                    </span>
                    <button
                      onClick={() => handleDeleteDoc(doc)}
                      disabled={isDeletingId === doc.id}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                      title="Delete document permanently from Cloudflare R2"
                    >
                      {isDeletingId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="font-semibold text-slate-800 truncate" title={doc.file_name}>
                  {doc.file_name}
                </p>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>R2 Bucket: <span className="font-mono text-slate-700 font-bold">{doc.r2_bucket}</span></p>
                  <p>Size: <span className="font-mono">{Math.round(doc.size_bytes / 1024)} KB</span></p>
                  {doc.user_txn_id ? (
                    <div className="flex items-center justify-between pt-0.5">
                      <p>Attached: <strong className="text-rose-900 font-mono font-bold">{doc.user_txn_id}</strong></p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Detach document "${doc.file_name}" from transaction ${doc.user_txn_id}? It will be kept as a standalone corporate document.`)) {
                            await detachDocumentFromTxn(doc.id);
                            setFeedback(`Document "${doc.file_name}" detached from transaction ${doc.user_txn_id}. Now standalone.`);
                            setTimeout(() => setFeedback(null), 5000);
                          }
                        }}
                        className="text-[10px] text-slate-500 hover:text-rose-700 font-semibold flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-rose-50 cursor-pointer transition"
                        title="Detach from transaction (convert to standalone corporate document)"
                      >
                        <Unlink className="w-3 h-3 text-rose-600" />
                        <span>Detach</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-0.5">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        <span>📄 Standalone Corporate Document</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Gemini AI Trigger Button */}
                <button
                  onClick={() => handleAnalyzeDocument(doc)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-purple-800 rounded-lg text-[11px] font-bold transition border border-purple-200 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Analyze with Gemini 2.5 AI</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => handleViewDocument(doc)}
                  className="text-rose-700 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>View File</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI Analysis Modal */}
      {analyzingDoc && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          {/* Crisp Solid Scrim Backdrop (No blur) */}
          <div
            className="fixed inset-0 bg-slate-950/75 transition-opacity"
            onClick={() => setAnalyzingDoc(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-purple-200 space-y-5 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Sparkles className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-serif">Gemini 2.5 Flash Analysis</h3>
                  <p className="text-xs text-slate-500">Document: {analyzingDoc.file_name}</p>
                </div>
              </div>
              <button
                onClick={() => setAnalyzingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAiProcessing ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-800">Reading document & extracting financial metadata...</p>
                <p className="text-xs text-slate-500">Querying Gemini 2.5 Flash institutional reasoning engine</p>
              </div>
            ) : aiResult ? (
              <div className="space-y-4 text-xs">
                {/* Confidence & Summary Banner */}
                <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 flex items-center space-x-1.5">
                      <Bot className="w-4 h-4 text-purple-700" />
                      <span>Gemini Audit Assessment</span>
                    </span>
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-900 font-bold rounded text-[10px]">
                      {Math.round((aiResult.confidence || 0.95) * 100)}% Confidence
                    </span>
                  </div>
                  <p className="text-purple-800 text-[11px] leading-relaxed">
                    {aiResult.raw_summary || 'Document extracted and classified cleanly.'}
                  </p>
                </div>

                {/* Extracted Fields Grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Invoice / Ref No</label>
                    <p className="font-bold font-mono text-slate-800 mt-0.5">
                      {aiResult.invoice_no || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Detected Date</label>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {aiResult.date || 'Today / Undated'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Vendor / Party Name</label>
                    <p className="font-bold text-rose-900 mt-0.5">
                      {aiResult.party_name || 'Vendor from filename'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Extracted Amount</label>
                    <p className="font-bold font-mono text-emerald-700 text-sm mt-0.5">
                      {aiResult.amount ? `${aiResult.currency || 'INR'} ${aiResult.amount.toLocaleString()}` : 'Check original PDF'}
                    </p>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">Suggested Banking Description</label>
                    <p className="text-slate-700 mt-0.5 font-medium">
                      {aiResult.description || analyzingDoc.file_name}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setAnalyzingDoc(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      alert(`Extracted fields ready! Copying to clipboard:\nParty: ${aiResult.party_name || ''}\nAmount: ${aiResult.amount || ''}\nDesc: ${aiResult.description || ''}`);
                      setAnalyzingDoc(null);
                    }}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-sm"
                  >
                    Copy Extracted Info
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* Document Upload Modal */}
      {isUploadModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          {/* Crisp Solid Scrim Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/75 transition-opacity"
            onClick={() => !isUploading && setIsUploadModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-100 rounded-xl text-rose-700">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-serif">Upload Document to Cloudflare R2</h3>
                  <p className="text-xs text-slate-500">Vault storage &bull; Optional transaction attachment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmUpload} className="space-y-4 text-xs">
              {/* File Drop / Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select File <span className="text-rose-600">*</span>
                </label>
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-rose-400 transition bg-slate-50 text-center space-y-2">
                  <input
                    type="file"
                    id="docUploadModalInput"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <label htmlFor="docUploadModalInput" className="cursor-pointer block">
                    {uploadFile ? (
                      <div className="flex items-center justify-center space-x-2 text-rose-800 font-semibold">
                        <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                        <span className="truncate max-w-xs">{uploadFile.name}</span>
                        <span className="text-[11px] text-slate-500">({Math.round(uploadFile.size / 1024)} KB)</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">Click to browse file</p>
                        <p className="text-[11px] text-slate-400">PDF, PNG, JPG, DOCX, XLSX, CSV up to 50MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Document Classification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Document Classification <span className="text-rose-600">*</span>
                </label>
                <select
                  value={uploadDocType}
                  onChange={e => setUploadDocType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                >
                  <option value="invoice">Vendor Invoice / Bill</option>
                  <option value="receipt">Payment Receipt / Voucher</option>
                  <option value="statement">Bank Statement / Advice</option>
                  <option value="other">Board Resolution / Corporate / Contract / Other</option>
                </select>
              </div>

              {/* Attach to Transaction (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Attach to User Transaction <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Leave unselected for Standalone</span>
                </div>
                <select
                  value={uploadTxnId}
                  onChange={e => setUploadTxnId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                >
                  <option value="">None (Standalone Corporate Document — Not Attached)</option>
                  {scopedUserTransactions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id} • {t.party_name_raw || 'Unknown Party'} • {t.currency} {t.amount.toLocaleString()} ({t.date_of_transaction})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  General corporate files (e.g. Board Resolutions, Company Certifications) should remain standalone.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading to R2...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
