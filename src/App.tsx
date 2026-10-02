import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './components/landing/LandingPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { FloatingNotificationCorner } from './components/notifications/FloatingNotificationCorner';
import { GlobalSaaSAnimations } from './components/ui/GlobalSaaSAnimations';
import { Lead } from './types';
import { 
  LayoutDashboard,
  Users, 
  Sparkles, 
  Inbox, 
  Send, 
  Server, 
  FileText,
  BarChart3,
  Bot, 
  ShieldCheck, 
  Grid
} from 'lucide-react';

// Static imports so all views and modals bundle into a single self-contained file with zero stale chunk requests
import { SmartInbox } from './components/inbox/SmartInbox';
import { CampaignManager } from './components/campaigns/CampaignManager';
import { LeadDirectory } from './components/leads/LeadDirectory';
import { AILeadGenerator } from './components/leads/AILeadGenerator';
import { TemplateManager } from './components/templates/TemplateManager';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SMTPManager } from './components/smtp/SMTPManager';
import { SentMailsTracker } from './components/sent/SentMailsTracker';
import { GeminiAssistant } from './components/ai/GeminiAssistant';
import { OwnerPanel } from './components/owner/OwnerPanel';
import { TrashManager } from './components/trash/TrashManager';
import { GoogleDriveStorageView } from './components/drive/GoogleDriveStorageView';
import { MobileNavDrawer } from './components/layout/MobileNavDrawer';
import { AuthModal } from './components/auth/AuthModal';
import { LogoutConfirmModal } from './components/auth/LogoutConfirmModal';
import { ProfileModal } from './components/profile/ProfileModal';
import { SendMailModal } from './components/mail/SendMailModal';
import { BkashSubscriptionModal } from './components/billing/BkashSubscriptionModal';

const MainContent: React.FC = () => {
  const { 
    isAuthenticated,
    activeTab, 
    setActiveTab, 
    threads, 
    currentUser, 
    isLogoutConfirmOpen, 
    setIsLogoutConfirmOpen, 
    logout,
    activeFollowUpCohort,
    wizardLaunchRequest
  } = useApp();
  
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authInitialPortal, setAuthInitialPortal] = useState<'client' | 'agency'>('client');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup' | 'forgot_password'>('signin');
  const [authInitialPlan, setAuthInitialPlan] = useState<string>('scale');

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isBillingOpen, setIsBillingOpen] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isSendMailOpen, setIsSendMailOpen] = useState<boolean>(false);
  const [selectedLeadForMail, setSelectedLeadForMail] = useState<Lead | undefined>(undefined);
  const [hasVisitedCampaigns, setHasVisitedCampaigns] = useState<boolean>(activeTab === 'campaigns');

  useEffect(() => {
    if (activeTab === 'campaigns' || activeFollowUpCohort || wizardLaunchRequest?.open) {
      setHasVisitedCampaigns(true);
    }
  }, [activeTab, activeFollowUpCohort, wizardLaunchRequest]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLogoutConfirmOpen) setIsLogoutConfirmOpen(false);
        else if (isSendMailOpen) setIsSendMailOpen(false);
        else if (isBillingOpen) setIsBillingOpen(false);
        else if (isProfileOpen) setIsProfileOpen(false);
        else if (isAuthOpen) setIsAuthOpen(false);
        else if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogoutConfirmOpen, isSendMailOpen, isBillingOpen, isProfileOpen, isAuthOpen, isMobileDrawerOpen, setIsLogoutConfirmOpen]);

  const unreadCount = threads.filter(t => !t.isTrash && t.unreadCount > 0).length;

  const handleOpenAuth = (
    mode: 'signin' | 'signup' | 'forgot_password' = 'signin',
    portal: 'client' | 'agency' = 'client',
    plan: string = 'scale'
  ) => {
    setAuthInitialMode(mode);
    setAuthInitialPortal(portal);
    setAuthInitialPlan(plan);
    setIsAuthOpen(true);
  };

  const handleOpenSendMail = (lead?: Lead) => {
    setSelectedLeadForMail(lead);
    setIsSendMailOpen(true);
  };

  const isAgencySession =
    currentUser.role === 'agency' ||
    currentUser.role === 'owner' ||
    Boolean(currentUser.isOwner);

  const hasVerifiedClientPayment = Boolean(
    currentUser.paymentInfo?.trxId &&
      currentUser.paymentInfo?.trxId !== 'BKA9823KL12' &&
      currentUser.paymentInfo?.trxId !== 'BKEV6RCP8X' &&
      currentUser.paymentInfo?.status !== 'rejected'
  );

  // If user is not authenticated OR is a client without a verified bKash payment, render Landing Page
  if (!isAuthenticated || (!isAgencySession && !hasVerifiedClientPayment)) {
    return (
      <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <LandingPage onOpenAuth={handleOpenAuth} />
        
        {/* Auth Modal for Sign in / Sign up / Forgot Password */}
        {isAuthOpen && (
          <AuthModal 
            isOpen={isAuthOpen} 
            onClose={() => setIsAuthOpen(false)}
            initialPortal={authInitialPortal}
            initialMode={authInitialMode}
            initialPlan={authInitialPlan}
          />
        )}

        {/* Global Notifications */}
        <FloatingNotificationCorner />

        {/* Global Modern SaaS Interactive Click & Cursor Animations */}
        <GlobalSaaSAnimations />
      </div>
    );
  }

  // Helper to render locked service view if customer's permission is turned off by Owner
  const renderRestrictedServiceView = (serviceName: string, serviceIcon: React.ReactNode) => (
    <div className="p-6 md:p-12 max-w-2xl mx-auto text-center space-y-6 animate-in fade-in">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/50">
        {serviceIcon}
      </div>
      <div className="space-y-2">
        <span className="px-3 py-1 text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-full">
          🔒 Service Disabled by Workspace Owner
        </span>
        <h2 className="text-2xl font-black text-slate-100 mt-3">{serviceName} Access Restricted</h2>
        <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
          The Workspace Owner has disabled <strong>{serviceName}</strong> for your account (<code className="text-cyan-300">{currentUser.email}</code>). 
          Please contact your administrator or upgrade your subscription plan to restore access.
        </p>
      </div>

      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs text-slate-300 max-w-md mx-auto space-y-2 text-left">
        <div className="font-bold text-slate-200 flex items-center gap-2">
          <span>Current Account Plan:</span>
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-extrabold uppercase">
            {currentUser.plan} Tier
          </span>
        </div>
        <div className="text-slate-400 text-[11px]">
          Status: <span className="text-rose-400 font-bold">{currentUser.permissions?.accountStatus === 'suspended' ? 'Account Suspended' : 'Feature Restricted'}</span>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('dashboard')}
        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
      >
        &larr; Return to Dashboard
      </button>
    </div>
  );

  const renderActiveView = () => {
    const isAgency = currentUser.role === 'agency' || currentUser.role === 'owner' || Boolean(currentUser.isOwner) || currentUser.email === 'sojibdaridro123@gmail.com' || currentUser.email === 'rafiqulvisualsky@gmail.com';
    const isClientRole = !isAgency && (currentUser.role === 'client' || currentUser.role === 'customer');
    
    // Check if account is suspended
    if (isClientRole && currentUser.permissions?.accountStatus === 'suspended') {
      return renderRestrictedServiceView('Entire Account', <ShieldCheck className="w-10 h-10" />);
    }

    // Check specific module permissions for clients
    if (isClientRole) {
      if (activeTab === 'generator' && currentUser.permissions?.leadMinerEnabled === false) {
        return renderRestrictedServiceView('AI Lead Miner', <Sparkles className="w-10 h-10" />);
      }
      if (activeTab === 'inbox' && currentUser.permissions?.smartInboxEnabled === false) {
        return renderRestrictedServiceView('Smart Unified Inbox', <Inbox className="w-10 h-10" />);
      }
      if (activeTab === 'campaigns' && currentUser.permissions?.campaignAutomationEnabled === false) {
        return renderRestrictedServiceView('Campaign Wizard & Sequences', <Send className="w-10 h-10" />);
      }
      if (activeTab === 'smtp' && currentUser.permissions?.smtpRotationEnabled === false) {
        return renderRestrictedServiceView('SMTP / IMAP Hub', <Server className="w-10 h-10" />);
      }
      if (activeTab === 'ai_copilot' && currentUser.permissions?.aiCopilotEnabled === false) {
        return renderRestrictedServiceView('AI Outreach Copilot', <Bot className="w-10 h-10" />);
      }
      if (activeTab === 'templates' && currentUser.permissions?.templatesEnabled === false) {
        return renderRestrictedServiceView('Templates & Anti-Spam Audit', <FileText className="w-10 h-10" />);
      }
      if (activeTab === 'analytics' && currentUser.permissions?.analyticsEnabled === false) {
        return renderRestrictedServiceView('Deliverability Radar', <BarChart3 className="w-10 h-10" />);
      }
      if (activeTab === 'owner') {
        return renderRestrictedServiceView('Agency Master Dashboard (Requires Agency Role)', <ShieldCheck className="w-10 h-10" />);
      }
    }

    switch (activeTab) {
      case 'dashboard':
        return <MainDashboard onOpenSendMail={() => handleOpenSendMail()} onOpenLeadModal={() => setActiveTab('leads')} />;
      case 'leads':
        return <LeadDirectory onOpenSendMail={(lead) => handleOpenSendMail(lead)} />;
      case 'generator':
        return <AILeadGenerator />;
      case 'inbox':
        return <SmartInbox />;
      case 'sent':
      case 'outbox':
        return <SentMailsTracker onOpenSendMail={(lead) => handleOpenSendMail(lead)} />;
      case 'campaigns':
        return null;
      case 'templates':
        return <TemplateManager />;
      case 'analytics':
        return <AnalyticsView />;
      case 'smtp':
        return <SMTPManager />;
      case 'ai_copilot':
        return <GeminiAssistant />;
      case 'owner':
        return <OwnerPanel />;
      case 'drive_storage':
        return <GoogleDriveStorageView onOpenSendMail={() => handleOpenSendMail()} />;
      case 'trash':
        return <TrashManager />;
      default:
        return <MainDashboard onOpenSendMail={() => handleOpenSendMail()} onOpenLeadModal={() => setActiveTab('leads')} />;
    }
  };

  const isAgencyAccount =
    currentUser.role === 'agency' ||
    currentUser.role === 'owner' ||
    Boolean(currentUser.isOwner) ||
    currentUser.email === 'sojibdaridro123@gmail.com' ||
    currentUser.email === 'rafiqulvisualsky@gmail.com';
  const isCampaignsRestricted =
    !isAgencyAccount &&
    (currentUser.permissions?.campaignAutomationEnabled === false ||
      currentUser.permissions?.accountStatus === 'suspended');

  return (
    <div className="h-screen w-full bg-[#080c14] text-slate-100 flex flex-col overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar 
        onOpenAuth={() => setIsAuthOpen(true)} 
        onOpenSendMail={() => handleOpenSendMail()} 
        onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
      />

      {/* Body Layout: Sidebar + Main Content View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar onOpenBilling={() => setIsBillingOpen(true)} />

        <main
          className={`flex-1 min-h-0 relative ${
            activeTab === 'inbox'
              ? 'flex flex-col overflow-hidden pb-[60px] md:pb-0'
              : 'overflow-y-auto overflow-x-hidden pb-20 md:pb-6'
          }`}
        >
          <div className={`saas-view-enter ${activeTab === 'inbox' ? 'h-full flex flex-col min-h-0' : 'min-h-full'}`}>
            {renderActiveView()}
            {(hasVisitedCampaigns || activeTab === 'campaigns') && (
              <CampaignManager isHidden={activeTab !== 'campaigns' || isCampaignsRestricted} />
            )}
          </div>
        </main>
      </div>

      {/* Floating Live Notification HUD in Screen Corner */}
      <FloatingNotificationCorner />

      {/* Global Modern SaaS Interactive Click & Cursor Animations */}
      <GlobalSaaSAnimations />

      {/* Mobile Responsive Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/98 backdrop-blur-xl border-t border-slate-800/90 flex items-center justify-around px-1.5 py-1.5 shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'dashboard' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'leads' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Leads</span>
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'generator' ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Miner</span>
        </button>

        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition relative cursor-pointer ${
            activeTab === 'inbox' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Inbox</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'campaigns' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Campaigns</span>
        </button>

        {/* Full Menu / Drawer Toggle */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-2 rounded-xl transition cursor-pointer ${
            isMobileDrawerOpen ? 'text-cyan-300 bg-cyan-500/20' : 'text-slate-300 hover:text-white bg-slate-900/80 border border-slate-800'
          }`}
          title="Open all sidebar options and settings"
        >
          <Grid className="w-4 h-4 text-cyan-400" />
          <span>All Modules</span>
        </button>
      </nav>

      {/* Mobile Slide-over Full Drawer containing ALL sidebar items */}
      {isMobileDrawerOpen && (
        <MobileNavDrawer 
          isOpen={isMobileDrawerOpen} 
          onClose={() => setIsMobileDrawerOpen(false)}
          onOpenSendMail={() => handleOpenSendMail()}
          onOpenAuth={(mode, portal) => handleOpenAuth(mode || 'signin', portal || 'client')}
          onRequestLogout={() => setIsLogoutConfirmOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
      )}

      {/* Logout Confirmation Permission Modal */}
      {isLogoutConfirmOpen && (
        <LogoutConfirmModal
          isOpen={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={() => {
            logout();
            setIsLogoutConfirmOpen(false);
            handleOpenAuth('signin', 'client');
          }}
          currentUser={currentUser}
        />
      )}

      {/* Profile Modal */}
      {isProfileOpen && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onOpenAuth={(mode, portal) => handleOpenAuth(mode || 'signin', portal || 'client')}
        />
      )}

      {/* Auth Modal */}
      {isAuthOpen && (
        <AuthModal 
          isOpen={isAuthOpen} 
          onClose={() => setIsAuthOpen(false)}
          initialPortal={authInitialPortal}
          initialMode={authInitialMode}
          initialPlan={authInitialPlan}
        />
      )}

      {/* Send Mail Cold Outreach Modal */}
      {isSendMailOpen && (
        <SendMailModal 
          isOpen={isSendMailOpen} 
          onClose={() => {
            setIsSendMailOpen(false);
            setSelectedLeadForMail(undefined);
          }} 
          initialLead={selectedLeadForMail}
        />
      )}

      {/* bKash Personal Subscription Checkout Modal */}
      {isBillingOpen && (
        <BkashSubscriptionModal
          isOpen={isBillingOpen}
          onClose={() => setIsBillingOpen(false)}
          initialPlanId={authInitialPlan}
        />
      )}
    </div>
  );
};

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[VisualSky Root Recovery]:', error);
    try {
      const savedUser = localStorage.getItem('visualsky_current_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object') {
          parsed.quotaUsed = Number(parsed.quotaUsed) || 0;
          parsed.quotaLimit = Number(parsed.quotaLimit) || 100000;
          parsed.aiCredits = Number(parsed.aiCredits) || 50000;
          localStorage.setItem('visualsky_current_user', JSON.stringify(parsed));
        }
      }
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080c14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
            <h2 className="text-lg font-bold text-white">Workspace Restored</h2>
            <p className="text-xs text-slate-400">
              Your session cache was automatically repaired. Click below to continue.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </RootErrorBoundary>
  );
}
