import React, { useState } from 'react';
import { VisualSkyLogo } from '../brand/VisualSkyLogo';
import { 
  Sparkles, 
  Server, 
  CheckCircle2, 
  ArrowRight, 
  Inbox, 
  BarChart3, 
  Bot, 
  FileText, 
  Check, 
  ChevronDown,
  Menu,
  X,
  LogIn,
  UserPlus,
  Zap
} from 'lucide-react';
import { BDT_CLIENT_PLANS } from '../auth/AuthModal';

interface LandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup' | 'forgot_password', portal?: 'client' | 'agency', plan?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const [activePreviewTab, setActivePreviewTab] = useState<'smtp' | 'miner' | 'inbox' | 'radar'>('smtp');
  const [selectedRelayIdx, setSelectedRelayIdx] = useState<number>(0);
  const [activeFeatureIdx, setActiveFeatureIdx] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const features = [
    {
      icon: Server,
      title: 'Smart SMTP Rotation',
      desc: 'Distribute high-volume cold email traffic evenly across multiple relays. Avoid domain burnout and stay below provider throttling thresholds.',
      accent: 'cyan',
      liveMetric: '4x Relay Load Balancing Active'
    },
    {
      icon: Sparkles,
      title: 'AI Lead Miner & Scraper',
      desc: 'Discover verified B2B prospect emails, company phone numbers, and tech stack tags directly within the platform in seconds.',
      accent: 'purple',
      liveMetric: '99.2% MX Verification Accuracy'
    },
    {
      icon: Inbox,
      title: 'Sentiment-Aware Smart Inbox',
      desc: 'AI automatically classifies replies into Meeting Booked, Interested, or Not Interested with 1-click tailored reply drafts.',
      accent: 'emerald',
      liveMetric: 'Real-Time Intent Classification'
    },
    {
      icon: BarChart3,
      title: 'Deliverability Radar',
      desc: 'Real-time health audits for SPF, DKIM, DMARC, and MX records with automated alerts if reputation dips below target thresholds.',
      accent: 'amber',
      liveMetric: '64 Global Blacklists Monitored'
    },
    {
      icon: FileText,
      title: 'Anti-Spam Pre-Flight Auditor',
      desc: 'Calculates spam trigger risk score on subjects and bodies before launching sequences. Includes dynamic spintax syntax.',
      accent: 'rose',
      liveMetric: 'Zero Spam-Trap Word Guarantee'
    },
    {
      icon: Zap,
      title: 'Automated Drip Sequences',
      desc: 'Build multi-stage follow-up campaigns with smart time-zone scheduling, dynamic personalization variables, and automatic reply-stop protection.',
      accent: 'blue',
      liveMetric: 'Auto-Stop on Prospect Reply'
    }
  ];

  const faqs = [
    {
      q: 'How does the gradual +15/day SMTP warmup protect deliverability?',
      a: 'VisualSky automates a controlled warm-up ramp starting at 15 emails on Day 1, gradually incrementing by +15 each day. This builds genuine domain reputation across Google, Outlook, and Yahoo spam filters without triggering rate limits or spam traps.'
    },
    {
      q: 'Can I connect my own custom SMTP servers and domain emails?',
      a: 'Yes! VisualSky supports Google Workspace, Microsoft 365, AWS SES, SendGrid, Mailgun, and any custom cPanel/VPS SMTP server over SSL/TLS with automated SPF, DKIM, and DMARC verification handshakes.'
    },
    {
      q: 'How do subscription payments work for users in Bangladesh?',
      a: 'All subscription tiers are priced directly in BDT and accepted exclusively via bKash Personal (Send Money). Simply send the plan amount to our bKash Personal number and submit your Sender Number & TrxID to activate your subscription.'
    },
    {
      q: 'How quickly is my workspace activated after bKash Send Money?',
      a: 'As soon as you submit your Sender bKash Number and Transaction ID (TrxID) during registration, your workspace is created immediately so you can connect your SMTP relays and start mining B2B leads.'
    },
    {
      q: 'How does the AI Lead Miner find verified B2B leads?',
      a: 'Our AI Miner scours real-time business registries and corporate domains, verifying MX records and deliverability before exporting them into your pipeline with clean tags, phone numbers, and company metadata.'
    }
  ];

  const handleMobileNavClick = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#080c14] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 flex flex-col font-sans">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. STICKY TOP NAVIGATION BAR (100% Mobile & Desktop Responsive)*/}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 w-full bg-[#080c14]/95 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          
          {/* Brand Logo */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0 cursor-pointer group"
          >
            <VisualSkyLogo size="sm" className="sm:hidden transition-transform duration-300 group-hover:scale-105" />
            <VisualSkyLogo size="md" className="hidden sm:flex transition-transform duration-300 group-hover:scale-105" />
            <span className="hidden lg:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 whitespace-nowrap">
              v2.8 Enterprise Outbound
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-8 text-xs font-semibold text-slate-400">
            <a href="#features" className="hover:text-cyan-400 transition-colors whitespace-nowrap py-1">Features</a>
            <a href="#engine" className="hover:text-cyan-400 transition-colors whitespace-nowrap py-1">Warmup Engine</a>
            <a href="#leads" className="hover:text-cyan-400 transition-colors whitespace-nowrap py-1">AI Miner</a>
            <a href="#pricing" className="hover:text-cyan-400 transition-colors whitespace-nowrap py-1">Pricing</a>
            <a href="#faq" className="hover:text-cyan-400 transition-colors whitespace-nowrap py-1">FAQ</a>
          </nav>

          {/* Top CTAs: Responsive on Mobile & Desktop (No Agency Master link here) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => onOpenAuth('signin', 'client')}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-900/80 sm:bg-slate-900/50 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer whitespace-nowrap"
            >
              Sign In
            </button>

            <button
              onClick={() => onOpenAuth('signup', 'client')}
              className="saas-shimmer-btn px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 hidden xs:inline sm:inline" />
            </button>

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center transition cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-cyan-400" />
              ) : (
                <Menu className="w-5 h-5 text-cyan-400" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#0b111e]/98 backdrop-blur-2xl border-b border-slate-800 px-4 pt-3 pb-5 space-y-4 saas-view-enter shadow-2xl">
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-300">
              <button
                onClick={() => handleMobileNavClick('features')}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 text-left hover:border-cyan-500/40 hover:text-cyan-300 transition cursor-pointer"
              >
                ⚡ Features
              </button>
              <button
                onClick={() => handleMobileNavClick('engine')}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 text-left hover:border-cyan-500/40 hover:text-cyan-300 transition cursor-pointer"
              >
                🔥 Warmup Engine
              </button>
              <button
                onClick={() => handleMobileNavClick('pricing')}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 text-left hover:border-cyan-500/40 hover:text-cyan-300 transition cursor-pointer"
              >
                💳 BDT Pricing
              </button>
              <button
                onClick={() => handleMobileNavClick('faq')}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 text-left hover:border-cyan-500/40 hover:text-cyan-300 transition cursor-pointer"
              >
                ❓ FAQ &amp; Help
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAuth('signup', 'client');
                }}
                className="saas-shimmer-btn w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E2136E] via-pink-600 to-rose-600 text-white font-extrabold text-xs shadow-lg shadow-[#E2136E]/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Pay with bKash &amp; Open Account</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAuth('signin', 'client');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sign In to Existing Account</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO SECTION                                               */}
      {/* ------------------------------------------------------------- */}
      <section id="engine" className="relative pt-8 sm:pt-16 lg:pt-20 pb-14 sm:pb-24 overflow-hidden border-b border-slate-800/50">
        
        {/* Glow Gradients in Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[300px] sm:h-[350px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/15 to-purple-600/10 blur-[100px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8 saas-view-enter">
          
          {/* Live Badge */}
          <div 
            onClick={() => handleMobileNavClick('leads')}
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 text-[11px] sm:text-xs font-bold shadow-lg shadow-cyan-950/40 max-w-full cursor-pointer transition-all hover:scale-105"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="leading-snug">Next-Gen High Deliverability Cold Email Infrastructure</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black text-slate-100 tracking-tight leading-[1.2] sm:leading-[1.15] max-w-4xl mx-auto">
            Scale High-Converting Outbound with{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Guaranteed 99.4% Inbox Placement
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xs sm:text-base lg:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto font-normal px-1">
            Automated multi-relay SMTP rotation, gradual +15/day warmup ramp, real-time AI lead miner, unified sentiment inbox, and zero-spam deliverability radar—built for high-growth B2B teams.
          </p>

          {/* Hero CTAs (Strictly Client Sign-Up & Sign-In) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3.5 pt-1 sm:pt-2 max-w-md sm:max-w-none mx-auto">
            <button
              onClick={() => onOpenAuth('signup', 'client')}
              className="saas-shimmer-btn w-full sm:w-auto px-6 sm:px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#E2136E] via-pink-600 to-rose-600 hover:from-[#c91060] hover:via-pink-500 hover:to-rose-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-[#E2136E]/25 transition cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Pay with bKash &amp; Open Account</span>
              <ArrowRight className="w-4 h-4 shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => onOpenAuth('signin', 'client')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Sign In to Workspace</span>
            </button>
          </div>

          {/* Hero Trust Points */}
          <div className="pt-2 sm:pt-4 grid grid-cols-1 sm:flex sm:flex-wrap items-center justify-center gap-2.5 sm:gap-x-6 sm:gap-y-2 text-xs font-semibold text-slate-300 max-w-md sm:max-w-none mx-auto">
            <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-900/50 sm:bg-transparent py-2 px-3 sm:p-0 rounded-xl border border-slate-800/70 sm:border-none">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>No Spam Trap Guarantee</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-900/50 sm:bg-transparent py-2 px-3 sm:p-0 rounded-xl border border-slate-800/70 sm:border-none">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Automated +15/Day Warmup Ramp</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-900/50 sm:bg-transparent py-2 px-3 sm:p-0 rounded-xl border border-slate-800/70 sm:border-none">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>AI Sentiment Inbox Categorization</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 bg-slate-900/50 sm:bg-transparent py-2 px-3 sm:p-0 rounded-xl border border-slate-800/70 sm:border-none">
              <CheckCircle2 className="w-4 h-4 text-[#f43f8e] shrink-0" />
              <span>Direct bKash Personal (Send Money)</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* HERO INTERACTIVE SHOWCASE CARD (Modern SaaS Animations)       */}
          {/* ------------------------------------------------------------- */}
          <div id="leads" className="pt-6 sm:pt-10 max-w-5xl mx-auto">
            <div className="saas-card-interactive bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-3.5 sm:p-6 text-left space-y-4 sm:space-y-5 backdrop-blur-md overflow-hidden">
              
              {/* Card Window Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 sm:pb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-400 ml-1.5 truncate">
                    visualsky://workspace/deliverability-engine
                  </span>
                </div>

                {/* Interactive Preview Tabs */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[11px] font-bold w-full lg:w-auto">
                  <button
                    onClick={() => setActivePreviewTab('smtp')}
                    className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center truncate ${
                      activePreviewTab === 'smtp' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SMTP Rotation
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('miner')}
                    className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center truncate ${
                      activePreviewTab === 'miner' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    AI Lead Miner
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('inbox')}
                    className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center truncate ${
                      activePreviewTab === 'inbox' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Smart Inbox
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('radar')}
                    className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center truncate ${
                      activePreviewTab === 'radar' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Deliverability Radar
                  </button>
                </div>
              </div>

              {/* Tab 1: SMTP Warmup & Rotation View */}
              {activePreviewTab === 'smtp' && (
                <div key="smtp-tab" className="space-y-4 saas-view-enter">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition rounded-xl">
                      <div className="text-[11px] font-bold text-slate-400">Total Active Relays</div>
                      <div className="text-lg sm:text-xl font-black text-cyan-400 mt-0.5">4 Dedicated Slots</div>
                      <div className="text-[10px] text-emerald-400 font-semibold mt-1">✓ Round-robin load balanced</div>
                    </div>
                    <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 transition rounded-xl">
                      <div className="text-[11px] font-bold text-slate-400">Warmup Strategy</div>
                      <div className="text-lg sm:text-xl font-black text-purple-400 mt-0.5">+15/Day Ramp</div>
                      <div className="text-[10px] text-purple-300 font-semibold mt-1">Day 14 &bull; 210 emails/day cap</div>
                    </div>
                    <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 transition rounded-xl">
                      <div className="text-[11px] font-bold text-slate-400">Reputation Score</div>
                      <div className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">99.8 / 100</div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-1">0 Blacklist incidents</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Live Active Relay Pools (Click to inspect)</span>
                      <span className="text-[10px] font-mono text-cyan-400">Auto-Failover Enabled</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        {
                          email: 'outreach.primary@visualsky.io',
                          port: 'Port 587 (TLS)',
                          sent: '184 / 210',
                          placement: '100% Inbox Placement',
                          latency: '42ms Handshake'
                        },
                        {
                          email: 'sales.relay02@visualsky-growth.com',
                          port: 'Port 465 (SSL)',
                          sent: '142 / 210',
                          placement: '99.4% Inbox Placement',
                          latency: '51ms Handshake'
                        }
                      ].map((relay, idx) => {
                        const isSelected = selectedRelayIdx === idx;
                        return (
                          <div
                            key={relay.email}
                            onClick={() => setSelectedRelayIdx(idx)}
                            className={`p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-cyan-950/25 border border-cyan-500/50 shadow-md shadow-cyan-500/10'
                                : 'bg-slate-950 border border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                              <span className="font-mono font-bold text-slate-200 truncate">{relay.email}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono shrink-0">
                                {relay.port}
                              </span>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-[11px] pl-4 sm:pl-0 border-t sm:border-t-0 border-slate-800/60 pt-1.5 sm:pt-0">
                              <span className="text-cyan-300/80 hidden md:inline">{relay.latency}</span>
                              <span className="text-slate-400">Sent: {relay.sent}</span>
                              <span className="text-emerald-400 font-bold">{relay.placement}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: AI Lead Miner */}
              {activePreviewTab === 'miner' && (
                <div key="miner-tab" className="space-y-4 saas-view-enter">
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-300">
                    <span className="font-bold leading-snug">Target Search: &quot;B2B SaaS Founders in North America &amp; Singapore&quot;</span>
                    <span className="font-mono font-bold bg-purple-500/20 px-2 py-1 rounded self-start sm:self-auto shrink-0">24 Leads Verified in 3.4s</span>
                  </div>

                  {/* Mobile Cards + Desktop Table */}
                  <div className="space-y-2 sm:hidden">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-100">Sarah Jenkins (CEO)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">✓ 100% Deliverable</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">CloudSync Technologies</div>
                      <div className="text-cyan-400 font-mono text-[11px]">sarah@cloudsync.io</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-100">David Miller (VP Sales)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">✓ 100% Deliverable</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">ScaleFlow Metrics</div>
                      <div className="text-cyan-400 font-mono text-[11px]">david@scaleflow.ai</div>
                    </div>
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="pb-2 font-bold">Lead Contact</th>
                          <th className="pb-2 font-bold">Company &amp; Niche</th>
                          <th className="pb-2 font-bold">Verified Email</th>
                          <th className="pb-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        <tr className="hover:bg-slate-900/60 transition">
                          <td className="py-2.5 font-bold text-slate-200">Sarah Jenkins (CEO)</td>
                          <td className="py-2.5 text-slate-400">CloudSync Technologies</td>
                          <td className="py-2.5 text-cyan-400">sarah@cloudsync.io</td>
                          <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">✓ 100% Deliverable</span></td>
                        </tr>
                        <tr className="hover:bg-slate-900/60 transition">
                          <td className="py-2.5 font-bold text-slate-200">David Miller (VP Sales)</td>
                          <td className="py-2.5 text-slate-400">ScaleFlow Metrics</td>
                          <td className="py-2.5 text-cyan-400">david@scaleflow.ai</td>
                          <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">✓ 100% Deliverable</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Smart Inbox */}
              {activePreviewTab === 'inbox' && (
                <div key="inbox-tab" className="space-y-3 saas-view-enter">
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-100">Sarah Jenkins &bull; CloudSync</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          🎯 Meeting Requested
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">12m ago</span>
                    </div>
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      &quot;Hi! This deliverability framework sounds exactly like what our sales reps need. Do you have 15 minutes this Thursday at 2 PM?&quot;
                    </p>
                    <div className="pt-1">
                      <button 
                        onClick={() => onOpenAuth('signup', 'client')}
                        className="w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">AI One-Click Reply: &quot;Accept Meeting for Thursday&quot;</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Deliverability Radar */}
              {activePreviewTab === 'radar' && (
                <div key="radar-tab" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 saas-view-enter">
                  <div className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition rounded-xl text-center">
                    <div className="text-[10px] font-bold text-slate-400">SPF Record</div>
                    <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">100% Pass</div>
                    <div className="text-[10px] text-slate-500 truncate">v=spf1 include:...</div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition rounded-xl text-center">
                    <div className="text-[10px] font-bold text-slate-400">DKIM 2048-bit</div>
                    <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">100% Valid</div>
                    <div className="text-[10px] text-slate-500 truncate">Signed with RSA</div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition rounded-xl text-center">
                    <div className="text-[10px] font-bold text-slate-400">DMARC Policy</div>
                    <div className="text-base sm:text-lg font-black text-cyan-400 mt-0.5">p=quarantine</div>
                    <div className="text-[10px] text-slate-500 truncate">Alignment Passed</div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition rounded-xl text-center">
                    <div className="text-[10px] font-bold text-slate-400">Blacklist Check</div>
                    <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">0 / 64 Clean</div>
                    <div className="text-[10px] text-slate-500 truncate">Spamhaus, Barracuda</div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. PLATFORM CAPABILITIES & INTERACTIVE BENTO GRID             */}
      {/* ------------------------------------------------------------- */}
      <section id="features" className="py-14 sm:py-20 border-b border-slate-800/60 bg-[#080c14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
          
          <div className="text-center space-y-2.5 sm:space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
              Core Architecture
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-100 tracking-tight">
              Everything Needed for 7-Figure Cold Outbound
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Purpose-built tooling designed to eliminate spam folder traps, accelerate lead discovery, and automate follow-ups.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              const isSelected = activeFeatureIdx === idx;
              return (
                <div
                  key={feat.title}
                  onClick={() => setActiveFeatureIdx(idx)}
                  className={`saas-card-interactive p-5 sm:p-6 rounded-2xl space-y-3.5 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900/95 border-2 border-cyan-500/60 shadow-xl shadow-cyan-500/10'
                      : 'bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-cyan-300">
                      {feat.liveMetric}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-100">{feat.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. TRANSPARENT BDT SUBSCRIPTION PRICING SECTION               */}
      {/* ------------------------------------------------------------- */}
      <section id="pricing" className="py-14 sm:py-20 border-b border-slate-800/60 bg-[#080c14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
          
          <div className="text-center space-y-2.5 sm:space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
              Simple &amp; Transparent Pricing
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-100 tracking-tight">
              Invest in Guaranteed Primary Inbox Placement
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Select your subscription plan below — complete manual bKash Send Money payment during account creation to activate your workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {BDT_CLIENT_PLANS.map((plan) => {
              const isPopular = plan.id === 'scale';
              return (
                <div 
                  key={plan.id}
                  className={`saas-card-interactive relative p-5 sm:p-8 rounded-2xl flex flex-col justify-between ${
                    isPopular 
                      ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500 shadow-2xl shadow-cyan-500/10 mt-2 md:mt-0' 
                      : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black tracking-wider uppercase shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                      Most Popular Growth Plan
                    </div>
                  )}

                  <div className="space-y-4 sm:space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-slate-100">{plan.name}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1.5 pb-2 border-b border-slate-800">
                      <span className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
                        {plan.priceDisplay}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">{plan.billingCycle}</span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-300">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 sm:pt-8">
                    <button
                      onClick={() => onOpenAuth('signup', 'client', plan.id)}
                      className={`w-full py-3.5 px-4 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                        isPopular
                          ? 'saas-shimmer-btn bg-gradient-to-r from-[#E2136E] to-pink-600 hover:from-[#c91060] hover:to-pink-500 text-white shadow-[#E2136E]/25'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                      }`}
                    >
                      <span>Pay with bKash &amp; Open {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. FREQUENTLY ASKED QUESTIONS (FAQ)                           */}
      {/* ------------------------------------------------------------- */}
      <section id="faq" className="py-14 sm:py-20 border-b border-slate-800/60 bg-[#080c14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
          
          <div className="text-center space-y-2.5 sm:space-y-3">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
              Answers &amp; Clarifications
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-100 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className={`bg-slate-900/70 border rounded-xl overflow-hidden transition-all duration-200 ${
                    isOpen ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/5' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full px-4 sm:px-5 py-4 text-left flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-slate-200 hover:text-cyan-400 transition cursor-pointer"
                  >
                    <span className="leading-snug">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3 saas-view-enter">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. BOTTOM CALL TO ACTION                                      */}
      {/* ------------------------------------------------------------- */}
      <section className="py-14 sm:py-20 bg-gradient-to-b from-[#080c14] to-slate-950 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5 sm:space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-100 tracking-tight leading-tight">
            Ready to 10x Your Cold Email Meetings Without Landing in Spam?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Join hundreds of B2B founders and outbound sales teams scaling with automated warmup, AI scraping, and deliverability radar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md sm:max-w-none mx-auto">
            <button
              onClick={() => onOpenAuth('signup', 'client')}
              className="saas-shimmer-btn w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Create Account &amp; Get Started</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
            <button
              onClick={() => onOpenAuth('signin', 'client')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              Sign In to Existing Account
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. FOOTER (Clean: No Agency Portal & No Password Reset)       */}
      {/* ------------------------------------------------------------- */}
      <footer className="py-8 bg-slate-950 border-t border-slate-800 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <VisualSkyLogo size="sm" />
            <span>&copy; {new Date().getFullYear()} VisualSky. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 text-slate-400 font-semibold">
            <a href="#features" className="hover:text-cyan-400 transition">
              Features
            </a>
            <a href="#pricing" className="hover:text-cyan-400 transition">
              Pricing
            </a>
            <a href="#faq" className="hover:text-cyan-400 transition">
              FAQ
            </a>
            <button 
              onClick={() => onOpenAuth('signin', 'client')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => onOpenAuth('signup', 'client')}
              className="text-cyan-400 hover:text-cyan-300 transition cursor-pointer font-bold"
            >
              Get Started
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
