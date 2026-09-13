import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateTrigramSimilarity } from '../../lib/alias';
import { suggestPartyFromAliasAI, isGeminiConfigured } from '../../lib/gemini';
import { Tag, Check, Plus, EyeOff, Search, Sparkles, Building, ArrowRight, Loader2 } from 'lucide-react';

export const PartyAliasesModule: React.FC = () => {
  const {
    partyAliases,
    parties,
    partiesMap,
    userTransactions,
    mapPartyAlias,
    createPartyFromAlias,
    ignorePartyAlias,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyForMap, setSelectedPartyForMap] = useState<{ [aliasId: string]: string }>({});
  const [newPartyNameInput, setNewPartyNameInput] = useState<{ [aliasId: string]: string }>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [aiMatchingAliasId, setAiMatchingAliasId] = useState<string | null>(null);

  const handleAiTriage = async (aliasId: string, rawAlias: string) => {
    setAiMatchingAliasId(aliasId);
    try {
      const known = parties.map(p => ({ id: p.id, system_name: p.system_name || p.party_name }));
      const result = await suggestPartyFromAliasAI(rawAlias, known);
      if (result.matchedPartyId) {
        setSelectedPartyForMap(prev => ({ ...prev, [aliasId]: result.matchedPartyId! }));
        setFeedback(`✨ Gemini 2.5 matched "${rawAlias}" to "${partiesMap.get(result.matchedPartyId)?.system_name}" (${Math.round((result.confidence || 0.9) * 100)}% confidence). Review & click 'Map' to confirm.`);
      } else if (result.cleanedName) {
        setNewPartyNameInput(prev => ({ ...prev, [aliasId]: result.cleanedName }));
        setFeedback(`✨ Gemini suggests cleaned Party name: "${result.cleanedName}". Click 'Create Party' to register.`);
      }
      setTimeout(() => setFeedback(null), 7000);
    } catch (err) {
      console.error(err);
      alert('Gemini alias triage failed.');
    } finally {
      setAiMatchingAliasId(null);
    }
  };

  // Unmapped aliases
  const unmappedAliases = useMemo(() => {
    return partyAliases.filter(a => a.status === 'unmapped' || a.status === 'suggested');
  }, [partyAliases]);

  // Mapped aliases
  const mappedAliases = useMemo(() => {
    return partyAliases.filter(a => a.status === 'mapped');
  }, [partyAliases]);

  // Filtered mapped list
  const filteredMapped = useMemo(() => {
    if (!searchQuery.trim()) return mappedAliases;
    const q = searchQuery.toLowerCase();
    return mappedAliases.filter(a =>
      a.alias_name.toLowerCase().includes(q) ||
      a.alias_normalized.toLowerCase().includes(q) ||
      (a.party_id && partiesMap.get(a.party_id)?.system_name?.toLowerCase().includes(q))
    );
  }, [mappedAliases, searchQuery, partiesMap]);

  // Get transaction count for a given alias
  const getTxnCount = (rawName: string) => {
    return userTransactions.filter(t => t.party_name_raw.toLowerCase() === rawName.toLowerCase()).length;
  };

  const handleMap = (aliasId: string) => {
    const chosenPartyId = selectedPartyForMap[aliasId];
    if (!chosenPartyId) {
      alert('Please select a target party.');
      return;
    }
    mapPartyAlias(aliasId, chosenPartyId);
    setFeedback(`Alias mapped! All past and future transactions with this name now resolve to ${partiesMap.get(chosenPartyId)?.system_name}.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateParty = (aliasId: string, defaultName: string) => {
    const systemName = newPartyNameInput[aliasId] || defaultName;
    if (!systemName.trim()) {
      alert('Party System Name is required.');
      return;
    }
    const newP = createPartyFromAlias(aliasId, systemName.trim());
    setFeedback(`New Party "${newP.system_name}" created and alias mapped retroactively!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-purple-50 text-purple-700 rounded-lg">
            <Tag className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-serif text-slate-900">Party Aliases Work Queue</h1>
              {isGeminiConfigured && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
                  <span>Gemini 2.5 Flash Active</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              User-Side Only &bull; Raw typed names resolved to clean Party System Names (Mapping is instant and retroactive)
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* TOP SECTION: UNMAPPED ALIASES WORK QUEUE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-2">
              <span>Unmapped Aliases Queue ({unmappedAliases.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Triage raw names typed by staff. Map to an existing party, create a new party, or ignore noise.
            </p>
          </div>
        </div>

        {unmappedAliases.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Sparkles className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700">All party aliases are cleanly mapped!</p>
            <p className="text-slate-400 mt-1">No unmapped names waiting in the triage queue.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {unmappedAliases.map(alias => {
              const txnCount = getTxnCount(alias.alias_name);

              // Compute best fuzzy suggestion from parties
              let bestSuggestion: { party: any; score: number } | null = null;
              parties.forEach(p => {
                const sName = p.system_name || p.party_name;
                const score = calculateTrigramSimilarity(alias.alias_normalized, sName);
                if (!bestSuggestion || score > bestSuggestion.score) {
                  bestSuggestion = { party: p, score };
                }
              });

              return (
                <div key={alias.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-rose-950 bg-rose-100 px-2 py-0.5 rounded">
                          {alias.alias_name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          normalized: "{alias.alias_normalized}"
                        </span>
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                          Used in {txnCount} transactions
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAiTriage(alias.id, alias.alias_name)}
                        disabled={aiMatchingAliasId === alias.id}
                        className="text-[11px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                        title="Ask Gemini AI to match with known parties or suggest clean name"
                      >
                        {aiMatchingAliasId === alias.id ? (
                          <>
                            <Loader2 className="w-3 h-3 text-purple-600 animate-spin" />
                            <span>Matching...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>✨ Gemini Match</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => ignorePartyAlias(alias.id)}
                        className="text-[11px] text-slate-500 hover:text-rose-700 flex items-center space-x-1 p-1 cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ignore as Noise</span>
                      </button>
                    </div>
                  </div>

                  {/* Fuzzy Suggestion Pill */}
                  {bestSuggestion && (bestSuggestion as any).score >= 0.4 && (
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-amber-900">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          AI / Fuzzy Suggestion: <strong className="font-bold">{(bestSuggestion as any).party.system_name}</strong>
                          <span className="text-[11px] ml-1 opacity-75">({Math.round((bestSuggestion as any).score * 100)}% match)</span>
                        </span>
                      </div>

                      <button
                        onClick={() => mapPartyAlias(alias.id, (bestSuggestion as any).party.id)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px]"
                      >
                        Accept Suggestion
                      </button>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    
                    {/* Map to Existing Party */}
                    <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200">
                      <select
                        value={selectedPartyForMap[alias.id] || ''}
                        onChange={e => setSelectedPartyForMap({ ...selectedPartyForMap, [alias.id]: e.target.value })}
                        className="flex-1 bg-slate-50 text-xs border border-slate-200 rounded p-1.5 focus:outline-none"
                      >
                        <option value="">-- Choose Existing Party to Map --</option>
                        {parties.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.system_name || p.party_name} ({p.group_name || 'No Group'})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleMap(alias.id)}
                        className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded"
                      >
                        Map
                      </button>
                    </div>

                    {/* Create New Party */}
                    <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Clean System Name"
                        defaultValue={alias.alias_name}
                        onChange={e => setNewPartyNameInput({ ...newPartyNameInput, [alias.id]: e.target.value })}
                        className="flex-1 bg-slate-50 text-xs border border-slate-200 rounded p-1.5 focus:outline-none"
                      />
                      <button
                        onClick={() => handleCreateParty(alias.id, alias.alias_name)}
                        className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs transition whitespace-nowrap cursor-pointer"
                      >
                        + Create Party
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: MAPPED ALIASES REFERENCE LIST */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Mapped Aliases Reference ({mappedAliases.length})
            </h2>
            <p className="text-xs text-slate-500">
              Clean mapping dictionary. All typed variations route to the clean Party System Name.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search mapped aliases..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-rose-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b">
              <tr>
                <th className="p-3">Raw Typed Name</th>
                <th className="p-3">Normalized String</th>
                <th className="p-3">Resolved Party System Name</th>
                <th className="p-3">Group</th>
                <th className="p-3 text-right">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMapped.map(alias => {
                const party = alias.party_id ? partiesMap.get(alias.party_id) : null;
                const count = getTxnCount(alias.alias_name);
                return (
                  <tr key={alias.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{alias.alias_name}</td>
                    <td className="p-3 font-mono text-slate-500">{alias.alias_normalized}</td>
                    <td className="p-3">
                      <span className="font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                        {party?.system_name || party?.party_name || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{party?.group_name || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-700">{count} txns</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
