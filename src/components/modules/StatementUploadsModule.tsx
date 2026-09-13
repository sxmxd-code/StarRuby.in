import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { uploadToR2, getR2DownloadUrl } from '../../lib/storage';
import { CalendarCheck, Upload, FileText, CheckCircle2, AlertCircle, Download, RefreshCw, X, HardDrive } from 'lucide-react';
import { StatementUpload, User } from '../../types/database';

export const StatementUploadsModule: React.FC = () => {
  const {
    scopedAccounts,
    scopedStatementUploads,
    uploadStatementFile,
    allUsers,
    accessLevels,
  } = useApp();

  const [selectedCell, setSelectedCell] = useState<{ accountId: string; month: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const months = [
    { label: 'Jan', value: '2026-01-01' },
    { label: 'Feb', value: '2026-02-01' },
    { label: 'Mar', value: '2026-03-01' },
    { label: 'Apr', value: '2026-04-01' },
    { label: 'May', value: '2026-05-01' },
    { label: 'Jun', value: '2026-06-01' },
    { label: 'Jul', value: '2026-07-01' },
    { label: 'Aug', value: '2026-08-01' },
    { label: 'Sep', value: '2026-09-01' },
    { label: 'Oct', value: '2026-10-01' },
    { label: 'Nov', value: '2026-11-01' },
    { label: 'Dec', value: '2026-12-01' },
  ];

  const filteredAccounts = scopedAccounts;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCell) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadToR2(file, 'statements', `${selectedCell.accountId}/${selectedCell.month.slice(0, 7)}`);
      uploadStatementFile(selectedCell.accountId, selectedCell.month, file.name, res.sizeBytes, res.objectKey);
      setFeedback(`Statement for ${selectedCell.accountId} (${selectedCell.month.slice(0, 7)}) uploaded to Cloudflare R2.`);
      setSelectedCell(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (record: StatementUpload) => {
    if (!record.r2_object_key) {
      alert('No physical file found in storage.');
      return;
    }
    setIsDownloading(true);
    try {
      const url = await getR2DownloadUrl(record.r2_bucket || 'documents', record.r2_object_key);
      if (url && url !== '#') {
        const a = document.createElement('a');
        a.href = url;
        a.download = record.file_name || `${record.account_id}_Statement_${record.statement_month.slice(0, 7)}.pdf`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert('Could not generate download link from Cloudflare R2.');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const activeRecord = selectedCell
    ? scopedStatementUploads.find(s => s.account_id === selectedCell.accountId && s.statement_month === selectedCell.month)
    : null;
  const activeAccount = selectedCell
    ? scopedAccounts.find(a => a.id === selectedCell.accountId)
    : null;
  const uploaderUser = activeRecord?.uploaded_by
    ? allUsers.find((u: User) => u.id === activeRecord.uploaded_by)
    : null;
  const uploaderRole = uploaderUser
    ? accessLevels.find(l => l.id === uploaderUser.access_level_id)?.level_type || 'User'
    : null;
  const isDone = activeRecord?.status === 'uploaded';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
            <CalendarCheck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Statement Uploads Tracker</h1>
            <p className="text-xs text-slate-500">
              Interactive Matrix (Accounts &times; Months) &bull; Cloudflare R2 Storage &bull; Green = Uploaded, Red = Missing
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* MATRIX TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between text-xs pb-2 border-b">
          <span className="font-bold text-slate-800 uppercase tracking-wider">Year 2026 Statement Grid</span>
          <div className="flex items-center space-x-4 text-[11px]">
            <span className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
              <span className="text-slate-600 font-medium">Green = Uploaded</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
              <span className="text-slate-600 font-medium">Red = Missing File</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                <th className="p-3 text-left w-56">Bank Account</th>
                {months.map(m => (
                  <th key={m.value} className="p-2 w-20">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50/50">
                  <td className="p-3 text-left">
                    <span className="font-bold text-slate-900 block">{acc.id}</span>
                    <span className="text-[11px] text-slate-500">{acc.bank_name} ({acc.account_currency})</span>
                  </td>

                  {months.map(m => {
                    const record = scopedStatementUploads.find(s => s.account_id === acc.id && s.statement_month === m.value);
                    const isUploaded = record?.status === 'uploaded';

                    return (
                      <td key={m.value} className="p-2">
                        <button
                          onClick={() => setSelectedCell({ accountId: acc.id, month: m.value })}
                          className={`w-full py-2 px-1 rounded-lg font-bold text-[10px] transition shadow-sm flex flex-col items-center justify-center ${
                            isUploaded
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                          }`}
                          title={isUploaded ? `Uploaded: ${record?.file_name} • Click to view or replace` : 'Statement Missing. Click to upload.'}
                        >
                          {isUploaded ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mb-0.5" />
                              <span className="truncate max-w-[55px]">Done</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 mb-0.5" />
                              <span>Upload</span>
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Upload Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold font-serif text-slate-900 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-rose-600" />
                  {isDone ? 'Bank Statement Details' : 'Upload Bank Statement'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Account: <strong className="text-slate-800">{activeAccount?.bank_name} ({selectedCell.accountId})</strong> &bull; Month: <strong className="text-slate-800">{selectedCell.month.slice(0, 7)}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isDone && activeRecord ? (
              <div className="space-y-4">
                {/* Uploaded File Info Card */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Uploaded & Verified
                    </span>
                    <span className="text-[11px] text-emerald-800 font-mono font-bold">
                      {activeRecord.file_size_bytes ? (activeRecord.file_size_bytes / 1024).toFixed(1) + ' KB' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1 text-slate-800">
                    <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                    <span className="font-semibold text-xs truncate" title={activeRecord.file_name}>
                      {activeRecord.file_name || 'Bank_Statement.pdf'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-emerald-200/60">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Uploaded By:</span>
                      <span className="font-medium text-slate-800">
                        {uploaderUser ? `${uploaderUser.full_name} (${uploaderRole})` : activeRecord.uploaded_by || 'Staff'}
                      </span>
                    </div>
                    {activeRecord.uploaded_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Upload Date:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(activeRecord.uploaded_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage:</span>
                      <span className="font-mono">{activeRecord.r2_bucket || 'documents'} / {activeRecord.r2_object_key || 'local'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => handleDownload(activeRecord)}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloading ? 'Generating Download Link...' : 'Download Statement File'}</span>
                  </button>

                  <div className="relative">
                    <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition border border-slate-200">
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isUploading ? 'animate-spin' : ''}`} />
                      <span>{isUploading ? 'Replacing File in R2...' : 'Replace with New Statement File'}</span>
                      <input type="file" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Replacing will update the file in Cloudflare R2 and record an audit log in Cell History.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Statement for this month has not been uploaded yet.</span>
                </div>

                <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center hover:bg-slate-100/70 transition">
                  <Upload className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                  <label className="text-xs text-rose-700 font-bold hover:underline cursor-pointer block">
                    <span>{isUploading ? 'Uploading to Cloudflare R2...' : 'Select Statement PDF / CSV / Excel'}</span>
                    <input type="file" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                  </label>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Files will be securely stored in Cloudflare R2 (documents)
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedCell(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

