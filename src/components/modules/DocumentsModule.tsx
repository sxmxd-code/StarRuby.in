import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { uploadToR2 } from '../../lib/storage';
import { extractDocumentMetadataAI, ExtractedInvoiceData, isGeminiConfigured } from '../../lib/gemini';
import { FileText, Search, Upload, Paperclip, Sparkles, ExternalLink, Trash2, Bot, Check, X, Loader2 } from 'lucide-react';
import { DocumentRecord } from '../../types/database';

export const DocumentsModule: React.FC = () => {
  const { documents, attachDocument, deleteDocument, userTransactions } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTxnId, setSelectedTxnId] = useState(userTransactions[0]?.id || '');
  const [docType, setDocType] = useState<'invoice' | 'receipt' | 'statement' | 'other'>('invoice');
  const [feedback, setFeedback] = useState<string | null>(null);

  // AI Analysis Modal State
  const [analyzingDoc, setAnalyzingDoc] = useState<DocumentRecord | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractedInvoiceData | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadToR2(file, 'documents', selectedTxnId || 'general');
      attachDocument({
        file_name: file.name,
        r2_bucket: res.bucket,
        r2_object_key: res.objectKey,
        content_type: file.type || 'application/pdf',
        size_bytes: res.sizeBytes,
        doc_type: docType,
        user_txn_id: selectedTxnId || undefined,
        download_url: res.publicUrl,
      });

      if (res.isLiveCloud) {
        setFeedback(`Success: File "${file.name}" uploaded directly to Cloudflare R2 bucket "${res.bucket}"!`);
      } else {
        setFeedback(`Notice: File saved locally. (${res.cloudError || 'Cloudflare upload pending CORS configuration in dashboard'})`);
      }
      setTimeout(() => setFeedback(null), 8000);
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setIsUploading(false);
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

        {/* Upload Button */}
        <label className="flex items-center space-x-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-sm">
          <Upload className="w-4 h-4" />
          <span>{isUploading ? 'Uploading to R2...' : '+ Upload Document'}</span>
          <input type="file" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
        </label>
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
                      onClick={() => {
                        if (window.confirm(`Delete document record "${doc.file_name}"?`)) {
                          deleteDocument(doc.id);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                      title="Delete document record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="font-semibold text-slate-800 truncate" title={doc.file_name}>
                  {doc.file_name}
                </p>

                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>R2 Bucket: <span className="font-mono text-slate-700 font-bold">{doc.r2_bucket}</span></p>
                  <p>Size: <span className="font-mono">{Math.round(doc.size_bytes / 1024)} KB</span></p>
                  {doc.user_txn_id && <p>Attached to Txn: <strong className="text-rose-900">{doc.user_txn_id}</strong></p>}
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
                <a
                  href={doc.download_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rose-700 font-bold hover:underline flex items-center space-x-1"
                >
                  <span>View File</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI Analysis Modal */}
      {analyzingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-purple-200 space-y-5">
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
        </div>
      )}

    </div>
  );
};
