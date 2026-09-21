import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Building,
  ArrowDownLeft,
  Landmark,
  Copy,
  Tag,
  GitMerge,
  CheckCheck,
  AlertTriangle,
  Clock,
  CalendarCheck,
  FileSpreadsheet,
  FileText,
  History,
  LogOut,
  X,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'masters'
  | 'user_entry'
  | 'bank_entry'
  | 'duplicates'
  | 'aliases'
  | 'match'
  | 'approvals'
  | 'discrepancies'
  | 'pending_queue'
  | 'statement_uploads'
  | 'statement_ledger'
  | 'documents'
  | 'versions';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const {
    scopedUserTransactions,
    partyAliases,
    scopedPendingTransactions,
    currentUser,
    logout,
  } = useApp();

  // Badges calculation (scoped to user's assigned entity workload)
  const unmappedAliasesCount = partyAliases.filter(a => a.status === 'unmapped').length;
  const inApprovalCount = scopedUserTransactions.filter(t => t.status === 'in_approval').length;
  const pendingSuggestedCount = scopedPendingTransactions.filter(p => p.status === 'suggested').length;
  const unconfirmedTxnsCount = scopedUserTransactions.filter(t => t.amount_confirmed === 'Unconfirmed').length;

  const navGroups = [
    {
      title: 'CORE OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard & Metrics', icon: LayoutDashboard },
        { id: 'masters', label: 'Masters & Setup', icon: Building },
      ],
    },
    {
      title: 'DATA ENTRY (SOURCE OF TRUTH)',
      items: [
        { id: 'user_entry', label: 'User Transactions', icon: ArrowDownLeft },
        { id: 'bank_entry', label: 'Bank Statement Lines', icon: Landmark },
      ],
    },
    {
      title: 'VERIFICATION & MATCHING',
      items: [
        { id: 'duplicates', label: 'Duplicates Triage', icon: Copy },
        { id: 'aliases', label: 'Party Aliases Queue', icon: Tag, badge: unmappedAliasesCount },
        { id: 'match', label: 'Match & Reconcile (L1)', icon: GitMerge },
        { id: 'approvals', label: '3-Layer Approvals', icon: CheckCheck, badge: inApprovalCount },
        { id: 'discrepancies', label: 'Pending Discrepancies', icon: AlertTriangle, badge: unconfirmedTxnsCount },
        { id: 'pending_queue', label: 'Pending Queue (Calendar)', icon: Clock, badge: pendingSuggestedCount },
      ],
    },
    {
      title: 'AUDIT & TREASURY',
      items: [
        { id: 'statement_uploads', label: 'Monthly Statement Grid', icon: CalendarCheck },
        { id: 'statement_ledger', label: 'Statement Running Ledger', icon: FileSpreadsheet },
        { id: 'documents', label: 'R2 Documents & Search', icon: FileText },
        { id: 'versions', label: 'Cell Version History', icon: History },
      ],
    },
  ];

  const handleItemClick = (id: NavTab) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavContent = () => (
    <>
      <div className="p-3 space-y-5 flex-1 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {group.title}
            </h3>
            <div className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id as NavTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-rose-50 text-rose-900 font-bold shadow-xs border-l-4 border-rose-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-rose-700' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && item.badge > 0 ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200 leading-none shrink-0">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Pinned Sign Out Action */}
      <div className="p-3 border-t border-slate-200/90 bg-slate-50/90 shrink-0">
        <button
          onClick={() => {
            if (window.confirm(`Sign out of ${currentUser.full_name}'s session?`)) {
              logout();
            }
          }}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer group"
          title="Sign out of StarRuby Banking ERP"
        >
          <LogOut className="w-4 h-4 text-rose-600 group-hover:text-rose-700 transition shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Permanent Static Sidebar (Hidden on < lg) */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/90 text-slate-700 flex-col shrink-0 h-full overflow-hidden">
        {renderNavContent()}
      </aside>

      {/* Mobile / Tablet Off-Canvas Sliding Drawer (Visible when isOpenMobile is true on < lg) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop blur overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />

          {/* Off-canvas panel */}
          <aside className="relative w-72 max-w-[85vw] bg-white text-slate-700 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 font-serif">Navigation</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-rose-50 text-rose-700 border border-rose-200">
                  ERP
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                title="Close Navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
};
