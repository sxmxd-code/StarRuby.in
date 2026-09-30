import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateTrigramSimilarity, normalizeAlias } from '../../lib/alias';
import { suggestPartyFromAliasAI, isGeminiConfigured } from '../../lib/gemini';
import {
  Tag,
  Check,
  Plus,
  EyeOff,
  Search,
  Sparkles,
  Building,
  ArrowRight,
  Loader2,
  GitMerge,
  AlertTriangle,
  Layers,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Party } from '../../types/database';

export const PartyAliasesModule: React.FC = () => {
  const {
    partyAliases,
    parties,
    partiesMap,
    userTransactions,
    mapPartyAlias,
    createPartyFromAlias,
    ignorePartyAlias,
    mergeParties,
    currentRole,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'similarity' | 'aliases'>('similarity');
  const [searchQuery, setSearchQuery] = useState('');
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [selectedPartyForMap, setSelectedPartyForMap] = useState<{ [aliasId: string]: string }>({});
  const [newPartyNameInput, setNewPartyNameInput] = useState<{ [aliasId: string]: string }>({});
  const [mergeTargetMap, setMergeTargetMap] = useState<{ [sourcePartyId: string]: string }>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [aiMatchingAliasId, setAiMatchingAliasId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // DEDUPLICATION & SIMILARITY DETECTION (PARTY SYSTEM NAMES)
  // ---------------------------------------------------------------------------
  const similarPartyPairs = useMemo(() => {
    const pairs: { p1: Party; p2: Party; score: number }[] = [];
    for (let i = 0; i < parties.length; i++) {
      for (let j = i + 1; j < parties.length; j++) {
        const p1 = parties[i];
        const p2 = parties[j];
        const name1 = (p1.system_name || p1.party_name || '').toLowerCase().trim();
        const name2 = (p2.system_name || p2.party_name || '').toLowerCase().trim();
        if (!name1 || !name2) continue;

        const score = calculateTrigramSimilarity(name1, name2);
        const contains = (name1.length > 3 && name2.includes(name1)) || (name2.length > 3 && name1.includes(name2));
        if (score >= 0.55 || contains) {
          pairs.push({
            p1,
            p2,
            score: Math.min(1, Math.max(score, contains ? 0.78 : 0)),
          });
        }
      }
    }
    return pairs.sort((a, b) => b.score - a.score);
  }, [parties]);

  // Transaction count helper
  const getPartyTxnCount = (partyId: string, partyName?: string) => {
    return userTransactions.filter(t => t.party_id === partyId || (partyName && t.party_name_raw?.toLowerCase() === partyName.toLowerCase())).length;
  };

  const getAliasTxnCount = (rawName: string) => {
    return userTransactions.filter(t => t.party_name_raw?.toLowerCase() === rawName.toLowerCase()).length;
  };

  // 1-Click Merge handler
  const handleExecuteMerge = async (sourcePartyId: string, targetPartyId: string) => {
    const source = parties.find(p => p.id === sourcePartyId);
    const target = parties.find(p => p.id === targetPartyId);
    if (!source || !target) return;

    const sourceName = source.system_name || source.party_name;
    const targetName = target.system_name || target.party_name;

    if (!window.confirm(`Are you sure you want to merge "${sourceName}" (${sourcePartyId}) into "${targetName}" (${targetPartyId})?\n\nThis will re-point all transactions, aliases, and templates to "${targetName}", and permanently combine their records.`)) {
      return;
    }

    setIsMerging(true);
    const result = await mergeParties(sourcePartyId, targetPartyId);
    setIsMerging(false);

    if (result.success) {
      setFeedback(`✨ ${result.message}`);
      setTimeout(() => setFeedback(null), 5000);
    } else {
      alert(result.message);
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERED PARTIES DIRECTORY
  // ---------------------------------------------------------------------------
  const filteredParties = useMemo(() => {
    if (!partySearchQuery.trim()) return parties;
    const q = partySearchQuery.toLowerCase();
    return parties.filter(p => {
      const sName = (p.system_name || p.party_name || '').toLowerCase();
      const group = (p.group_name || '').toLowerCase();
      const cid = (p.cid_number || '').toLowerCase();
      const aliases = Array.isArray(p.party_name_raw) ? p.party_name_raw.join(' ').toLowerCase() : (p.party_name_raw || '').toLowerCase();
      return sName.includes(q) || p.id.toLowerCase().includes(q) || group.includes(q) || cid.includes(q) || aliases.includes(q);
    });
  }, [parties, partySearchQuery]);

  // ---------------------------------------------------------------------------
  // RAW ALIASES TRIAGE QUEUE (TAB 2)
  // ---------------------------------------------------------------------------
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

  const unmappedAliases = useMemo(() => {
    return partyAliases.filter(a => a.status === 'unmapped' || a.status === 'suggested');
  }, [partyAliases]);

  const mappedAliases = useMemo(() => {
    return partyAliases.filter(a => a.status === 'mapped');
  }, [partyAliases]);

  const filteredMapped = useMemo(() => {
    if (!searchQuery.trim()) return mappedAliases;
    const q = searchQuery.toLowerCase();
    return mappedAliases.filter(a =>
      a.alias_name.toLowerCase().includes(q) ||
      a.alias_normalized.toLowerCase().includes(q) ||
      (a.party_id && partiesMap.get(a.party_id)?.system_name?.toLowerCase().includes(q))
    );
  }, [mappedAliases, searchQuery, partiesMap]);

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
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-purple-50 text-purple-700 rounded-lg">
            <Tag className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-serif text-slate-900">
                Party System Names & Similarity Deduplication
              </h1>
              {isGeminiConfigured && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
                  <span>AI Deduplication Active</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Clean Party System Names &bull; Automated Trigram Similarity &bull; 1-Click Retroactive Merge &bull; Live Alias Mappings
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('similarity')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'similarity'
                ? 'bg-white text-purple-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Party Similarity & Directory ({parties.length})</span>
            {similarPartyPairs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                {similarPartyPairs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aliases')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'aliases'
                ? 'bg-white text-blue-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Raw Aliases Triage ({unmappedAliases.length})</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: SIMILARITY DEDUPLICATION & DIRECTORY */}
      {/* ==================================================================== */}
      {activeTab === 'similarity' && (
        <div className="space-y-6">
          {/* Section 1: Detected Similar Party Pairs (Duplicates Triage) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Near-Duplicate Party Names Scanner ({similarPartyPairs.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  High similarity Party System Names detected across records. Merge redundant entries with 1-click.
                </p>
              </div>
            </div>

            {similarPartyPairs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto opacity-80" />
                <p className="font-bold text-emerald-950">Zero Duplicate Party Names Detected</p>
                <p className="text-emerald-700">All registered Party System Names have distinct naming profiles.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {similarPartyPairs.map(({ p1, p2, score }, idx) => {
                  const txnCount1 = getPartyTxnCount(p1.id, p1.party_name);
                  const txnCount2 = getPartyTxnCount(p2.id, p2.party_name);

                  return (
                    <div
                      key={`${p1.id}_${p2.id}_${idx}`}
                      className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-950 flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px]">
                            {Math.round(score * 100)}% Similarity
                          </span>
                          <span>Suspected Duplicate Party Records</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Party 1 */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">
                              {p1.system_name || p1.party_name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 font-bold">{p1.id}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span>Group: {p1.group_name || 'None'}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-rose-800">{txnCount1} linked transaction(s)</span>
                          </div>
                          <button
                            type="button"
                            disabled={isMerging}
                            onClick={() => handleExecuteMerge(p2.id, p1.id)}
                            className="w-full mt-2 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            <span>Keep this ({p1.system_name || p1.party_name}) & Merge Other In</span>
                          </button>
                        </div>

                        {/* Party 2 */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">
                              {p2.system_name || p2.party_name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 font-bold">{p2.id}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span>Group: {p2.group_name || 'None'}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-rose-800">{txnCount2} linked transaction(s)</span>
                          </div>
                          <button
                            type="button"
                            disabled={isMerging}
                            onClick={() => handleExecuteMerge(p1.id, p2.id)}
                            className="w-full mt-2 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            <span>Keep this ({p2.system_name || p2.party_name}) & Merge Other In</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Party System Names Directory & On-Demand Merge */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-slate-600" />
                  <span>Party System Names Directory ({filteredParties.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clean sources of truth for external counterparties.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={partySearchQuery}
                  onChange={e => setPartySearchQuery(e.target.value)}
                  placeholder="Search by party, ID, CID, group..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b">
                  <tr>
                    <th className="p-3">Party System Name</th>
                    <th className="p-3">Party ID</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">CID</th>
                    <th className="p-3">Associated Raw Aliases</th>
                    <th className="p-3 text-center">Txns</th>
                    <th className="p-3 text-right">Merge Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParties.map(p => {
                    const txnCount = getPartyTxnCount(p.id, p.party_name);
                    const aliases: string[] = Array.isArray(p.party_name_raw)
                      ? p.party_name_raw
                      : p.party_name_raw
                      ? [p.party_name_raw]
                      : [];

                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block text-xs">
                            {p.system_name || p.party_name}
                          </span>
                          {p.bank_name && (
                            <span className="text-[10px] text-slate-400 block">
                              {p.bank_name} {p.account_currency ? `(${p.account_currency})` : ''}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-500">{p.id}</td>
                        <td className="p-3 text-slate-600">{p.group_name || '—'}</td>
                        <td className="p-3 font-mono text-slate-600">{p.cid_number || '—'}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {aliases.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">No raw aliases mapped</span>
                            ) : (
                              aliases.slice(0, 4).map((a, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] border">
                                  {a}
                                </span>
                              ))
                            )}
                            {aliases.length > 4 && (
                              <span className="text-[10px] text-slate-400">+{aliases.length - 4} more</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-800">
                          {txnCount}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <select
                              value={mergeTargetMap[p.id] || ''}
                              onChange={e => setMergeTargetMap({ ...mergeTargetMap, [p.id]: e.target.value })}
                              className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none max-w-[150px]"
                            >
                              <option value="">Merge into...</option>
                              {parties.filter(other => other.id !== p.id).map(other => (
                                <option key={other.id} value={other.id}>
                                  {other.system_name || other.party_name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!mergeTargetMap[p.id] || isMerging}
                              onClick={() => {
                                if (mergeTargetMap[p.id]) {
                                  handleExecuteMerge(p.id, mergeTargetMap[p.id]);
                                }
                              }}
                              className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded text-[11px] font-bold transition cursor-pointer"
                            >
                              Merge
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: RAW ALIASES WORK QUEUE & MAPPINGS */}
      {/* ==================================================================== */}
      {activeTab === 'aliases' && (
        <div className="space-y-6">
          {/* Top Section: Unmapped Aliases Work Queue */}
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
                  const txnCount = getAliasTxnCount(alias.alias_name);

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

          {/* Bottom Section: Mapped Aliases Reference List */}
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
                    const count = getAliasTxnCount(alias.alias_name);
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
      )}
    </div>
  );
};
