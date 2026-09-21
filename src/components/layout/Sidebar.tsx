import React, { useEffect, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
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
  isDesktopCollapsed?: boolean;
  onToggleDesktop?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile = false,
  onCloseMobile,
  isDesktopCollapsed = false,
  onToggleDesktop,
}) => {
  const [isRenderedMobile, setIsRenderedMobile] = useState(isOpenMobile);
  const [isAnimatingMobile, setIsAnimatingMobile] = useState(false);

  useEffect(() => {
    if (isOpenMobile) {
      setIsRenderedMobile(true);
      const raf = requestAnimationFrame(() => {
        setIsAnimatingMobile(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsAnimatingMobile(false);
      const timer = setTimeout(() => {
        setIsRenderedMobile(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpenMobile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpenMobile && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);
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

  const renderNavContent = (collapsed: boolean = false) => (
    <>
      <div className={`space-y-4 flex-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-3 space-y-5'}`}>
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {collapsed ? (
              idx > 0 && <div className="my-2 border-t border-slate-200/80 mx-1" />
            ) : (
              <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {group.title}
              </h3>
            )}
            <div className={`space-y-0.5 ${collapsed ? '' : 'pt-1'}`}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                if (collapsed) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id as NavTab)}
                      title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                      className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer select-none relative ${
                        isActive
                          ? 'bg-rose-100 text-rose-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-rose-700' : 'text-slate-500'}`} />
                      {item.badge && item.badge > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 text-[8px] font-bold rounded-full bg-rose-600 text-white flex items-center justify-center ring-2 ring-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id as NavTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                      isActive
                        ? 'bg-rose-50 text-rose-950 font-bold shadow-2xs border-l-4 border-rose-700 pl-2.5'
                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`w-4 h-4 shrink-0 transition-colors duration-150 ${isActive ? 'text-rose-700' : 'text-slate-400'}`} />
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

      {/* Bottom Pinned Actions */}
      <div className={`border-t border-slate-200/90 bg-slate-50/90 shrink-0 space-y-2 ${collapsed ? 'p-2 flex flex-col items-center' : 'p-3'}`}>
        {onToggleDesktop && (
          <button
            type="button"
            onClick={onToggleDesktop}
            className={`flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer ${
              collapsed ? 'w-10 h-10' : 'w-full space-x-1.5 py-1.5 px-3 text-[11px] font-medium'
            }`}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        )}

        <button
          onClick={() => {
            if (window.confirm(`Sign out of ${currentUser.full_name}'s session?`)) {
              logout();
            }
          }}
          className={`flex items-center justify-center bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl transition shadow-xs cursor-pointer group ${
            collapsed ? 'w-10 h-10 p-0 text-rose-600' : 'w-full space-x-2 px-3 py-2.5 text-xs font-semibold'
          }`}
          title="Sign out of StarRuby Banking ERP"
        >
          <LogOut className="w-4 h-4 text-rose-600 group-hover:text-rose-700 transition shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Collapsible Icon-Rail Sidebar */}
      <aside
        className={`hidden lg:flex bg-white text-slate-700 flex-col shrink-0 h-full overflow-hidden transition-all duration-200 ease-in-out border-r border-slate-200/90 ${
          isDesktopCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderNavContent(isDesktopCollapsed)}
      </aside>

      {/* Mobile / Tablet Off-Canvas Sliding Drawer */}
      {isRenderedMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop blur overlay with smooth fade */}
          <div
            className={`fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-250 ease-out ${
              isAnimatingMobile ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Off-canvas panel with smooth slide */}
          <aside
            className={`relative w-72 max-w-[85vw] bg-white text-slate-700 flex flex-col h-full shadow-2xl z-10 border-r border-slate-200 transform transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isAnimatingMobile ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
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
