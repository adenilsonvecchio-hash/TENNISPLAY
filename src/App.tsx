import React, { useState, useEffect } from 'react';
import { AuthSession } from './types';
import { DbService } from './lib/db';
import { getSupabaseClient } from './lib/supabase';
import { AppLogo } from './components/AppLogo';
import { HomeLanding } from './components/HomeLanding';
import { AuthModal } from './components/AuthModal';
import { AppShell } from './components/AppShell';
import { Dashboard } from './components/Dashboard';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { UserManualModal } from './components/UserManualModal';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [viewMode, setViewMode] = useState<'MANAGER' | 'PLAYER'>('MANAGER');
  const [authModalMode, setAuthModalMode] = useState<'OWNER_REGISTER' | 'ADMIN_LOGIN' | 'PLAYER_REGISTER' | 'LOGIN' | null>(null);
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);

  // Restore session from Supabase Auth on load and listen to auth state changes
  useEffect(() => {
    DbService.restoreSession().then((s) => {
      if (s) setSession(s);
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          DbService.restoreSession().then((s) => {
            if (s) setSession(s);
          });
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const handleAuthSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setAuthModalMode(null);
    setActiveTab('overview');
  };

  const handleUpdateSession = (newSession: AuthSession | null) => {
    setSession(newSession);
    if (!newSession) {
      setActiveTab('overview');
    }
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === 'MANAGER' ? 'PLAYER' : 'MANAGER'));
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-900 font-sans selection:bg-[#C6FF00] selection:text-[#0B1633]">
      
      {/* 1. UNAUTHENTICATED: Home Landing Page */}
      {!session ? (
        <HomeLanding
          onSelectAction={(mode) => setAuthModalMode(mode)}
          onOpenSupabaseModal={() => setShowSupabaseModal(true)}
          onOpenManualPdf={() => setShowManualModal(true)}
        />
      ) : (
        /* 2. AUTHENTICATED: Mobile-First App Shell Layout */
        <AppShell
          session={session}
          onUpdateSession={handleUpdateSession}
          onOpenCreateGroup={() => setAuthModalMode('OWNER_REGISTER')}
          onOpenManualPdf={() => setShowManualModal(true)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
        >
          <Dashboard
            session={session}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onUpdateSession={handleUpdateSession}
            onOpenCreateGroup={() => setAuthModalMode('OWNER_REGISTER')}
            viewMode={viewMode}
          />
        </AppShell>
      )}

      {/* Auth / Modal Handler */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={handleAuthSuccess}
          onChangeMode={(newMode) => setAuthModalMode(newMode)}
        />
      )}

      {/* Supabase Schema & Config Modal */}
      {showSupabaseModal && (
        <SupabaseConfigModal onClose={() => setShowSupabaseModal(false)} />
      )}

      {/* User Manual & PDF Export Modal */}
      <UserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />

    </div>
  );
}

