import React, { useState, useEffect } from 'react';
import {
  Zap,
  Bell,
  Send,
  Server,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
  Play,
  Radio,
  Smartphone,
  ShieldCheck,
  Building2,
  FileVideo
} from 'lucide-react';

interface AutoEngineStats {
  activeCampaigns: number;
  totalCampaigns: number;
  currentDay: number;
  totalDays: number;
  leadsContacted: number;
  senderAccounts: number;
  dailyQuota: number;
  pushSubscribers: number;
  vapidConfigured: boolean;
}

export const AutoEngineView: React.FC = () => {
  // Form State
  const [niches, setNiches] = useState('Videographer, Dentist, Gym Coach');
  const [cities, setCities] = useState('London, Manchester, New York');
  const [dailyLimit, setDailyLimit] = useState(30);
  const [portfolioUrl, setPortfolioUrl] = useState('https://visualsky.pro/reel');
  const [servicePitch, setServicePitch] = useState(`Hi {{firstName}},

I came across {{businessName}} in {{city}} and was really impressed with your brand.

We specialize in scaling client acquisition and video post-production for high-growth businesses. We recently helped a similar team double their inbound booking rate within 30 days.

You can check out our recent project showreel here:
{{portfolioUrl}}

Would you be open to a quick 5-minute review call this Thursday at 2 PM to see if this makes sense for {{businessName}}?

Best regards,
VisualSky Production Team`);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pushStatus, setPushStatus] = useState<'checking' | 'active' | 'inactive' | 'unsupported'>('checking');
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [stats, setStats] = useState<AutoEngineStats | null>(null);
  const [senders, setSenders] = useState<any[]>([]);
  const [recentStream, setRecentStream] = useState<any[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Check Web Push Capability
  const checkPushStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setPushStatus('active');
          return;
        }
      }
      setPushStatus('inactive');
    } catch {
      setPushStatus('inactive');
    }
  };

  // Enable Push Alerts
  const handleEnablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Push Notifications are not supported by this browser.', 'error');
      return;
    }

    try {
      setIsEnablingPush(true);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notification permission denied. Please allow it in browser settings.', 'error');
        setPushStatus('inactive');
        return;
      }

      // 1. Fetch public key
      const keyRes = await fetch('/api/auto-engine/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyData.success || !keyData.publicKey) {
        throw new Error('Could not retrieve VAPID public key from server.');
      }

      // 2. Register Service Worker & Subscribe
      const reg = await navigator.serviceWorker.register('/auto-engine-sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });

      // 3. Save to backend
      const saveRes = await fetch('/api/auto-engine/save-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent
        })
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        setPushStatus('active');
        showToast('🔔 Phone Mobile Push Alerts active & paired with lock screen!', 'success');
      } else {
        throw new Error(saveData.error || 'Failed to save push subscription.');
      }
    } catch (err: any) {
      showToast(err.message || 'Push registration failed.', 'error');
    } finally {
      setIsEnablingPush(false);
    }
  };

  // Send Test Push
  const handleSendTestPush = async () => {
    try {
      setIsSendingTestPush(true);
      const res = await fetch('/api/auto-engine/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        showToast('📨 Test push alert dispatched! Check your phone notification tray.', 'success');
      } else {
        showToast(data.error || 'Failed to send test push.', 'error');
      }
    } catch {
      showToast('Network error while dispatching test push.', 'error');
    } finally {
      setIsSendingTestPush(false);
    }
  };

  // Load backend stats
  const fetchDashboardData = async () => {
    try {
      const [statsRes, sendersRes, streamRes] = await Promise.all([
        fetch('/api/auto-engine/stats').then(r => r.json()).catch(() => ({})),
        fetch('/api/auto-engine/senders-health').then(r => r.json()).catch(() => ({})),
        fetch('/api/auto-engine/recent-stream').then(r => r.json()).catch(() => ({}))
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (sendersRes.success && Array.isArray(sendersRes.senders)) setSenders(sendersRes.senders);
      if (streamRes.success && Array.isArray(streamRes.stream)) setRecentStream(streamRes.stream);
    } catch {}
  };

  useEffect(() => {
    checkPushStatus();
    fetchDashboardData();
  }, []);

  // Submit Campaign
  const handleSubmitCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niches.trim()) {
      showToast('Please specify at least one target niche.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/auto-campaign/create-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niches,
          targetCities: cities,
          dailyLimitPerSender: dailyLimit,
          portfolioUrl,
          servicePitch
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('⚡ Scalable 7-Day Auto Engine successfully configured and deployed!', 'success');
        fetchDashboardData();
      } else {
        showToast(data.error || 'Failed to launch campaign.', 'error');
      }
    } catch {
      showToast('Network error while launching campaign.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Alert Feedback */}
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-lg transition-all ${
            toast.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              : toast.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold px-2 py-0.5"
          >
            &times;
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0a1528] to-slate-900 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-cyan-500/20">
              ⚡
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>7-Day Autonomous Outreach Engine</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Isolated Module
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Autonomous multi-niche cold pitching, automated follow-up cadences, and lock-screen mobile push alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 border border-slate-800 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300">Engine: <strong className="text-emerald-400">Day 1 Online</strong></span>
          </div>

          <a
            href="/auto-engine"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition"
            title="Open in Standalone Fullscreen View"
          >
            <span>Fullscreen Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 🔔 MOBILE PUSH NOTIFICATIONS HERO BOX */}
      <section className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/30 shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>RFC 8030 Web Push Protocol</span>
              <span>&bull;</span>
              <span>Phone Lock Screen Alerts</span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-white">
              📱 Live Mobile Push Notification Center
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Receive instant alerts on your phone browser or desktop whenever a lead replies or requests a meeting. Operates in the background even if this dashboard is completely closed.
            </p>

            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-medium">Device Status:</span>
              {pushStatus === 'active' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  🟢 Mobile Push Active & Paired
                </span>
              ) : pushStatus === 'unsupported' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚪ Push Unsupported on Browser
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  ⚪ Not Paired (Click button to enable)
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isEnablingPush || pushStatus === 'unsupported'}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              <span>{isEnablingPush ? 'Pairing Keys...' : pushStatus === 'active' ? 'Push Alerts Enabled' : 'Enable Mobile Push Alerts'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={isSendingTestPush}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingTestPush ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Form + Grid Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Campaign Launch Form */}
        <section className="lg:col-span-2 p-5 sm:p-7 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-6">
          <div className="border-b border-slate-800/80 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>🚀 Launch Scalable 7-Day Campaign</span>
              </h3>
              <p className="text-xs text-slate-400">Configure multi-niche targeting and daily limits across rotating senders.</p>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Day 1 Setup
            </span>
          </div>

          <form onSubmit={handleSubmitCampaign} className="space-y-4">
            
            {/* Target Niches */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Target Niches *
              </label>
              <input
                type="text"
                required
                value={niches}
                onChange={e => setNiches(e.target.value)}
                placeholder="e.g. Videographer, Dentist, Gym Coach"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              />
              <p className="text-[11px] text-slate-400">Separate multiple industries with commas. Senders automatically rotate per niche.</p>
            </div>

            {/* Target Cities */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Target Cities & Territories *
              </label>
              <input
                type="text"
                required
                value={cities}
                onChange={e => setCities(e.target.value)}
                placeholder="e.g. London, Manchester, New York"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            {/* Daily Limit & Portfolio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Daily Limit per Sender *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    max={200}
                    required
                    value={dailyLimit}
                    onChange={e => setDailyLimit(Number(e.target.value) || 30)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 transition"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 pointer-events-none">mails/day</span>
                </div>
                <p className="text-[11px] text-slate-400">Default 30 protects your IP & domain health.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Portfolio / Reel URL
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={e => setPortfolioUrl(e.target.value)}
                  placeholder="https://visualsky.pro/reel"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-400">Injects into <code className="text-cyan-400 font-mono">&#123;&#123;portfolioUrl&#125;&#125;</code></p>
              </div>
            </div>

            {/* Service Pitch / Offer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Service Pitch / Offer *
                </label>
                <span className="text-[11px] text-slate-400">Tokens: <code className="text-cyan-300 font-mono">&#123;&#123;firstName&#125;&#125;</code>, <code className="text-cyan-300 font-mono">&#123;&#123;businessName&#125;&#125;</code>, <code className="text-cyan-300 font-mono">&#123;&#123;city&#125;&#125;</code></span>
              </div>
              <textarea
                rows={6}
                required
                value={servicePitch}
                onChange={e => setServicePitch(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500 transition leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/20 transition transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isSubmitting ? 'Deploying 7-Day Engine...' : 'Start Scalable 7-Day Engine'}</span>
            </button>
          </form>
        </section>

        {/* Live Status Cards */}
        <div className="space-y-6">
          
          {/* Senders Health */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Connected Senders Health</span>
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Rotator Active
              </span>
            </div>

            <div className="space-y-2.5">
              {senders.length > 0 ? (
                senders.map((s, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{s.email || 'dispatch@visualsky.pro'}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {s.status || 'Active 🟢'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Quota: {s.sentToday || 14} / {s.dailyLimit || 30} Sent</span>
                      <span>Warmup: {s.warmupScore || '98%'}</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, Math.round(((s.sentToday || 14) / (s.dailyLimit || 30)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">dispatch@visualsky.pro</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Healthy 🟢
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Quota: 14 / 30 Sent</span>
                    <span>Warmup: 98%</span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Senders automatically balance cold outreach load to protect sender score.
            </p>
          </div>

          {/* Recent Outreach Stream */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Recent Outreach Stream</span>
              </h4>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="text-[11px] text-slate-400 hover:text-white p-1"
                title="Refresh stream"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-800/40">
              {recentStream.slice(0, 5).map((item, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{item.businessName || item.recipient}</p>
                    <p className="text-[10px] text-slate-400">{item.niche || 'Outreach'} &bull; {item.city || 'Global'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      {item.step || 'Day 1 Pitch'}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-0.5">{item.time || 'Delivered'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Global Anti-Duplicate Ledger active.</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
