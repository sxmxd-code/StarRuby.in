import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Building, Users, Landmark, Contact, Plus, Check, Shield } from 'lucide-react';
import { Currency } from '../../types/database';

export const MastersModule: React.FC = () => {
  const {
    companies,
    accounts,
    scopedAccounts,
    allUsers,
    accessLevels,
    userCompanies,
    signatories,
    parties,
    addParty,
    assignCompanyToUser,
    removeCompanyFromUser,
    currentRole,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'users' | 'accounts' | 'parties'>('companies');

  // Party Form State
  const [partySystemName, setPartySystemName] = useState('');
  const [partyGroupName, setPartyGroupName] = useState('');
  const [partyCid, setPartyCid] = useState('');
  const [partyBankName, setPartyBankName] = useState('');
  const [partyBankCountry, setPartyBankCountry] = useState('India');
  const [partyAccountNum, setPartyAccountNum] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partySystemName.trim()) {
      alert('Clean Party System Name is required.');
      return;
    }

    const p = addParty({
      system_name: partySystemName.trim(),
      party_name: partySystemName.trim(),
      group_name: partyGroupName.trim() || undefined,
      cid_number: partyCid.trim() || undefined,
      bank_name: partyBankName.trim() || undefined,
      bank_country: partyBankCountry,
      account_number: partyAccountNum.trim() || undefined,
    });

    setFeedback(`Party ${p.id} (${p.system_name}) created successfully!`);
    setPartySystemName('');
    setPartyGroupName('');
    setPartyCid('');
    setPartyBankName('');
    setPartyAccountNum('');
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
            <Building className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Masters & Group Setup</h1>
            <p className="text-xs text-slate-500">
              Companies &bull; Users & Company Scoping &bull; Bank Accounts & Signatories &bull; Parties & CID Numbers
            </p>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('companies')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'companies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Companies ({companies.length})
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Users & Roles ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'accounts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Bank Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveSubTab('parties')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'parties' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Parties ({parties.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* 1. COMPANIES SUBTAB */}
      {activeSubTab === 'companies' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              StarRuby.in Group Companies
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map(c => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900 font-mono text-sm">{c.id}</span>
                  <span className="text-[10px] text-slate-400">Created: {new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{c.full_name}</h3>
                <p className="text-slate-500">{c.email || 'No email registered'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. USERS & ROLES SUBTAB */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Team Users & Company Permissions
              </h2>
              <p className="text-xs text-slate-500">
                Admin assigns which companies each Manager may work with. Admins & Accountant have universal access.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {allUsers.map(u => {
              const role = accessLevels.find(a => a.id === u.access_level_id)?.level_type || 'Staff';
              const assigned = userCompanies.filter(uc => uc.user_id === u.id);

              return (
                <div key={u.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-700">{u.id}</span>
                      <strong className="text-slate-900 text-sm">{u.full_name}</strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        role === 'Admin' ? 'bg-rose-100 text-rose-900' :
                        role === 'Accountant' ? 'bg-emerald-100 text-emerald-900' :
                        role === 'Manager' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {role}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px] block mt-0.5">{u.email}</span>
                  </div>

                  {/* Scoped Companies */}
                  <div className="text-right">
                    {role === 'Admin' || role === 'Accountant' ? (
                      <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded">
                        Access to All Companies (Global)
                      </span>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-500 text-[11px]">Assigned:</span>
                        {assigned.length === 0 ? (
                          <span className="text-rose-600 font-bold text-[11px]">None</span>
                        ) : (
                          assigned.map(a => (
                            <span key={a.company_id} className="bg-slate-100 font-mono font-bold px-1.5 py-0.5 rounded text-[11px]">
                              {a.company_id}
                            </span>
                          ))
                        )}

                        {currentRole === 'Admin' && role === 'Manager' && (
                          <select
                            onChange={e => {
                              if (e.target.value) assignCompanyToUser(u.id, e.target.value);
                            }}
                            className="bg-slate-50 border text-[10px] rounded p-1 ml-2"
                            defaultValue=""
                          >
                            <option value="" disabled>+ Assign Company</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.id}: {c.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. BANK ACCOUNTS SUBTAB */}
      {activeSubTab === 'accounts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Our Bank Accounts & Signatories
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentRole === 'Manager'
                  ? 'Showing accounts belonging to your assigned entity scope.'
                  : 'Admins & Accountant have universal management across all group accounts.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(currentRole === 'Manager' ? scopedAccounts : accounts).map(acc => {
              const comp = companies.find(c => c.id === acc.company_id);
              const sigs = signatories.filter(s => s.account_id === acc.id);

              return (
                <div key={acc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 font-mono text-sm">{acc.id}</span>
                    <span className="font-mono font-bold text-rose-700">{acc.account_currency}</span>
                  </div>
                  <h3 className="font-bold text-slate-900">{acc.bank_name}</h3>
                  <p className="text-slate-600 font-mono">Acc: {acc.account_number}</p>
                  <p className="text-slate-500">Company: {comp?.full_name}</p>
                  {acc.ifsc_code && <p className="text-slate-500 font-mono">IFSC: {acc.ifsc_code}</p>}
                  {acc.iban_number && <p className="text-slate-500 font-mono">IBAN: {acc.iban_number}</p>}

                  <div className="pt-2 border-t text-[11px] text-slate-600">
                    <span className="font-semibold">Signatories:</span>{' '}
                    {sigs.map(s => allUsers.find(u => u.id === s.user_id)?.full_name).join(', ') || 'None assigned'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PARTIES SUBTAB */}
      {activeSubTab === 'parties' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Parties List (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b pb-2">
              Registered Parties ({parties.length})
            </h2>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {parties.map(p => (
                <div key={p.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-950 font-mono">{p.id}</span>
                    {p.cid_number && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 font-bold rounded font-mono text-[10px]">
                        {p.cid_number}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{p.system_name || p.party_name}</h3>
                  {p.group_name && <p className="text-[11px] text-slate-500">Group: {p.group_name}</p>}
                  {p.bank_name && <p className="text-[11px] text-slate-600">{p.bank_name} ({p.bank_country})</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Add Party Form (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900 border-b pb-2">
              + Add New Outside Party
            </h2>

            <form onSubmit={handleAddParty} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Clean Party System Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={partySystemName}
                  onChange={e => setPartySystemName(e.target.value)}
                  placeholder="Official clean name"
                  className="w-full bg-slate-50 border rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Group Name</label>
                <input
                  type="text"
                  value={partyGroupName}
                  onChange={e => setPartyGroupName(e.target.value)}
                  placeholder="e.g. Thailand Suppliers"
                  className="w-full bg-slate-50 border rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Manual CID Number (Customer Tag)
                </label>
                <input
                  type="text"
                  value={partyCid}
                  onChange={e => setPartyCid(e.target.value)}
                  placeholder="e.g. CID10001 (Optional)"
                  className="w-full bg-slate-50 border rounded-lg p-2 font-mono"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Purely manual & informational for monitoring customer activity.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Bank Name</label>
                <input
                  type="text"
                  value={partyBankName}
                  onChange={e => setPartyBankName(e.target.value)}
                  placeholder="e.g. ICICI Bank"
                  className="w-full bg-slate-50 border rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Bank Country</label>
                  <select
                    value={partyBankCountry}
                    onChange={e => setPartyBankCountry(e.target.value)}
                    className="w-full bg-slate-50 border rounded-lg p-2"
                  >
                    <option value="India">India</option>
                    <option value="UAE">UAE</option>
                    <option value="Thailand">Thailand</option>
                    <option value="USA">USA</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Account Number</label>
                  <input
                    type="text"
                    value={partyAccountNum}
                    onChange={e => setPartyAccountNum(e.target.value)}
                    placeholder="Account #"
                    className="w-full bg-slate-50 border rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg shadow-sm"
              >
                Save Party Master
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
};
