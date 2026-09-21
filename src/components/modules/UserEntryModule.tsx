import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserTransaction, Party, Account } from '../../types/database';
import { normalizeAlias } from '../../lib/alias';
import { getDaysDifference } from '../../lib/matching';
import { SlideOverDrawer } from '../common/SlideOverDrawer';
import {
  ArrowDownLeft,
  Upload,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Plus,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  Layers,
  Download,
  Calendar,
  Tag,
  Edit2,
  Trash2,
  RefreshCw,
  Building2,
  CreditCard,
  UserCheck,
  X,
} from 'lucide-react';
import { TransactionBoardModal } from './TransactionBoardModal';

export const UserEntryModule: React.FC = () => {
  const {
    allowedCompanies,
    companies,
    accounts,
    parties,
    partiesMap,
    partyTemplates,
    addPartyTemplate,
    incrementTemplateUsage,
    scopedAccounts,
    userTransactions,
    scopedUserTransactions,
    addUserTransaction,
    addUserTransactionsBatch,
    updateUserTransaction,
    deleteUserTransaction,
    addParty,
    activeCompanyId,
    currentUser,
    liveForexRates,
  } = useApp();

  // --------------------------------------------------------------------------
  // ID REFERENCE SAFEGUARDS (UTRN and PTY)
  // --------------------------------------------------------------------------
  const { lastTxnId, nextTxnId } = useMemo(() => {
    const maxNum = userTransactions.reduce((acc, t) => {
      const num = parseInt(t.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    return {
      lastTxnId: `UTRN${maxNum}`,
      nextTxnId: `UTRN${maxNum + 1}`,
    };
  }, [userTransactions]);

  const { lastPartyId } = useMemo(() => {
    const maxNum = parties.reduce((acc, p) => {
      const num = parseInt(p.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? acc : Math.max(acc, num);
    }, 100);
    return {
      lastPartyId: `PTY${maxNum}`,
    };
  }, [parties]);

  // --------------------------------------------------------------------------
  // MAIN FORM STATE (Cascading Company -> Account -> Party -> Details)
  // --------------------------------------------------------------------------
  // 1. Company Selection
  const initialCompany = activeCompanyId !== 'ALL'
    ? activeCompanyId
    : (allowedCompanies[0]?.id || 'COM1');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompany);

  // Sync selectedCompanyId when activeCompanyId or allowedCompanies changes
  useEffect(() => {
    if (activeCompanyId !== 'ALL') {
      setSelectedCompanyId(activeCompanyId);
    } else if (allowedCompanies.length > 0 && !allowedCompanies.some(c => c.id === selectedCompanyId)) {
      setSelectedCompanyId(allowedCompanies[0].id);
    }
  }, [activeCompanyId, allowedCompanies, selectedCompanyId]);

  // Cascading Accounts for selected Company
  const companyAccounts = useMemo(() => {
    return scopedAccounts.filter(a => a.company_id === selectedCompanyId);
  }, [scopedAccounts, selectedCompanyId]);

  // 2. Cascading Bank Account Selection
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    companyAccounts[0]?.id || scopedAccounts[0]?.id || ''
  );

  // Automatically update selectedAccountId when selectedCompanyId changes
  useEffect(() => {
    if (companyAccounts.length > 0) {
      if (!companyAccounts.some(a => a.id === selectedAccountId)) {
        setSelectedAccountId(companyAccounts[0].id);
      }
    } else {
      setSelectedAccountId('');
    }
  }, [companyAccounts, selectedAccountId]);

  // 3. Party Field with Searchable Dropdown & Suggestions
  const [partyInput, setPartyInput] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);

  // 4. Date of Transaction
  const [dateOfTxn, setDateOfTxn] = useState(new Date().toISOString().slice(0, 10));

  // 5. Amount & Status
  const [amount, setAmount] = useState<string>('');
  const [amountConfirmed, setAmountConfirmed] = useState<'Confirmed' | 'Unconfirmed'>('Confirmed');
  const [direction, setDirection] = useState<'Payment' | 'Receipt'>('Payment');

  // 6. Description & Reusable Templates
  const [description, setDescription] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // 7. Multi-Currency Exchange Rate
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [isRateManuallyEdited, setIsRateManuallyEdited] = useState<boolean>(false);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Active selected Account
  const activeAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Auto-pulled currency locked to selected account
  const currency = activeAccount?.account_currency || 'INR';
  const prevCurrencyRef = React.useRef(currency);

  // Automatically fetch & pre-fill live forex rate when selecting foreign currency
  useEffect(() => {
    let rateManuallyEdited = isRateManuallyEdited;

    if (prevCurrencyRef.current !== currency) {
      prevCurrencyRef.current = currency;
      setIsRateManuallyEdited(false);
      rateManuallyEdited = false;
    }

    if (currency !== 'INR') {
      if (!rateManuallyEdited) {
        const liveRate = liveForexRates?.ratesToInr?.[currency];
        if (liveRate) {
          setExchangeRate(String(liveRate));
        }
      }
    } else {
      setExchangeRate('');
    }
  }, [currency, liveForexRates, isRateManuallyEdited]);

  // Calculated INR amount if exchange rate provided
  const amountInInr = useMemo(() => {
    const numAmount = parseFloat(amount);
    const numRate = parseFloat(exchangeRate);
    if (!isNaN(numAmount) && !isNaN(numRate) && numRate > 0) {
      return Number((numAmount * numRate).toFixed(2));
    }
    return undefined;
  }, [amount, exchangeRate]);

  // Available Templates for selected party
  const availableTemplates = useMemo(() => {
    if (!selectedPartyId) return [];
    return partyTemplates
      .filter(t => t.party_id === selectedPartyId)
      .sort((a, b) => b.use_count - a.use_count);
  }, [selectedPartyId, partyTemplates]);

  // Party Auto-Suggestions (Searches system_name, party_name, CID, or raw alias)
  const partySuggestions = useMemo(() => {
    if (!partyInput.trim()) return parties.slice(0, 8);
    const q = partyInput.toLowerCase();
    return parties.filter(p => {
      const inSystem = p.system_name && p.system_name.toLowerCase().includes(q);
      const inPartyName = p.party_name && p.party_name.toLowerCase().includes(q);
      const inCid = p.cid_number && p.cid_number.toLowerCase().includes(q);
      const inRaw = Array.isArray(p.party_name_raw)
        ? p.party_name_raw.some(alias => alias.toLowerCase().includes(q))
        : typeof p.party_name_raw === 'string' && p.party_name_raw.toLowerCase().includes(q);
      return inSystem || inPartyName || inCid || inRaw;
    }).slice(0, 8);
  }, [partyInput, parties]);

  // --------------------------------------------------------------------------
  // LIVE DUPLICATE-CHECK PANEL (± 7 Days Window)
  // --------------------------------------------------------------------------
  const liveDuplicates = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!dateOfTxn || isNaN(numAmount) || !partyInput.trim()) return [];

    const inputNorm = normalizeAlias(partyInput);

    return scopedUserTransactions.filter(t => {
      if (t.account_id !== selectedAccountId || t.direction !== direction) return false;

      const daysDiff = getDaysDifference(dateOfTxn, t.date_of_transaction);
      if (daysDiff > 7) return false;

      const txnNorm = normalizeAlias(t.party_name_raw);
      const partyMatches = (inputNorm === txnNorm) || Boolean(selectedPartyId && selectedPartyId === t.party_id);
      const amountMatches = Math.abs(t.amount - numAmount) <= 5;

      return partyMatches && amountMatches;
    });
  }, [scopedUserTransactions, selectedAccountId, direction, dateOfTxn, partyInput, selectedPartyId, amount]);

  // --------------------------------------------------------------------------
  // ON-THE-FLY "+ ADD PARTY" DRAWER STATE & HANDLERS
  // --------------------------------------------------------------------------
  const [isAddPartyDrawerOpen, setIsAddPartyDrawerOpen] = useState(false);
  const [newPartySystemName, setNewPartySystemName] = useState('');
  const [newPartyCid, setNewPartyCid] = useState('');
  const [newPartyCountry, setNewPartyCountry] = useState('India');
  const [newPartyGroup, setNewPartyGroup] = useState('Vendor');
  const [newPartyAliasTags, setNewPartyAliasTags] = useState<string[]>([]);
  const [currentTagInput, setCurrentTagInput] = useState('');

  const openAddPartyDrawer = () => {
    setNewPartySystemName(partyInput.trim());
    setNewPartyCid('');
    setNewPartyCountry('India');
    setNewPartyGroup('Vendor');
    setNewPartyAliasTags(partyInput.trim() ? [partyInput.trim()] : []);
    setCurrentTagInput('');
    setIsAddPartyDrawerOpen(true);
  };

  const handleAddAliasTag = () => {
    const tag = currentTagInput.trim();
    if (!tag) return;
    if (!newPartyAliasTags.includes(tag)) {
      setNewPartyAliasTags(prev => [...prev, tag]);
    }
    setCurrentTagInput('');
  };

  const handleRemoveAliasTag = (tagToRemove: string) => {
    setNewPartyAliasTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleSaveNewParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartySystemName.trim()) {
      alert('Party System Name is required.');
      return;
    }

    const cleanName = newPartySystemName.trim();
    const finalAliases = newPartyAliasTags.length > 0 ? newPartyAliasTags : [cleanName];

    const createdParty = addParty({
      system_name: cleanName,
      party_name: cleanName,
      party_name_raw: finalAliases,
      cid_number: newPartyCid.trim() || undefined,
      country: newPartyCountry.trim() || undefined,
      group_name: newPartyGroup.trim() || undefined,
    });

    // Auto-select the freshly registered party in the transaction form!
    setSelectedPartyId(createdParty.id);
    setPartyInput(createdParty.system_name || createdParty.party_name);
    setIsAddPartyDrawerOpen(false);
    setFormFeedback(`Party ${createdParty.id} (${createdParty.system_name}) registered and selected!`);
    setTimeout(() => setFormFeedback(null), 4000);
  };

  // --------------------------------------------------------------------------
  // FORM SUBMIT (Create User Transaction)
  // --------------------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (!selectedAccountId) {
      setFormFeedback('Error: Please choose a valid bank account.');
      return;
    }
    if (!partyInput.trim()) {
      setFormFeedback('Error: Party name is required.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormFeedback('Error: Amount must be greater than 0.');
      return;
    }

    // Save as reusable template if checked
    if (saveAsTemplate && selectedPartyId && description.trim()) {
      addPartyTemplate(selectedPartyId, description.trim(), 'manual');
    }

    const newTxn = addUserTransaction({
      account_id: selectedAccountId,
      party_id: selectedPartyId,
      party_name_raw: partyInput.trim(),
      description: description.trim() || undefined,
      date_of_transaction: dateOfTxn,
      currency,
      amount: numAmount,
      amount_confirmed: amountConfirmed,
      amount_in_inr: amountInInr,
      exchange_rate: exchangeRate ? parseFloat(exchangeRate) : undefined,
      direction,
      verified_with_bank: 'No', // Rule 4: Bank side is supporting; default No
      source: 'manual',
    });

    setFormFeedback(`Success: Transaction ${newTxn.id} recorded successfully! (Next: ${newTxn.id.replace(/\d+/, n => String(Number(n) + 1))})`);
    setAmount('');
    setDescription('');
    setSaveAsTemplate(false);
    setIsRateManuallyEdited(false);
    setTimeout(() => setFormFeedback(null), 5000);
  };

  // --------------------------------------------------------------------------
  // EDIT TRANSACTION DRAWER (Full Record CRUD & Cell Versioning)
  // --------------------------------------------------------------------------
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<UserTransaction | null>(null);
  const [editAccountId, setEditAccountId] = useState('');
  const [editPartyInput, setEditPartyInput] = useState('');
  const [editPartyId, setEditPartyId] = useState<string | undefined>(undefined);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editAmountConfirmed, setEditAmountConfirmed] = useState<'Confirmed' | 'Unconfirmed'>('Confirmed');
  const [editDirection, setEditDirection] = useState<'Payment' | 'Receipt'>('Payment');
  const [editExchangeRate, setEditExchangeRate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const openEditTxnDrawer = (txn: UserTransaction) => {
    setEditingTxn(txn);
    setEditAccountId(txn.account_id);
    setEditPartyInput(txn.party_name_raw);
    setEditPartyId(txn.party_id);
    setEditDate(txn.date_of_transaction);
    setEditAmount(String(txn.amount));
    setEditAmountConfirmed(txn.amount_confirmed);
    setEditDirection(txn.direction);
    setEditExchangeRate(txn.exchange_rate ? String(txn.exchange_rate) : '');
    setEditDescription(txn.description || '');
    setIsEditDrawerOpen(true);
  };

  const handleUpdateTxn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    const numAmount = parseFloat(editAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Amount must be greater than 0.');
      return;
    }

    const editAcc = accounts.find(a => a.id === editAccountId);
    const editCurr = editAcc?.account_currency || editingTxn.currency;
    const numRate = parseFloat(editExchangeRate);
    const calcInr = !isNaN(numAmount) && !isNaN(numRate) && numRate > 0
      ? Number((numAmount * numRate).toFixed(2))
      : undefined;

    updateUserTransaction(editingTxn.id, {
      account_id: editAccountId,
      party_id: editPartyId,
      party_name_raw: editPartyInput.trim(),
      date_of_transaction: editDate,
      amount: numAmount,
      amount_confirmed: editAmountConfirmed,
      direction: editDirection,
      currency: editCurr,
      exchange_rate: !isNaN(numRate) && numRate > 0 ? numRate : undefined,
      amount_in_inr: calcInr,
      description: editDescription.trim() || undefined,
    });

    setIsEditDrawerOpen(false);
    setFormFeedback(`Transaction ${editingTxn.id} updated successfully.`);
    setTimeout(() => setFormFeedback(null), 4000);
  };

  const handleDeleteTxn = () => {
    if (!editingTxn) return;
    const reason = window.prompt(`Please provide a reason for deleting transaction ${editingTxn.id}:`);
    if (!reason || !reason.trim()) return;

    deleteUserTransaction(editingTxn.id, reason.trim());
    setIsEditDrawerOpen(false);
    setFormFeedback(`Transaction ${editingTxn.id} deleted. Audit trail logged.`);
    setTimeout(() => setFormFeedback(null), 4000);
  };

  // --------------------------------------------------------------------------
  // TABLE FILTERING (Date Range & Party Filter & Direction)
  // --------------------------------------------------------------------------
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPartyId, setFilterPartyId] = useState('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'Payment' | 'Receipt'>('ALL');
  const [filterConfirmed, setFilterConfirmed] = useState<'ALL' | 'Confirmed' | 'Unconfirmed'>('ALL');

  const filteredTransactions = useMemo(() => {
    return scopedUserTransactions.filter(txn => {
      // Date Range Filter
      if (filterStartDate && txn.date_of_transaction < filterStartDate) return false;
      if (filterEndDate && txn.date_of_transaction > filterEndDate) return false;

      // Party Filter
      if (filterPartyId !== 'ALL') {
        if (txn.party_id !== filterPartyId) return false;
      }

      // Direction Filter
      if (filterDirection !== 'ALL' && txn.direction !== filterDirection) return false;

      // Confirmed Filter
      if (filterConfirmed !== 'ALL' && txn.amount_confirmed !== filterConfirmed) return false;

      return true;
    });
  }, [scopedUserTransactions, filterStartDate, filterEndDate, filterPartyId, filterDirection, filterConfirmed]);

  const resetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterPartyId('ALL');
    setFilterDirection('ALL');
    setFilterConfirmed('ALL');
  };

  // Selected Transaction for Board Modal
  const [selectedBoardTxn, setSelectedBoardTxn] = useState<UserTransaction | null>(null);

  // --------------------------------------------------------------------------
  // CSV BATCH UPLOAD & SAMPLE DOWNLOAD
  // --------------------------------------------------------------------------
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);

  const handleDownloadSampleCsv = () => {
    const csvContent = [
      'Account_ID,Party_System_Name,Date,Amount,Confirmed_Status,Direction,Exchange_Rate,Description',
      'BNK1,Bangkok Gems & Stones Co.,2026-09-12,35000,Confirmed,Payment,1.0,Payment for sapphire rough lot',
      'BNK3,Blue Ocean Trading LLC,2026-09-13,82000,Unconfirmed,Payment,26.05,Prepayment invoice 4092',
      'BNK1,Raw Gem Importer,2026-09-14,15000,Confirmed,Receipt,1.0,Advance deposit for rubies',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'StarRuby_User_Transactions_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quoted-comma aware CSV line parser function
  const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentValue += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
    return values;
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        alert('CSV file must have a header row and at least one data row.');
        return;
      }

      const rows: any[] = [];
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 5) continue;

        const [accId, partyName, date, amtStr, confirmedStr, dirStr, rateStr, descStr] = cols;
        const numAmt = parseFloat(amtStr);
        const userAllowedAccounts = accounts.filter(a => allowedCompanies.some(c => c.id === a.company_id));
        const validAcc = userAllowedAccounts.some(a => a.id === accId);
        const validAmt = !isNaN(numAmt) && numAmt > 0;
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
        const validConfirmed = confirmedStr === 'Confirmed' || confirmedStr === 'Unconfirmed';
        const validDir = dirStr === 'Payment' || dirStr === 'Receipt';

        const isValid = validAcc && validAmt && validDate && validConfirmed && validDir;
        let errorMsg = '';
        if (!validAcc) errorMsg = `Invalid or out-of-scope Account ID (${accId}); `;
        if (!validAmt) errorMsg += 'Amount must be > 0; ';
        if (!validDate) errorMsg += 'Date must be YYYY-MM-DD; ';
        if (!validConfirmed) errorMsg += 'Status must be Confirmed/Unconfirmed; ';
        if (!validDir) errorMsg += 'Direction must be Payment/Receipt; ';

        rows.push({
          account_id: accId,
          party_name: partyName || '',
          date,
          amount: numAmt,
          amount_confirmed: validConfirmed ? confirmedStr : 'Confirmed',
          direction: validDir ? dirStr : 'Payment',
          exchange_rate: parseFloat(rateStr) || undefined,
          description: descStr || '',
          valid: isValid,
          error: errorMsg.trim() || undefined,
        });
      }
      setCsvPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const executeCsvImport = () => {
    const validRows = csvPreviewRows.filter(r => r.valid);
    if (validRows.length === 0) return;

    const toImport = validRows.map(row => {
      const acc = accounts.find(a => a.id === row.account_id);
      const curr = acc?.account_currency || 'INR';
      const rate = row.exchange_rate;
      const inr = rate && rate > 0 ? Number((row.amount * rate).toFixed(2)) : undefined;

      // Auto-match party if exists (defensively check row.party_name && row.party_name.toLowerCase())
      const rowPartyName = (row.party_name && typeof row.party_name === 'string') ? row.party_name.trim() : '';
      const rowPartyLower = rowPartyName ? rowPartyName.toLowerCase() : '';
      const matchedParty = rowPartyLower ? parties.find(
        p => (p.system_name && p.system_name.toLowerCase() === rowPartyLower) ||
             (p.party_name && p.party_name.toLowerCase() === rowPartyLower)
      ) : undefined;

      return {
        account_id: row.account_id,
        party_id: matchedParty?.id,
        party_name_raw: rowPartyName,
        date_of_transaction: row.date,
        currency: curr,
        amount: row.amount,
        amount_confirmed: row.amount_confirmed as 'Confirmed' | 'Unconfirmed',
        direction: row.direction as 'Payment' | 'Receipt',
        exchange_rate: rate,
        amount_in_inr: inr,
        description: row.description || undefined,
        verified_with_bank: 'No' as const,
        source: 'csv' as const,
      };
    });

    const created = addUserTransactionsBatch(toImport);

    setShowCsvModal(false);
    setCsvPreviewRows([]);
    setFormFeedback(`Successfully imported ${created.length} transactions from CSV.`);
    setTimeout(() => setFormFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* ==================================================================== */}
      {/* MODULE TITLE & ID REFERENCE SAFEGUARDS                               */}
      {/* ==================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
              <ArrowDownLeft className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold font-serif text-slate-900">User Transactions — Entry</h1>
                {/* Last Transaction ID Safeguard Badge */}
                <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-mono font-bold text-slate-700">
                  <span className="text-slate-500">Last ID:</span>
                  <span className="text-rose-700 font-bold">{lastTxnId}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-500">Next:</span>
                  <span className="text-emerald-700 font-bold">{nextTxnId}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                The Source of Truth for StarRuby.in &bull; Records what WE paid or received (works with zero bank data)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            onClick={handleDownloadSampleCsv}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
            title="Download formatted CSV template with sample data"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Download Sample CSV</span>
          </button>

          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-white" />
            <span>Upload Batch CSV</span>
          </button>
        </div>
      </div>

      {formFeedback ? (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
          formFeedback.startsWith('Error') ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        }`}>
          {formFeedback.startsWith('Error') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{formFeedback}</span>
        </div>
      ) : null}

      {/* ==================================================================== */}
      {/* MAIN ENTRY FORM (LEFT) + LIVE DUPLICATE SCANNER (RIGHT)               */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Re-ordered Entry Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-rose-700" />
              <span>Record Bank Transaction</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              Generated as: <strong className="text-rose-700">{nextTxnId}</strong>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. Company Selection (Client Brief Order 1) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Company <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-600"
                >
                  {allowedCompanies.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.id} &bull; {comp.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Cascading Bank Account (Client Brief Order 2) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Select Bank Account <span className="text-rose-600">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Filtered by {selectedCompanyId} ({companyAccounts.length} accounts)
                </span>
              </div>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-600"
              >
                {companyAccounts.length === 0 ? (
                  <option value="">No accounts found for this company</option>
                ) : (
                  companyAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.id} &bull; {acc.bank_name} ({acc.account_number}) — {acc.account_currency}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* 3 & 4. Party Searchable Dropdown + "+ Add Party" Button (Client Brief Order 3 & 4) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Party / System Name <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Select or register on-the-fly
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={partyInput}
                    onFocus={() => setIsPartyDropdownOpen(true)}
                    onChange={e => {
                      setPartyInput(e.target.value);
                      setIsPartyDropdownOpen(true);
                      const match = parties.find(
                        p => (p.system_name && p.system_name.toLowerCase() === e.target.value.toLowerCase()) ||
                             p.party_name.toLowerCase() === e.target.value.toLowerCase()
                      );
                      setSelectedPartyId(match?.id);
                    }}
                    placeholder="Search party system name or enter raw alias..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                  />
                  {partyInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setPartyInput('');
                        setSelectedPartyId(undefined);
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Direct "+ Add Party" Button */}
                <button
                  type="button"
                  onClick={openAddPartyDrawer}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer shrink-0 shadow-xs"
                  title="Register new party immediately without losing entered form data"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Party</span>
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {isPartyDropdownOpen && partySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                  <div className="p-2 bg-slate-100/80 text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center border-b">
                    <span>Parties in Database ({partySuggestions.length})</span>
                    <button
                      type="button"
                      onClick={() => setIsPartyDropdownOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>
                  {partySuggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPartyInput(p.system_name || p.party_name);
                        setSelectedPartyId(p.id);
                        setIsPartyDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 flex items-center justify-between border-b border-slate-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{p.system_name || p.party_name}</span>
                        {p.group_name && <span className="text-[10px] text-slate-500">{p.group_name} &bull; {p.country || 'Global'}</span>}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.id}</span>
                        {p.cid_number && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">{p.cid_number}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedPartyId && (
                <div className="mt-1.5 flex items-center space-x-2 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-semibold">
                    Mapped Party: {partiesMap.get(selectedPartyId)?.system_name || partiesMap.get(selectedPartyId)?.party_name} ({selectedPartyId})
                  </span>
                </div>
              )}
            </div>

            {/* 5, 6, 7. Date, Currency & Amount Row (Client Brief Order 5, 6, 7) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Transaction Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={dateOfTxn}
                  onChange={e => setDateOfTxn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Currency <span className="text-slate-400 font-normal text-[10px]">(Account)</span>
                </label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 select-none">
                  {currency}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Amount ({currency}) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono font-bold tabular-nums focus:outline-none focus:border-rose-600"
                />
              </div>
            </div>

            {/* 8 & 9. Amount Confirmation & Direction Toggles (Client Brief Order 8 & 9) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Amount Confirmation <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountConfirmed('Confirmed')}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      amountConfirmed === 'Confirmed'
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountConfirmed('Unconfirmed')}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      amountConfirmed === 'Unconfirmed'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Unconfirmed
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Direction <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('Payment')}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      direction === 'Payment'
                        ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Payment (Out)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('Receipt')}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      direction === 'Receipt'
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Receipt (In)
                  </button>
                </div>
              </div>
            </div>

            {/* 10. Multi-Currency Exchange Rate & INR Valuation (Client Brief Order 10) */}
            {currency !== 'INR' && (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 block">INR Valuation (Live Multi-Currency)</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-800 font-mono font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Live: 1 {currency} = ₹{liveForexRates?.ratesToInr?.[currency] || 26.02}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-slate-600 text-[11px] block">Exchange Rate to INR</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRateManuallyEdited(false);
                          const rate = liveForexRates?.ratesToInr?.[currency];
                          if (rate) setExchangeRate(String(rate));
                        }}
                        className="text-[10px] text-rose-700 hover:underline cursor-pointer font-semibold"
                      >
                        Reset to Live
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.0001"
                      value={exchangeRate}
                      onChange={e => {
                        setExchangeRate(e.target.value);
                        setIsRateManuallyEdited(true);
                      }}
                      placeholder="Auto-synced rate"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <span className="text-slate-600 text-[11px] block">Estimated INR Amount</span>
                    <span className="font-bold font-mono text-emerald-800 text-sm mt-1.5 block tabular-nums">
                      {amountInInr ? `₹ ${amountInInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 11. Description & Saved Templates (Client Brief Order 11) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Description / Purpose
                </label>
                {availableTemplates.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-normal">
                    {availableTemplates.length} saved templates for this party
                  </span>
                )}
              </div>

              {availableTemplates.length > 0 && (
                <div className="mb-2">
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        setDescription(e.target.value);
                        const tpl = availableTemplates.find(t => t.template_text === e.target.value);
                        if (tpl) incrementTemplateUsage(tpl.id);
                      }
                    }}
                    className="w-full bg-rose-50/70 border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-rose-900 focus:outline-none"
                  >
                    <option value="">-- Quick Pick Saved Template --</option>
                    {availableTemplates.map(t => (
                      <option key={t.id} value={t.template_text}>
                        {t.template_text} (Used {t.use_count}x)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What was this transaction for? (or type fresh line)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              />

              {selectedPartyId && description.trim() && (
                <label className="flex items-center space-x-2 mt-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Save as reusable template for this party</span>
                </label>
              )}
            </div>

            {/* 12 & 13. Status & Bank Verification (Read-Only Grayed Out, Client Brief Order 12 & 13) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Status <span className="text-[10px] text-slate-400 lowercase font-normal">(auto)</span>
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold flex items-center space-x-1.5 select-none">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Open (Awaiting match)</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Bank Verified? <span className="text-[10px] text-slate-400 lowercase font-normal">(auto)</span>
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold flex items-center space-x-1.5 select-none">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>No (Supporting rule)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>Save User Transaction</span>
              <span className="text-[10px] bg-rose-900/50 px-2 py-0.5 rounded font-mono font-normal">
                Generates {nextTxnId}
              </span>
            </button>
          </form>
        </div>

        {/* RIGHT: Live Duplicate Scanner Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white text-slate-900 p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-rose-700" />
              <span>Live Duplicate Scanner (± 7 Days)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Real-Time Safeguard</span>
          </div>

          <p className="text-xs text-slate-500">
            As you type, this panel surfaces transactions already recorded within 1 week of the selected date to prevent duplicate payments before saving.
          </p>

          {liveDuplicates.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2 opacity-90" />
              <span>No potential duplicate entries found for this date & party.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {liveDuplicates.map(d => {
                const daysDiff = getDaysDifference(dateOfTxn, d.date_of_transaction);
                const amountMatches = amount && Math.abs(d.amount - parseFloat(amount)) <= 5;

                return (
                  <div
                    key={d.id}
                    className={`p-3 rounded-xl border text-xs transition ${
                      amountMatches
                        ? 'bg-rose-50 border-rose-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-rose-800">{d.id}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {d.date_of_transaction} ({daysDiff}d apart)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                        {d.party_name_raw}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {d.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {d.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                        "{d.description}"
                      </p>
                    )}

                    {amountMatches && (
                      <div className="mt-2 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-lg flex items-center space-x-1 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-700" />
                        <span>Warning: Same amount & close date! Verify before saving.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ==================================================================== */}
      {/* FILTER BAR & RECENTLY RECORDED TRANSACTIONS TABLE                    */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Header & Interactive Filter Bar */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recently Recorded User Transactions</h3>
              <p className="text-xs text-slate-500">
                Click "Edit" on any row to modify transaction via slide-over drawer, or click "Board" for audit modal.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border">
                Showing {filteredTransactions.length} of {scopedUserTransactions.length} entries
              </span>
            </div>
          </div>

          {/* Table Filters (Client Brief Page 22) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs">
            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>

            {/* Party Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Party Filter
              </label>
              <select
                value={filterPartyId}
                onChange={e => setFilterPartyId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="ALL">All Parties</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.system_name || p.party_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Direction
              </label>
              <select
                value={filterDirection}
                onChange={e => setFilterDirection(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="ALL">All Directions</option>
                <option value="Payment">Payments Only</option>
                <option value="Receipt">Receipts Only</option>
              </select>
            </div>

            {/* Reset Filters */}
            <div>
              <button
                type="button"
                onClick={resetFilters}
                className="w-full py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b">
              <tr>
                <th className="p-3">Txn ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Account</th>
                <th className="p-3">Party Name</th>
                <th className="p-3 text-center">Direction</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Confirmed</th>
                <th className="p-3 text-center">Bank Verified</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 text-xs">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(txn => {
                  const acc = accounts.find(a => a.id === txn.account_id);
                  return (
                    <tr
                      key={txn.id}
                      className="hover:bg-rose-50/40 transition"
                    >
                      <td className="p-3 font-bold font-mono text-rose-900">{txn.id}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{txn.date_of_transaction}</td>
                      <td className="p-3 text-slate-800 font-medium">
                        {acc?.bank_name} ({acc?.account_currency})
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {txn.party_name_raw}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.direction === 'Payment' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {txn.direction}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        <div>{txn.currency} {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        {txn.currency !== 'INR' && txn.amount_in_inr ? (
                          <div className="text-[10px] text-slate-500 font-normal">
                            (~₹{txn.amount_in_inr.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.amount_confirmed === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {txn.amount_confirmed}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.verified_with_bank === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {txn.verified_with_bank}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          txn.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          txn.status === 'in_approval' ? 'bg-amber-100 text-amber-800' :
                          txn.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {txn.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditTxnDrawer(txn)}
                            className="p-1 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Edit transaction via slide-over drawer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedBoardTxn(txn)}
                            className="p-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Open transaction board"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(`Please provide a reason for deleting transaction ${txn.id}:`);
                              if (reason && reason.trim()) {
                                deleteUserTransaction(txn.id, reason.trim());
                                setFormFeedback(`Transaction ${txn.id} deleted. Audit trail logged.`);
                                setTimeout(() => setFormFeedback(null), 4000);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* QUICK ADD PARTY SLIDE-OVER DRAWER                                    */}
      {/* ==================================================================== */}
      <SlideOverDrawer
        isOpen={isAddPartyDrawerOpen}
        onClose={() => setIsAddPartyDrawerOpen(false)}
        title="Register New Party"
        subtitle="Quick-add vendor or client to database on the fly"
        lastIdReference={`Last Party ID: ${lastPartyId}`}
        onSubmit={handleSaveNewParty}
        submitLabel="Save & Select Party"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <strong>On-The-Fly Registration:</strong> Adding a party here will immediately select it in your transaction form without losing any entered numbers or details.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Party System Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={newPartySystemName}
              onChange={e => {
                setNewPartySystemName(e.target.value);
                if (newPartyAliasTags.length === 0 && e.target.value.trim()) {
                  setNewPartyAliasTags([e.target.value.trim()]);
                }
              }}
              placeholder="e.g. Bangkok Gems & Stones Co."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                CID Number (Optional)
              </label>
              <input
                type="text"
                value={newPartyCid}
                onChange={e => setNewPartyCid(e.target.value)}
                placeholder="e.g. CID-9941"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Country
              </label>
              <input
                type="text"
                value={newPartyCountry}
                onChange={e => setNewPartyCountry(e.target.value)}
                placeholder="e.g. Thailand, India, UAE"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Group / Category
            </label>
            <input
              type="text"
              value={newPartyGroup}
              onChange={e => setNewPartyGroup(e.target.value)}
              placeholder="e.g. Vendor, Buyer, Broker, Logistics"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
            />
          </div>

          {/* Interactive Tag Bubbles for Raw Name Aliases (party_name_raw) */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Raw Name Aliases (Tag Bubbles)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {newPartyAliasTags.length} tags
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Add any spelling variations or bank statement names that belong to this party.
            </p>

            {/* Tag Bubbles List */}
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[44px] mb-2">
              {newPartyAliasTags.length === 0 ? (
                <span className="text-slate-400 text-xs italic">No alias tags added yet</span>
              ) : (
                newPartyAliasTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-xs font-medium"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAliasTag(tag)}
                      className="text-rose-400 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Input to Add Tag */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={currentTagInput}
                onChange={e => setCurrentTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAliasTag();
                  }
                }}
                placeholder="Type alias & press Enter or click + Add"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={handleAddAliasTag}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </SlideOverDrawer>

      {/* ==================================================================== */}
      {/* EDIT USER TRANSACTION SLIDE-OVER DRAWER                              */}
      {/* ==================================================================== */}
      <SlideOverDrawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title={editingTxn ? `Edit Transaction ${editingTxn.id}` : 'Edit Transaction'}
        subtitle="Full record CRUD with automated cell-level versioning"
        lastIdReference={editingTxn ? `ID: ${editingTxn.id}` : undefined}
        onSubmit={handleUpdateTxn}
        submitLabel="Update Transaction"
        onDelete={handleDeleteTxn}
        deleteLabel="Delete Transaction"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Bank Account
            </label>
            <select
              value={editAccountId}
              onChange={e => setEditAccountId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.id} &bull; {acc.bank_name} ({acc.account_currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Party / System Name
            </label>
            <input
              type="text"
              required
              value={editPartyInput}
              onChange={e => setEditPartyInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                required
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Amount ({editingTxn?.currency || 'INR'})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Amount Confirmation
              </label>
              <select
                value={editAmountConfirmed}
                onChange={e => setEditAmountConfirmed(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Unconfirmed">Unconfirmed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Direction
              </label>
              <select
                value={editDirection}
                onChange={e => setEditDirection(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="Payment">Payment (Out)</option>
                <option value="Receipt">Receipt (In)</option>
              </select>
            </div>
          </div>

          {editingTxn?.currency !== 'INR' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Exchange Rate to INR
              </label>
              <input
                type="number"
                step="0.0001"
                value={editExchangeRate}
                onChange={e => setEditExchangeRate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Description / Purpose
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
            />
          </div>
        </div>
      </SlideOverDrawer>

      {/* ==================================================================== */}
      {/* CSV BATCH UPLOAD MODAL                                               */}
      {/* ==================================================================== */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold font-serif text-slate-900">Upload User Transactions CSV</h3>
                <p className="text-xs text-slate-500">
                  Import multiple entries at once using the standard StarRuby CSV template.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50 space-y-2">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                className="text-xs text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
              />
              <p className="text-[11px] text-slate-400">
                Supports CSV files with columns: Account_ID, Party_System_Name, Date, Amount, Confirmed_Status, Direction, Exchange_Rate, Description
              </p>
            </div>

            {csvPreviewRows.length > 0 && (
              <div className="border rounded-xl overflow-hidden text-xs max-h-52 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2">Account</th>
                      <th className="p-2">Party</th>
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreviewRows.map((r, idx) => (
                      <tr key={idx} className={r.valid ? 'bg-emerald-50/40' : 'bg-rose-50/40'}>
                        <td className="p-2 font-mono">{r.account_id}</td>
                        <td className="p-2 font-semibold text-slate-800">{r.party_name}</td>
                        <td className="p-2">{r.date}</td>
                        <td className="p-2 text-right font-mono font-bold">{r.amount}</td>
                        <td className="p-2 text-center">
                          {r.valid ? (
                            <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[10px]">Valid</span>
                          ) : (
                            <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded text-[10px]">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-xs text-rose-700 font-semibold hover:underline flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>

              <div className="flex space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeCsvImport}
                  disabled={csvPreviewRows.filter(r => r.valid).length === 0}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Import {csvPreviewRows.filter(r => r.valid).length} Valid Entries
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TRANSACTION BOARD MODAL                                              */}
      {/* ==================================================================== */}
      {selectedBoardTxn && (
        <TransactionBoardModal
          transaction={selectedBoardTxn}
          onClose={() => setSelectedBoardTxn(null)}
        />
      )}

    </div>
  );
};
