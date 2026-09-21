import React from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, Crown, Calculator, Briefcase, BadgeCheck, Menu, X } from 'lucide-react';

interface HeaderProps {
  onToggleMobileNav?: () => void;
  isMobileNavOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav, isMobileNavOpen }) => {
  const {
    currentUser,
    currentRole,
    activeCompanyId,
    setActiveCompanyId,
    allowedCompanies,
    isRealtimeConnected,
  } = useApp();

  const getRoleConfig = (role: string) => {
    switch (role) {
      case 'Admin':
        return {
          icon: Crown,
          iconBg: 'bg-gradient-to-br from-rose-600 via-rose-700 to-rose-950 text-white shadow-xs ring-2 ring-rose-100',
          badge: 'bg-rose-50 text-rose-700 border-rose-200/90',
          hoverBorder: 'hover:border-rose-300',
        };
      case 'Accountant':
        return {
          icon: Calculator,
          iconBg: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 text-white shadow-xs ring-2 ring-emerald-100',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
          hoverBorder: 'hover:border-emerald-300',
        };
      case 'Manager':
        return {
          icon: Briefcase,
          iconBg: 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 text-white shadow-xs ring-2 ring-amber-100',
          badge: 'bg-amber-50 text-amber-700 border-amber-200/90',
          hoverBorder: 'hover:border-amber-300',
        };
      case 'Staff':
      default:
        return {
          icon: BadgeCheck,
          iconBg: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-800 text-white shadow-xs ring-2 ring-indigo-100',
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/90',
          hoverBorder: 'hover:border-indigo-300',
        };
    }
  };

  const roleCfg = getRoleConfig(currentRole);
  const RoleIcon = roleCfg.icon;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs text-slate-900">
      {/* Top Thin Ruby Line */}
      <div className="h-1 bg-gradient-to-r from-rose-700 via-rose-600 to-amber-500 w-full" />

      <div className="w-full px-3 sm:px-6 flex items-center justify-between h-16">
        
        {/* Left: Hamburger (Mobile) & Brand Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="lg:hidden p-2 -ml-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileNavOpen ? <X className="w-5 h-5 text-rose-700" /> : <Menu className="w-5 h-5" />}
          </button>

          <img
            src="/star-ruby-banner.gif"
            alt="StarRuby.in"
            className="h-8 sm:h-10 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="hidden sm:block h-7 w-px bg-slate-200/90 mx-0.5 shrink-0" />
          <div className="hidden sm:flex flex-col justify-center">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Banking & Treasury
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-rose-50 text-rose-700 border border-rose-200/80">
                ERP
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium tracking-normal whitespace-nowrap hidden xl:inline">
              StarRuby Group Treasury Governance
            </span>
          </div>
        </div>

        {/* Center: Entity Scope Selector & Realtime Connection Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-slate-50 hover:bg-slate-100/90 rounded-xl px-2.5 sm:px-3.5 py-1.5 border border-slate-200/90 shadow-2xs transition max-w-[130px] sm:max-w-none">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-700 shrink-0" />
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider hidden lg:inline">Entity:</span>
            <select
              value={activeCompanyId}
              onChange={(e) => setActiveCompanyId(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 sm:pr-2 py-0.5 truncate w-full"
            >
              {currentRole === 'Admin' || currentRole === 'Accountant' || currentRole === 'Staff' ? (
                <option value="ALL" className="bg-white text-slate-800">All (Global)</option>
              ) : null}
              {allowedCompanies.map((comp) => (
                <option key={comp.id} value={comp.id} className="bg-white text-slate-800">
                  {comp.id}: {comp.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Realtime Live Pulse Indicator */}
          <div
            className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isRealtimeConnected
                ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/90 shadow-2xs'
                : 'bg-amber-50/90 text-amber-800 border-amber-200/90 shadow-2xs'
            }`}
            title={
              isRealtimeConnected
                ? 'Supabase WebSocket Realtime connected (< 100ms multi-user sync)'
                : 'Connecting to Supabase Realtime WebSocket...'
            }
          >
            <span className="relative flex h-2 w-2">
              {isRealtimeConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <span className="text-[11px] tracking-tight font-bold hidden lg:inline">
              {isRealtimeConnected ? 'Realtime Live' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Right: Executive Role-Badged User Identity */}
        <div className={`flex items-center space-x-2 sm:space-x-3 bg-white hover:bg-slate-50/90 p-1.5 sm:pl-2.5 sm:pr-4 sm:py-2 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all ${roleCfg.hoverBorder} shrink-0`}>
          {/* 1. Color-Coded Role Logo */}
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${roleCfg.iconBg}`} title={`Role: ${currentRole} (${currentUser.full_name})`}>
            <RoleIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
          </div>

          {/* 2. Full Name & 3. Role Badge */}
          <div className="hidden sm:flex flex-col justify-center">
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 tracking-tight leading-none truncate max-w-[120px] lg:max-w-[170px]">
              {currentUser.full_name}
            </span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md border ${roleCfg.badge} shadow-2xs leading-none`}>
                {currentRole}
              </span>
              <span className="flex items-center space-x-1 text-[10px] font-semibold text-slate-400 leading-none hidden md:inline-flex">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span>Active</span>
              </span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};

