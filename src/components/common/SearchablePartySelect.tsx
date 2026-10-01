import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Party } from '../../types/database';
import { Search, ChevronDown, Check, X, Building2 } from 'lucide-react';

export interface SearchablePartySelectProps {
  parties: Party[];
  selectedPartyId: string;
  onSelect: (partyId: string) => void;
  allowAllOption?: boolean;
  allLabel?: string;
  placeholder?: string;
  className?: string;
}

export const SearchablePartySelect: React.FC<SearchablePartySelectProps> = ({
  parties,
  selectedPartyId,
  onSelect,
  allowAllOption = true,
  allLabel = 'All Parties',
  placeholder = 'Search party by name or ID...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Find currently selected party
  const selectedParty = useMemo(() => {
    if (!selectedPartyId || selectedPartyId === 'ALL') return null;
    return parties.find(p => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Filter parties by search query
  const filteredParties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(p => {
      const systemName = (p.system_name || '').toLowerCase();
      const partyName = (p.party_name || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      return systemName.includes(q) || partyName.includes(q) || id.includes(q);
    });
  }, [parties, searchQuery]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 flex items-center justify-between transition focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-1.5 truncate pr-1">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-medium text-left">
            {selectedParty ? (selectedParty.system_name || selectedParty.party_name) : allLabel}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 text-slate-400">
          {selectedParty && allowAllOption && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect('ALL');
              }}
              className="p-0.5 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
              title="Clear party filter"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[260px] max-w-[340px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in duration-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-slate-50 space-y-0.5 pr-0.5">
            {/* "All Parties" Default Option */}
            {allowAllOption && !searchQuery.trim() && (
              <button
                type="button"
                onClick={() => {
                  onSelect('ALL');
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${
                  selectedPartyId === 'ALL' || !selectedPartyId
                    ? 'bg-blue-50 text-blue-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{allLabel}</span>
                {(selectedPartyId === 'ALL' || !selectedPartyId) && (
                  <Check className="w-3.5 h-3.5 text-blue-700" />
                )}
              </button>
            )}

            {filteredParties.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                <p>No parties match "{searchQuery}"</p>
                <p className="text-[10px] text-slate-400">Try a different spelling or keyword</p>
              </div>
            ) : (
              filteredParties.map(p => {
                const isSelected = selectedPartyId === p.id;
                const name = p.system_name || p.party_name;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <span className="truncate">{name}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                        {p.id}
                      </span>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
