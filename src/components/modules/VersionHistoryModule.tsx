import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { History, RotateCcw, CheckCircle, ShieldAlert } from 'lucide-react';

export const VersionHistoryModule: React.FC = () => {
  const { recordVersions, restoreCellVersion, currentRole } = useApp();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRestore = (vId: number) => {
    if (!window.confirm('Are you sure you want to restore this previous cell value? A new version row will be created recording this restore.')) {
      return;
    }
    const res = restoreCellVersion(vId);
    setFeedback(res.message);
    setTimeout(() => setFeedback(null), 4000);
  };

  const canRestore = currentRole === 'Admin' || currentRole === 'Accountant' || currentRole === 'Manager';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <History className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Cell-Level Version History & Audit</h1>
            <p className="text-xs text-slate-500">
              Rule 3: Every change has a history &bull; Every modified cell generates an immutable audit row with 1-click restore
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Audit Delta Log ({recordVersions.length} entries)
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">table: record_versions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 uppercase text-[10px] text-slate-700 border-b">
              <tr>
                <th className="p-3">Ver #</th>
                <th className="p-3">Table Name</th>
                <th className="p-3">Record ID</th>
                <th className="p-3">Cell (Column)</th>
                <th className="p-3">Old Value</th>
                <th className="p-3">New Value</th>
                <th className="p-3">Changed By</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {recordVersions.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-800">#{v.id}</td>
                  <td className="p-3 font-mono text-rose-950 font-semibold">{v.table_name}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{v.record_id}</td>
                  <td className="p-3 font-mono text-slate-700 font-semibold">{v.column_name}</td>
                  <td className="p-3 text-rose-800 bg-rose-50/50 max-w-[150px] truncate" title={v.old_value}>
                    {v.old_value || '<empty>'}
                  </td>
                  <td className="p-3 text-emerald-800 bg-emerald-50/50 max-w-[150px] truncate font-semibold" title={v.new_value}>
                    {v.new_value}
                  </td>
                  <td className="p-3 font-medium text-slate-700">{v.changed_by}</td>
                  <td className="p-3 text-slate-500 font-mono text-[10px]">
                    {new Date(v.changed_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    {canRestore && v.old_value && !v.column_name.includes('DELETED') ? (
                      <button
                        onClick={() => handleRestore(v.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold inline-flex items-center space-x-1"
                        title="Restore previous value"
                      >
                        <RotateCcw className="w-3 h-3 text-rose-700" />
                        <span>Restore</span>
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
