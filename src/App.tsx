import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';

import { DashboardModule } from './components/modules/DashboardModule';
import { MastersModule } from './components/modules/MastersModule';
import { UserEntryModule } from './components/modules/UserEntryModule';
import { BankEntryModule } from './components/modules/BankEntryModule';
import { DuplicatesModule } from './components/modules/DuplicatesModule';
import { PartyAliasesModule } from './components/modules/PartyAliasesModule';
import { MatchModule } from './components/modules/MatchModule';
import { ApprovalsModule } from './components/modules/ApprovalsModule';
import { DiscrepanciesModule } from './components/modules/DiscrepanciesModule';
import { PendingQueueModule } from './components/modules/PendingQueueModule';
import { StatementUploadsModule } from './components/modules/StatementUploadsModule';
import { StatementReconciliationModule } from './components/modules/StatementReconciliationModule';
import { DocumentsModule } from './components/modules/DocumentsModule';
import { VersionHistoryModule } from './components/modules/VersionHistoryModule';

import { LoginPage } from './components/auth/LoginPage';
import { useApp } from './context/AppContext';

const VALID_TABS: NavTab[] = [
  'dashboard',
  'masters',
  'user_entry',
  'bank_entry',
  'duplicates',
  'aliases',
  'match',
  'approvals',
  'discrepancies',
  'pending_queue',
  'statement_uploads',
  'statement_ledger',
  'documents',
  'versions',
];

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('starruby_active_tab') as NavTab | null;
      if (saved && VALID_TABS.includes(saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage access issues if in restrictive iframe/private browsing
    }
    return 'dashboard';
  });

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('starruby_active_tab', tab);
    } catch {
      // Ignore localStorage write failure
    }
  };

  const { lastRealtimeNotice } = useApp();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50/70 font-sans text-slate-900 relative">
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full min-h-0">
          {activeTab === 'dashboard' && <DashboardModule onNavigate={setActiveTab} />}
          {activeTab === 'masters' && <MastersModule />}
          {activeTab === 'user_entry' && <UserEntryModule />}
          {activeTab === 'bank_entry' && <BankEntryModule />}
          {activeTab === 'duplicates' && <DuplicatesModule />}
          {activeTab === 'aliases' && <PartyAliasesModule />}
          {activeTab === 'match' && <MatchModule />}
          {activeTab === 'approvals' && <ApprovalsModule />}
          {activeTab === 'discrepancies' && <DiscrepanciesModule onNavigateToMatch={() => setActiveTab('match')} />}
          {activeTab === 'pending_queue' && <PendingQueueModule />}
          {activeTab === 'statement_uploads' && <StatementUploadsModule />}
          {activeTab === 'statement_ledger' && <StatementReconciliationModule />}
          {activeTab === 'documents' && <DocumentsModule />}
          {activeTab === 'versions' && <VersionHistoryModule />}
        </main>
      </div>

      {/* Floating Realtime Multi-User Toast */}
      {lastRealtimeNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 bg-slate-900/95 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700/80 transition-all">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span className="font-semibold tracking-tight">{lastRealtimeNotice}</span>
        </div>
      )}
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <MainLayout />;
};

export function App() {
  return (
    <AppProvider>
      <AuthenticatedApp />
    </AppProvider>
  );
}

export default App;
