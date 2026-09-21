import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SlideOverDrawer } from '../common/SlideOverDrawer';
import { Building, Users, Landmark, Contact, Plus, Check, Shield, Edit2, Trash2, Tag, X, Sparkles } from 'lucide-react';
import { Company, User, Account, Party, Currency, AccessLevelType } from '../../types/database';

export const MastersModule: React.FC = () => {
  const {
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
    allUsers,
    addUser,
    updateUser,
    deleteUser,
    accessLevels,
    addAccessLevel,
    accounts,
    scopedAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    userCompanies,
    signatories,
    parties,
    addParty,
    updateParty,
    deleteParty,
    addPartyAliasTag,
    removePartyAliasTag,
    assignCompanyToUser,
    removeCompanyFromUser,
    currentRole,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'users' | 'accounts' | 'parties'>('companies');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Helper for Last ID reference and Next ID generation
  const getLastAndNextId = (prefix: string, items: { id: string }[], startNum: number = 1) => {
    let maxNum = startNum - 1;
    items.forEach(it => {
      const num = parseInt(it.id.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    const lastId = maxNum >= startNum ? `${prefix}${maxNum}` : 'None';
    const nextId = `${prefix}${maxNum + 1}`;
    return { lastId, nextId };
  };

  // --------------------------------------------------------------------------
  // 1. COMPANIES DRAWER STATE & HANDLERS
  // --------------------------------------------------------------------------
  const [isCompanyDrawerOpen, setIsCompanyDrawerOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('NEW');
  const [companyFullName, setCompanyFullName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  const { lastId: lastCompanyId, nextId: nextCompanyId } = useMemo(
    () => getLastAndNextId('COM', companies, 1),
    [companies]
  );

  const openAddCompanyDrawer = () => {
    setSelectedCompanyId('NEW');
    setCompanyFullName('');
    setCompanyEmail('');
    setIsCompanyDrawerOpen(true);
  };

  const openEditCompanyDrawer = (comp: Company) => {
    setSelectedCompanyId(comp.id);
    setCompanyFullName(comp.full_name);
    setCompanyEmail(comp.email || '');
    setIsCompanyDrawerOpen(true);
  };

  const handleCompanySelectChange = (id: string) => {
    setSelectedCompanyId(id);
    if (id === 'NEW') {
      setCompanyFullName('');
      setCompanyEmail('');
    } else {
      const comp = companies.find(c => c.id === id);
      if (comp) {
        setCompanyFullName(comp.full_name);
        setCompanyEmail(comp.email || '');
      }
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyFullName.trim()) {
      alert('Company Full Name is required.');
      return;
    }

    if (selectedCompanyId === 'NEW') {
      const created = addCompany({
        full_name: companyFullName.trim(),
        email: companyEmail.trim() || undefined,
      });
      setFeedback(`Company ${created.id} (${created.full_name}) created successfully!`);
    } else {
      updateCompany(selectedCompanyId, {
        full_name: companyFullName.trim(),
        email: companyEmail.trim() || undefined,
      });
      setFeedback(`Company ${selectedCompanyId} updated successfully!`);
    }
    setIsCompanyDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeleteCompany = () => {
    if (selectedCompanyId === 'NEW') return;
    if (window.confirm(`Are you sure you want to delete Company ${selectedCompanyId}?`)) {
      deleteCompany(selectedCompanyId);
      setIsCompanyDrawerOpen(false);
      setFeedback(`Company ${selectedCompanyId} deleted.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // --------------------------------------------------------------------------
  // 2. USERS & ROLES DRAWER STATE & HANDLERS
  // --------------------------------------------------------------------------
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('NEW');
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userSelectedRoles, setUserSelectedRoles] = useState<string[]>(['ACC4']);

  // New Access Role dynamic sub-section
  const [newRoleLevelType, setNewRoleLevelType] = useState<AccessLevelType>('Staff');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const { lastId: lastUserId, nextId: nextUserId } = useMemo(
    () => getLastAndNextId('USR', allUsers, 1),
    [allUsers]
  );
  const { lastId: lastAccessId, nextId: nextAccessId } = useMemo(
    () => getLastAndNextId('ACC', accessLevels, 1),
    [accessLevels]
  );

  const openAddUserDrawer = () => {
    setSelectedUserId('NEW');
    setUserFullName('');
    setUserEmail('');
    setUserSelectedRoles(['ACC4']);
    setIsUserDrawerOpen(true);
  };

  const openEditUserDrawer = (u: User) => {
    setSelectedUserId(u.id);
    setUserFullName(u.full_name);
    setUserEmail(u.email);
    setUserSelectedRoles(u.access_role_ids && u.access_role_ids.length > 0 ? u.access_role_ids : [u.access_level_id]);
    setIsUserDrawerOpen(true);
  };

  const handleUserSelectChange = (id: string) => {
    setSelectedUserId(id);
    if (id === 'NEW') {
      setUserFullName('');
      setUserEmail('');
      setUserSelectedRoles(['ACC4']);
    } else {
      const u = allUsers.find(user => user.id === id);
      if (u) {
        setUserFullName(u.full_name);
        setUserEmail(u.email);
        setUserSelectedRoles(u.access_role_ids && u.access_role_ids.length > 0 ? u.access_role_ids : [u.access_level_id]);
      }
    }
  };

  const handleToggleRole = (roleId: string) => {
    setUserSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const handleCreateAccessRole = () => {
    if (!newRoleDesc.trim()) {
      alert('Please enter a role description.');
      return;
    }
    addAccessLevel({
      id: nextAccessId,
      level_type: newRoleLevelType,
      description: newRoleDesc.trim(),
    });
    setNewRoleDesc('');
    setUserSelectedRoles(prev => [...prev, nextAccessId]);
    setFeedback(`New Access Role ${nextAccessId} (${newRoleLevelType}) created!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFullName.trim() || !userEmail.trim()) {
      alert('Full Name and Email are required.');
      return;
    }
    const primaryRoleId = userSelectedRoles[0] || 'ACC4';

    if (selectedUserId === 'NEW') {
      const created = addUser({
        full_name: userFullName.trim(),
        email: userEmail.trim().toLowerCase(),
        access_level_id: primaryRoleId,
        access_role_ids: userSelectedRoles,
        is_active: true,
      });
      setFeedback(`User ${created.id} (${created.full_name}) registered successfully!`);
    } else {
      updateUser(selectedUserId, {
        full_name: userFullName.trim(),
        email: userEmail.trim().toLowerCase(),
        access_level_id: primaryRoleId,
        access_role_ids: userSelectedRoles,
      });
      setFeedback(`User ${selectedUserId} updated successfully!`);
    }
    setIsUserDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeleteUser = () => {
    if (selectedUserId === 'NEW') return;
    if (window.confirm(`Are you sure you want to delete User ${selectedUserId}?`)) {
      deleteUser(selectedUserId);
      setIsUserDrawerOpen(false);
      setFeedback(`User ${selectedUserId} deleted.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // --------------------------------------------------------------------------
  // 3. BANK ACCOUNTS DRAWER STATE & HANDLERS
  // --------------------------------------------------------------------------
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [selectedAccId, setSelectedAccId] = useState<string>('NEW');
  const [accCompanyId, setAccCompanyId] = useState<string>(companies[0]?.id || 'COM1');
  const [accBankName, setAccBankName] = useState('');
  const [accBankCountry, setAccBankCountry] = useState('India');
  const [accNumber, setAccNumber] = useState('');
  const [accIban, setAccIban] = useState('');
  const [accSwift, setAccSwift] = useState('');
  const [accIfsc, setAccIfsc] = useState('');
  const [accHolder, setAccHolder] = useState('');
  const [accCurrency, setAccCurrency] = useState<Currency>('INR');
  const [accBranch, setAccBranch] = useState('');
  const [accCreationDate, setAccCreationDate] = useState('');
  const [accClosingDate, setAccClosingDate] = useState('');

  const { lastId: lastAccountId, nextId: nextAccountId } = useMemo(
    () => getLastAndNextId('BNK', accounts, 1),
    [accounts]
  );

  const openAddAccountDrawer = () => {
    setSelectedAccId('NEW');
    setAccCompanyId(companies[0]?.id || 'COM1');
    setAccBankName('');
    setAccBankCountry('India');
    setAccNumber('');
    setAccIban('');
    setAccSwift('');
    setAccIfsc('');
    setAccHolder('');
    setAccCurrency('INR');
    setAccBranch('');
    setAccCreationDate(new Date().toISOString().slice(0, 10));
    setAccClosingDate('');
    setIsAccountDrawerOpen(true);
  };

  const openEditAccountDrawer = (acc: Account) => {
    setSelectedAccId(acc.id);
    setAccCompanyId(acc.company_id);
    setAccBankName(acc.bank_name);
    setAccBankCountry(acc.bank_country);
    setAccNumber(acc.account_number);
    setAccIban(acc.iban_number || '');
    setAccSwift(acc.swift_code || '');
    setAccIfsc(acc.ifsc_code || '');
    setAccHolder(acc.account_holder);
    setAccCurrency(acc.account_currency);
    setAccBranch(acc.bank_branch);
    setAccCreationDate(acc.account_creation_date || '');
    setAccClosingDate(acc.account_closing_date || '');
    setIsAccountDrawerOpen(true);
  };

  const handleAccountSelectChange = (id: string) => {
    setSelectedAccId(id);
    if (id === 'NEW') {
      setAccBankName('');
      setAccNumber('');
      setAccHolder('');
      setAccIban('');
      setAccSwift('');
      setAccIfsc('');
      setAccBranch('');
    } else {
      const acc = accounts.find(a => a.id === id);
      if (acc) {
        setAccCompanyId(acc.company_id);
        setAccBankName(acc.bank_name);
        setAccBankCountry(acc.bank_country);
        setAccNumber(acc.account_number);
        setAccIban(acc.iban_number || '');
        setAccSwift(acc.swift_code || '');
        setAccIfsc(acc.ifsc_code || '');
        setAccHolder(acc.account_holder);
        setAccCurrency(acc.account_currency);
        setAccBranch(acc.bank_branch);
        setAccCreationDate(acc.account_creation_date || '');
        setAccClosingDate(acc.account_closing_date || '');
      }
    }
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accBankName.trim() || !accNumber.trim()) {
      alert('Bank Name and Account Number are required.');
      return;
    }

    if (selectedAccId === 'NEW') {
      const created = addAccount({
        company_id: accCompanyId,
        bank_name: accBankName.trim(),
        bank_country: accBankCountry,
        account_number: accNumber.trim(),
        account_holder: accHolder.trim() || (companies.find(c => c.id === accCompanyId)?.full_name || 'StarRuby.in'),
        account_currency: accCurrency,
        bank_branch: accBranch.trim(),
        iban_number: accIban.trim() || undefined,
        swift_code: accSwift.trim() || undefined,
        ifsc_code: accIfsc.trim() || undefined,
        account_creation_date: accCreationDate || undefined,
        account_closing_date: accClosingDate || undefined,
      });
      setFeedback(`Bank Account ${created.id} (${created.bank_name} - ${created.account_currency}) created!`);
    } else {
      updateAccount(selectedAccId, {
        company_id: accCompanyId,
        bank_name: accBankName.trim(),
        bank_country: accBankCountry,
        account_number: accNumber.trim(),
        account_holder: accHolder.trim(),
        account_currency: accCurrency,
        bank_branch: accBranch.trim(),
        iban_number: accIban.trim() || undefined,
        swift_code: accSwift.trim() || undefined,
        ifsc_code: accIfsc.trim() || undefined,
        account_creation_date: accCreationDate || undefined,
        account_closing_date: accClosingDate || undefined,
      });
      setFeedback(`Bank Account ${selectedAccId} updated successfully!`);
    }
    setIsAccountDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeleteAccount = () => {
    if (selectedAccId === 'NEW') return;
    if (window.confirm(`Are you sure you want to delete Bank Account ${selectedAccId}?`)) {
      deleteAccount(selectedAccId);
      setIsAccountDrawerOpen(false);
      setFeedback(`Bank Account ${selectedAccId} deleted.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // --------------------------------------------------------------------------
  // 4. PARTIES DRAWER STATE & HANDLERS (Tag Bubbles & Aliases Array)
  // --------------------------------------------------------------------------
  const [isPartyDrawerOpen, setIsPartyDrawerOpen] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('NEW');
  const [partySystemName, setPartySystemName] = useState('');
  const [partyGroupName, setPartyGroupName] = useState('');
  const [partyCid, setPartyCid] = useState('');
  const [partyBankName, setPartyBankName] = useState('');
  const [partyBankCountry, setPartyBankCountry] = useState('India');
  const [partyAccountNum, setPartyAccountNum] = useState('');
  const [partyIban, setPartyIban] = useState('');
  const [partySwift, setPartySwift] = useState('');
  const [partyIfsc, setPartyIfsc] = useState('');
  const [partyAccountHolder, setPartyAccountHolder] = useState('');
  const [partyCurrency, setPartyCurrency] = useState('INR');
  const [partyBranch, setPartyBranch] = useState('');
  const [partyCreationDate, setPartyCreationDate] = useState('');
  const [partyClosingDate, setPartyClosingDate] = useState('');

  // Party Name Aliases Tag Bubbles (party_name_raw array)
  const [partyAliasesList, setPartyAliasesList] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');

  const { lastId: lastPartyId, nextId: nextPartyId } = useMemo(
    () => getLastAndNextId('PTY', parties, 101),
    [parties]
  );

  const openAddPartyDrawer = () => {
    setSelectedPartyId('NEW');
    setPartySystemName('');
    setPartyGroupName('');
    setPartyCid('');
    setPartyBankName('');
    setPartyBankCountry('India');
    setPartyAccountNum('');
    setPartyIban('');
    setPartySwift('');
    setPartyIfsc('');
    setPartyAccountHolder('');
    setPartyCurrency('INR');
    setPartyBranch('');
    setPartyCreationDate(new Date().toISOString().slice(0, 10));
    setPartyClosingDate('');
    setPartyAliasesList([]);
    setNewAliasInput('');
    setIsPartyDrawerOpen(true);
  };

  const openEditPartyDrawer = (p: Party) => {
    setSelectedPartyId(p.id);
    setPartySystemName(p.system_name || p.party_name);
    setPartyGroupName(p.group_name || '');
    setPartyCid(p.cid_number || '');
    setPartyBankName(p.bank_name || '');
    setPartyBankCountry(p.bank_country || 'India');
    setPartyAccountNum(p.account_number || '');
    setPartyIban(p.iban_number || '');
    setPartySwift(p.swift_code || '');
    setPartyIfsc(p.ifsc_code || '');
    setPartyAccountHolder(p.account_holder || '');
    setPartyCurrency(p.account_currency || 'INR');
    setPartyBranch(p.bank_branch || '');
    setPartyCreationDate(p.account_creation_date || '');
    setPartyClosingDate(p.account_closing_date || '');

    const rawArr = Array.isArray(p.party_name_raw)
      ? p.party_name_raw
      : p.party_name_raw
      ? [p.party_name_raw]
      : p.party_name
      ? [p.party_name]
      : [];
    setPartyAliasesList(rawArr);
    setNewAliasInput('');
    setIsPartyDrawerOpen(true);
  };

  const handlePartySelectChange = (id: string) => {
    setSelectedPartyId(id);
    if (id === 'NEW') {
      setPartySystemName('');
      setPartyGroupName('');
      setPartyCid('');
      setPartyBankName('');
      setPartyAccountNum('');
      setPartyAliasesList([]);
    } else {
      const p = parties.find(party => party.id === id);
      if (p) {
        setPartySystemName(p.system_name || p.party_name);
        setPartyGroupName(p.group_name || '');
        setPartyCid(p.cid_number || '');
        setPartyBankName(p.bank_name || '');
        setPartyBankCountry(p.bank_country || 'India');
        setPartyAccountNum(p.account_number || '');
        setPartyIban(p.iban_number || '');
        setPartySwift(p.swift_code || '');
        setPartyIfsc(p.ifsc_code || '');
        setPartyAccountHolder(p.account_holder || '');
        setPartyCurrency(p.account_currency || 'INR');
        setPartyBranch(p.bank_branch || '');
        setPartyCreationDate(p.account_creation_date || '');
        setPartyClosingDate(p.account_closing_date || '');

        const rawArr = Array.isArray(p.party_name_raw)
          ? p.party_name_raw
          : p.party_name_raw
          ? [p.party_name_raw]
          : p.party_name
          ? [p.party_name]
          : [];
        setPartyAliasesList(rawArr);
      }
    }
  };

  const handleAddAliasTag = () => {
    const trimmed = newAliasInput.trim();
    if (!trimmed) return;
    if (!partyAliasesList.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      setPartyAliasesList([...partyAliasesList, trimmed]);
      if (selectedPartyId !== 'NEW') {
        addPartyAliasTag(selectedPartyId, trimmed);
      }
    }
    setNewAliasInput('');
  };

  const handleRemoveAliasTag = (aliasToRemove: string) => {
    setPartyAliasesList(partyAliasesList.filter(a => a !== aliasToRemove));
    if (selectedPartyId !== 'NEW') {
      removePartyAliasTag(selectedPartyId, aliasToRemove);
    }
  };

  const handleSaveParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partySystemName.trim()) {
      alert('Clean Party System Name is required.');
      return;
    }

    const initialAliases = partyAliasesList.length > 0 ? partyAliasesList : [partySystemName.trim()];

    if (selectedPartyId === 'NEW') {
      const created = addParty({
        system_name: partySystemName.trim(),
        party_name: partySystemName.trim(),
        party_name_raw: initialAliases,
        group_name: partyGroupName.trim() || undefined,
        cid_number: partyCid.trim() || undefined,
        bank_name: partyBankName.trim() || undefined,
        bank_country: partyBankCountry,
        account_number: partyAccountNum.trim() || undefined,
        iban_number: partyIban.trim() || undefined,
        swift_code: partySwift.trim() || undefined,
        ifsc_code: partyIfsc.trim() || undefined,
        account_holder: partyAccountHolder.trim() || undefined,
        account_currency: partyCurrency,
        bank_branch: partyBranch.trim() || undefined,
        account_creation_date: partyCreationDate || undefined,
        account_closing_date: partyClosingDate || undefined,
      });
      setFeedback(`Party ${created.id} (${created.system_name}) created successfully!`);
    } else {
      updateParty(selectedPartyId, {
        system_name: partySystemName.trim(),
        party_name: partySystemName.trim(),
        party_name_raw: initialAliases,
        group_name: partyGroupName.trim() || undefined,
        cid_number: partyCid.trim() || undefined,
        bank_name: partyBankName.trim() || undefined,
        bank_country: partyBankCountry,
        account_number: partyAccountNum.trim() || undefined,
        iban_number: partyIban.trim() || undefined,
        swift_code: partySwift.trim() || undefined,
        ifsc_code: partyIfsc.trim() || undefined,
        account_holder: partyAccountHolder.trim() || undefined,
        account_currency: partyCurrency,
        bank_branch: partyBranch.trim() || undefined,
        account_creation_date: partyCreationDate || undefined,
        account_closing_date: partyClosingDate || undefined,
      });
      setFeedback(`Party ${selectedPartyId} updated successfully!`);
    }
    setIsPartyDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeleteParty = () => {
    if (selectedPartyId === 'NEW') return;
    if (window.confirm(`Are you sure you want to delete Party ${selectedPartyId}?`)) {
      deleteParty(selectedPartyId);
      setIsPartyDrawerOpen(false);
      setFeedback(`Party ${selectedPartyId} deleted.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Subtabs & Add Button */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="p-2 bg-rose-50 text-rose-700 rounded-lg shrink-0">
            <Building className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold font-serif text-slate-900">Masters & Group Setup</h1>
            <p className="text-xs text-slate-500">
              CRUD Operations &bull; Companies, Users & Roles, Bank Accounts, Parties & Alias Mappings
            </p>
          </div>
        </div>

        {/* Subtabs and Actions */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('companies')}
              className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'companies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Companies
            </button>
            <button
              onClick={() => setActiveSubTab('users')}
              className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Users & Roles
            </button>
            <button
              onClick={() => setActiveSubTab('accounts')}
              className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'accounts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Bank Accounts
            </button>
            <button
              onClick={() => setActiveSubTab('parties')}
              className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'parties' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Parties
            </button>
          </div>

          {/* Primary Action Button based on Active Subtab */}
          <button
            onClick={() => {
              if (activeSubTab === 'companies') openAddCompanyDrawer();
              else if (activeSubTab === 'users') openAddUserDrawer();
              else if (activeSubTab === 'accounts') openAddAccountDrawer();
              else if (activeSubTab === 'parties') openAddPartyDrawer();
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeSubTab === 'companies' && 'Add Company'}
              {activeSubTab === 'users' && 'Add User'}
              {activeSubTab === 'accounts' && 'Add Bank Account'}
              {activeSubTab === 'parties' && 'Add Party'}
            </span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. COMPANIES SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'companies' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                StarRuby.in Group Companies
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every bank account belongs to one company. Admins and Accountant manage companies universally.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
              Last ID: <strong className="text-slate-800">{lastCompanyId}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map(c => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-rose-300 transition space-y-2.5 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900 font-mono text-sm">{c.id}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditCompanyDrawer(c)}
                      className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                      title="Edit Company"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete Company ${c.id} (${c.full_name})?`)) {
                          deleteCompany(c.id);
                          setFeedback(`Company ${c.id} deleted.`);
                          setTimeout(() => setFeedback(null), 4000);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                      title="Delete Company"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{c.full_name}</h3>
                  <p className="text-slate-500 mt-0.5">{c.email || 'No email registered'}</p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Registered Group Entity</span>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. USERS & ROLES SUBTAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Team Users & Company Permissions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Admin assigns which companies each Manager may work with. Admins & Accountant have universal access.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
              Last ID: <strong className="text-slate-800">{lastUserId}</strong>
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {allUsers.map(u => {
              const roleObj = accessLevels.find(a => a.id === u.access_level_id);
              const role = roleObj?.level_type || 'Staff';
              const assigned = userCompanies.filter(uc => uc.user_id === u.id);

              return (
                <div key={u.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-700">{u.id}</span>
                      <strong className="text-slate-900 text-sm">{u.full_name}</strong>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          role === 'Admin'
                            ? 'bg-rose-100 text-rose-800'
                            : role === 'Accountant'
                            ? 'bg-emerald-100 text-emerald-800'
                            : role === 'Manager'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {role}
                      </span>
                      {u.access_role_ids && u.access_role_ids.length > 1 && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          (+{u.access_role_ids.length - 1} more roles)
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">{u.email}</p>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Entity Scoping Status */}
                    {role === 'Admin' || role === 'Accountant' ? (
                      <span className="text-emerald-700 font-semibold text-[11px] flex items-center space-x-1">
                        <Shield className="w-3 h-3" />
                        <span>Access to All Companies (Global)</span>
                      </span>
                    ) : role === 'Staff' ? (
                      <span className="text-slate-400 text-[11px]">Transaction Entry & View Only</span>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 text-[11px]">Assigned:</span>
                        {assigned.length === 0 ? (
                          <span className="text-rose-600 font-semibold text-[11px]">None</span>
                        ) : (
                          <div className="flex items-center space-x-1">
                            {assigned.map(uc => (
                              <span key={uc.company_id} className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                                {uc.company_id}
                              </span>
                            ))}
                          </div>
                        )}
                        {currentRole === 'Admin' && (
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                assignCompanyToUser(u.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="text-[11px] bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 cursor-pointer"
                          >
                            <option value="">+ Assign Company</option>
                            {companies.filter(c => !assigned.some(a => a.company_id === c.id)).map(c => (
                              <option key={c.id} value={c.id}>{c.id}: {c.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center space-x-1 border-l pl-3 border-slate-200">
                      <button
                        onClick={() => openEditUserDrawer(u)}
                        className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete User ${u.id} (${u.full_name})?`)) {
                            deleteUser(u.id);
                            setFeedback(`User ${u.id} deleted.`);
                            setTimeout(() => setFeedback(null), 4000);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BANK ACCOUNTS SUBTAB */}
      {/* ========================================================================= */}
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
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
              Last ID: <strong className="text-slate-800">{lastAccountId}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(currentRole === 'Manager' ? scopedAccounts : accounts).map(acc => {
              const comp = companies.find(c => c.id === acc.company_id);
              const sigs = signatories.filter(s => s.account_id === acc.id);

              return (
                <div
                  key={acc.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-rose-300 transition space-y-2.5 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-blue-900 font-mono text-sm">{acc.id}</span>
                      <span className="font-mono font-bold text-rose-700 px-2 py-0.5 bg-rose-50 rounded border border-rose-200">
                        {acc.account_currency}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditAccountDrawer(acc)}
                        className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Edit Account"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete Account ${acc.id} (${acc.bank_name})?`)) {
                            deleteAccount(acc.id);
                            setFeedback(`Account ${acc.id} deleted.`);
                            setTimeout(() => setFeedback(null), 4000);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{acc.bank_name}</h3>
                    <p className="text-slate-600 font-mono mt-0.5">Acc: {acc.account_number}</p>
                    <p className="text-slate-500">Company: {comp?.full_name}</p>
                    {acc.ifsc_code && <p className="text-slate-500 font-mono">IFSC: {acc.ifsc_code}</p>}
                    {acc.iban_number && <p className="text-slate-500 font-mono">IBAN: {acc.iban_number}</p>}
                    {acc.swift_code && <p className="text-slate-500 font-mono">SWIFT: {acc.swift_code}</p>}
                    {acc.bank_branch && <p className="text-slate-400 text-[11px] truncate">Branch: {acc.bank_branch}</p>}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                    <span className="font-semibold">Signatories:</span>{' '}
                    {sigs.map(s => allUsers.find(u => u.id === s.user_id)?.full_name).join(', ') || 'None assigned'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PARTIES SUBTAB (Full Width Cards with Edit/Delete & Tag Bubbles) */}
      {/* ========================================================================= */}
      {activeSubTab === 'parties' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Registered Outside Parties ({parties.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Clean Party System Names, raw aliases arrays (`party_name_raw`), CID customer tags, and banking coordinates.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
              Last ID: <strong className="text-slate-800">{lastPartyId}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parties.map(p => {
              const aliases = Array.isArray(p.party_name_raw)
                ? p.party_name_raw
                : p.party_name_raw
                ? [p.party_name_raw]
                : p.party_name
                ? [p.party_name]
                : [];

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-rose-300 transition space-y-2.5 text-xs shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-950 font-mono text-sm">{p.id}</span>
                      <div className="flex items-center space-x-1">
                        {p.cid_number && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded font-mono text-[10px]">
                            {p.cid_number}
                          </span>
                        )}
                        <button
                          onClick={() => openEditPartyDrawer(p)}
                          className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Edit Party"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete Party ${p.id} (${p.system_name || p.party_name})?`)) {
                              deleteParty(p.id);
                              setFeedback(`Party ${p.id} deleted.`);
                              setTimeout(() => setFeedback(null), 4000);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Delete Party"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{p.system_name || p.party_name}</h3>
                      {p.group_name && <p className="text-[11px] text-slate-500 font-medium">Group: {p.group_name}</p>}
                      {p.bank_name && (
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {p.bank_name} ({p.bank_country}) {p.account_number ? `• ${p.account_number}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Aliases Tag Bubbles */}
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Raw Aliases ({aliases.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {aliases.map((alias, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-50 text-rose-800 border border-rose-200"
                          >
                            <span>{alias}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Registered Outside Party</span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER 1: COMPANIES */}
      {/* ========================================================================= */}
      <SlideOverDrawer
        isOpen={isCompanyDrawerOpen}
        onClose={() => setIsCompanyDrawerOpen(false)}
        title={selectedCompanyId === 'NEW' ? 'Add New Company' : `Edit Company (${selectedCompanyId})`}
        subtitle="Manage StarRuby.in legal corporate entities and registry details."
        lastIdReference={`Last Company ID: ${lastCompanyId}`}
        onSubmit={handleSaveCompany}
        submitLabel={selectedCompanyId === 'NEW' ? 'Create Company' : 'Update Company'}
        onDelete={selectedCompanyId !== 'NEW' ? handleDeleteCompany : undefined}
      >
        <div className="space-y-4">
          {/* Company ID Selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Company ID</label>
            <select
              value={selectedCompanyId}
              onChange={e => handleCompanySelectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
            >
              <option value="NEW">-- Create New ID ({nextCompanyId}) --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id}: {c.full_name}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Reference: Last recorded ID is <strong className="text-slate-700 font-mono">{lastCompanyId}</strong>.
            </span>
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Full Legal Company Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={companyFullName}
              onChange={e => setCompanyFullName(e.target.value)}
              placeholder="e.g. StarRuby.in Private Limited"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              required
            />
          </div>

          {/* Email Input */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Official Company Email</label>
            <input
              type="email"
              value={companyEmail}
              onChange={e => setCompanyEmail(e.target.value)}
              placeholder="e.g. support@starruby.in"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
            />
          </div>
        </div>
      </SlideOverDrawer>

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER 2: USERS & ROLES */}
      {/* ========================================================================= */}
      <SlideOverDrawer
        isOpen={isUserDrawerOpen}
        onClose={() => setIsUserDrawerOpen(false)}
        title={selectedUserId === 'NEW' ? 'Add New Team User' : `Edit User (${selectedUserId})`}
        subtitle="Manage user authentication identity and assign multi-role security access."
        lastIdReference={`Last User ID: ${lastUserId}`}
        onSubmit={handleSaveUser}
        submitLabel={selectedUserId === 'NEW' ? 'Save User' : 'Update User'}
        onDelete={selectedUserId !== 'NEW' ? handleDeleteUser : undefined}
      >
        <div className="space-y-5">
          {/* User ID Selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">User ID</label>
            <select
              value={selectedUserId}
              onChange={e => handleUserSelectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
            >
              <option value="NEW">-- Create New ID ({nextUserId}) --</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.id}: {u.full_name} ({u.email})
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Reference: Last recorded user ID is <strong className="text-slate-700 font-mono">{lastUserId}</strong>.
            </span>
          </div>

          {/* Full Name */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={userFullName}
              onChange={e => setUserFullName(e.target.value)}
              placeholder="e.g. Harshil Zaveri"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Official Email <span className="text-rose-600">*</span>
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              placeholder="e.g. harshil@starruby.in"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              required
            />
          </div>

          {/* Assign Access Roles (Multiples supported per brief) */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Assign Access Roles (Can assign multiples)
            </label>
            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {accessLevels.map(lvl => {
                const isSelected = userSelectedRoles.includes(lvl.id);
                return (
                  <label
                    key={lvl.id}
                    className="flex items-center space-x-2.5 text-xs text-slate-800 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRole(lvl.id)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-mono font-bold text-rose-900">{lvl.id}</span>
                    <span className="font-bold">{lvl.level_type}</span>
                    <span className="text-slate-400 text-[11px]">({lvl.description})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* SUB-SECTION: Create New Access Roles Dynamically */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900 text-xs flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                <span>Create New Access Role (Dynamic)</span>
              </span>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-900 font-mono text-[10px] font-bold rounded">
                Last Access ID: {lastAccessId}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-purple-900 block mb-0.5">New Access ID</label>
                <input
                  type="text"
                  value={nextAccessId}
                  readOnly
                  className="w-full bg-white border border-purple-300 rounded p-1.5 font-mono text-xs font-bold text-purple-900"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-purple-900 block mb-0.5">Level Type</label>
                <select
                  value={newRoleLevelType}
                  onChange={e => setNewRoleLevelType(e.target.value as AccessLevelType)}
                  className="w-full bg-white border border-purple-300 rounded p-1.5 text-xs text-purple-900"
                >
                  <option value="Admin">Admin</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-purple-900 block mb-0.5">Role Description</label>
              <input
                type="text"
                value={newRoleDesc}
                onChange={e => setNewRoleDesc(e.target.value)}
                placeholder="e.g. Dubai Treasury Approver"
                className="w-full bg-white border border-purple-300 rounded p-1.5 text-xs text-purple-900"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateAccessRole}
              className="w-full py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
            >
              + Add Access Role to Database
            </button>
          </div>
        </div>
      </SlideOverDrawer>

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER 3: BANK ACCOUNTS */}
      {/* ========================================================================= */}
      <SlideOverDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
        title={selectedAccId === 'NEW' ? 'Add Bank Account' : `Edit Account (${selectedAccId})`}
        subtitle="Configure company accounts, currency, and international banking coordinates."
        lastIdReference={`Last Accounts ID: ${lastAccountId}`}
        onSubmit={handleSaveAccount}
        submitLabel={selectedAccId === 'NEW' ? 'Save Account' : 'Update Account'}
        onDelete={selectedAccId !== 'NEW' ? handleDeleteAccount : undefined}
      >
        <div className="space-y-4">
          {/* Account ID Selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Accounts ID</label>
            <select
              value={selectedAccId}
              onChange={e => handleAccountSelectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
            >
              <option value="NEW">-- Create New ID ({nextAccountId}) --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.id}: {a.bank_name} ({a.account_currency} - {a.account_number})
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Reference: Last recorded account ID is <strong className="text-slate-700 font-mono">{lastAccountId}</strong>.
            </span>
          </div>

          {/* Assign to Company */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Assign to Company <span className="text-rose-600">*</span>
            </label>
            <select
              value={accCompanyId}
              onChange={e => setAccCompanyId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id}: {c.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Bank Name & Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Bank Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={accBankName}
                onChange={e => setAccBankName(e.target.value)}
                placeholder="e.g. ICICI Bank"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Bank Country</label>
              <select
                value={accBankCountry}
                onChange={e => setAccBankCountry(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              >
                <option value="India">India</option>
                <option value="UAE">UAE</option>
                <option value="Thailand">Thailand</option>
                <option value="Belgium">Belgium</option>
                <option value="USA">USA</option>
              </select>
            </div>
          </div>

          {/* Account Number & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Account Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={accNumber}
                onChange={e => setAccNumber(e.target.value)}
                placeholder="Account #"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Account Currency</label>
              <select
                value={accCurrency}
                onChange={e => setAccCurrency(e.target.value as Currency)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
              >
                <option value="INR">INR (₹)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Account Holder & Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Account Holder</label>
              <input
                type="text"
                value={accHolder}
                onChange={e => setAccHolder(e.target.value)}
                placeholder="Legal entity / holder"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Bank Branch</label>
              <input
                type="text"
                value={accBranch}
                onChange={e => setAccBranch(e.target.value)}
                placeholder="Branch / Address"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          {/* IFSC, IBAN & Swift */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">IFSC Code</label>
              <input
                type="text"
                value={accIfsc}
                onChange={e => setAccIfsc(e.target.value)}
                placeholder="e.g. ICIC0000321"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">IBAN Number</label>
              <input
                type="text"
                value={accIban}
                onChange={e => setAccIban(e.target.value)}
                placeholder="AE19..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Swift Code</label>
              <input
                type="text"
                value={accSwift}
                onChange={e => setAccSwift(e.target.value)}
                placeholder="SWIFT"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
              />
            </div>
          </div>

          {/* Opening / Closing Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Creation Date</label>
              <input
                type="date"
                value={accCreationDate}
                onChange={e => setAccCreationDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Closing Date</label>
              <input
                type="date"
                value={accClosingDate}
                onChange={e => setAccClosingDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
          </div>
        </div>
      </SlideOverDrawer>

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER 4: PARTIES (Tag Bubbles & party_name_raw Array) */}
      {/* ========================================================================= */}
      <SlideOverDrawer
        isOpen={isPartyDrawerOpen}
        onClose={() => setIsPartyDrawerOpen(false)}
        title={selectedPartyId === 'NEW' ? 'Add Outside Party' : `Edit Party (${selectedPartyId})`}
        subtitle="Manage Party System Name, raw aliases array tag bubbles, and bank details."
        lastIdReference={`Last Party ID: ${lastPartyId}`}
        onSubmit={handleSaveParty}
        submitLabel={selectedPartyId === 'NEW' ? 'Save Party' : 'Update Party'}
        onDelete={selectedPartyId !== 'NEW' ? handleDeleteParty : undefined}
      >
        <div className="space-y-4">
          {/* Party ID Selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Party ID</label>
            <select
              value={selectedPartyId}
              onChange={e => handlePartySelectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold"
            >
              <option value="NEW">-- Create New ID ({nextPartyId}) --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.id}: {p.system_name || p.party_name}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Reference: Last recorded party ID is <strong className="text-slate-700 font-mono">{lastPartyId}</strong>.
            </span>
          </div>

          {/* Party System Name */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Clean Party System Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={partySystemName}
              onChange={e => setPartySystemName(e.target.value)}
              placeholder="Official clean company / vendor name"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              required
            />
          </div>

          {/* PARTY NAME ALIASES TAG BUBBLES (party_name_raw array) */}
          <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-rose-950 uppercase text-xs">
                Party Name Aliases (party_name_raw Array)
              </label>
              <span className="text-[10px] text-slate-500">
                {partyAliasesList.length} alias tag(s) mapped
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Messy raw spellings typed by staff that map directly to this clean party name:
            </p>

            {/* Tag Bubbles Render */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white rounded-lg border border-rose-200">
              {partyAliasesList.length === 0 ? (
                <span className="text-slate-400 text-[11px] italic">No alias tags added yet. Type below to add.</span>
              ) : (
                partyAliasesList.map((alias, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs"
                  >
                    <span>{alias}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAliasTag(alias)}
                      className="hover:text-rose-600 p-0.5 rounded-full hover:bg-rose-200 transition cursor-pointer"
                      title="Remove alias"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Inline Add Alias Tag Input */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                value={newAliasInput}
                onChange={e => setNewAliasInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAliasTag();
                  }
                }}
                placeholder="Type raw alias spelling (e.g. VismayZaveri) and press Add..."
                className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-rose-600"
              />
              <button
                type="button"
                onClick={handleAddAliasTag}
                className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                + Add Alias
              </button>
            </div>
          </div>

          {/* Group Name & CID Customer Tag */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Group Name</label>
              <input
                type="text"
                value={partyGroupName}
                onChange={e => setPartyGroupName(e.target.value)}
                placeholder="e.g. Thailand Suppliers"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Customer Tag (Manual CID)
              </label>
              <input
                type="text"
                value={partyCid}
                onChange={e => setPartyCid(e.target.value)}
                placeholder="e.g. CID10001 (Optional)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
              />
            </div>
          </div>

          {/* Bank Coordinates */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Party Bank Information (Optional)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">Bank Name</label>
                <input
                  type="text"
                  value={partyBankName}
                  onChange={e => setPartyBankName(e.target.value)}
                  placeholder="e.g. Mashreq Bank"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">Bank Country</label>
                <select
                  value={partyBankCountry}
                  onChange={e => setPartyBankCountry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="India">India</option>
                  <option value="UAE">UAE</option>
                  <option value="Thailand">Thailand</option>
                  <option value="Belgium">Belgium</option>
                  <option value="USA">USA</option>
                  <option value="Switzerland">Switzerland</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">Account Number</label>
                <input
                  type="text"
                  value={partyAccountNum}
                  onChange={e => setPartyAccountNum(e.target.value)}
                  placeholder="Party Account #"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">Account Currency</label>
                <select
                  value={partyCurrency}
                  onChange={e => setPartyCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">IBAN Number</label>
                <input
                  type="text"
                  value={partyIban}
                  onChange={e => setPartyIban(e.target.value)}
                  placeholder="IBAN"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">SWIFT Code</label>
                <input
                  type="text"
                  value={partySwift}
                  onChange={e => setPartySwift(e.target.value)}
                  placeholder="SWIFT"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={partyIfsc}
                  onChange={e => setPartyIfsc(e.target.value)}
                  placeholder="IFSC"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">Account Holder</label>
                <input
                  type="text"
                  value={partyAccountHolder}
                  onChange={e => setPartyAccountHolder(e.target.value)}
                  placeholder="Account Holder"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 text-[11px] uppercase mb-1">Bank Branch</label>
                <input
                  type="text"
                  value={partyBranch}
                  onChange={e => setPartyBranch(e.target.value)}
                  placeholder="Branch location"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </SlideOverDrawer>

    </div>
  );
};
