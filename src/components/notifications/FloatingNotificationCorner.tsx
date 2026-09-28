import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Bell, 
  X, 
  ExternalLink, 
  CheckCircle2, 
  Flame, 
  Eye, 
  Send, 
  AlertTriangle, 
  MailCheck, 
  Smartphone,
  Monitor,
  Sparkles
} from 'lucide-react';

export const FloatingNotificationCorner: React.FC = () => {
  const { 
    notifications, 
    markNotificationRead, 
    setActiveTab, 
    threads,
    setActiveThreadId,
    requestDesktopNotificationPermission,
    playNotificationSound,
    addNotification
  } = useApp();

  const [activeToastIds, setActiveToastIds] = useState<string[]>([]);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('visualsky_alerts_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [isEnabling, setIsEnabling] = useState<boolean>(false);
  const toastTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Track new unread notifications and pop them up as floating corner toasts
  useEffect(() => {
    if (notifications.length > 0) {
      const unread = notifications.filter(n => !n.isRead);
      if (unread.length > 0) {
        // Take the latest 3 unread
        const topUnreadIds = unread.slice(0, 3).map(n => n.id);
        setActiveToastIds(topUnreadIds);
      }
    }
  }, [notifications]);

  const handleDismissToast = (id: string) => {
    if (toastTimeoutsRef.current[id]) {
      clearTimeout(toastTimeoutsRef.current[id]);
      delete toastTimeoutsRef.current[id];
    }
    setActiveToastIds(prev => prev.filter(item => item !== id));
    markNotificationRead(id);
  };

  // Auto-dismiss each toast (8 seconds for incoming mail/reply alerts so user never misses them, 5 seconds for others)
  useEffect(() => {
    activeToastIds.forEach(id => {
      if (!toastTimeoutsRef.current[id]) {
        const notifObj = notifications.find(n => n.id === id);
        const durationMs = notifObj?.type === 'reply' || notifObj?.linkTab === 'inbox' ? 8000 : 5000;
        toastTimeoutsRef.current[id] = setTimeout(() => {
          handleDismissToast(id);
        }, durationMs);
      }
    });

    // Cleanup stale timers
    Object.keys(toastTimeoutsRef.current).forEach(id => {
      if (!activeToastIds.includes(id)) {
        clearTimeout(toastTimeoutsRef.current[id]);
        delete toastTimeoutsRef.current[id];
      }
    });
  }, [activeToastIds, notifications]);

  useEffect(() => {
    return () => {
      Object.values(toastTimeoutsRef.current).forEach((timer: any) => clearTimeout(timer));
    };
  }, []);

  const handleOpenNotification = (notif: any) => {
    if (notif.leadEmail) {
      const targetThread = threads.find(
        t => t.leadEmail?.toLowerCase() === String(notif.leadEmail).toLowerCase()
      );
      if (targetThread) {
        setActiveThreadId(targetThread.id);
      }
    }
    if (notif.linkTab) {
      setActiveTab(notif.linkTab as any);
    } else if (notif.type === 'reply') {
      setActiveTab('inbox');
    } else if (notif.type === 'open' || notif.type === 'click') {
      setActiveTab('sent');
    }
    handleDismissToast(notif.id);
  };

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    try {
      localStorage.setItem('visualsky_alerts_banner_dismissed', 'true');
    } catch {}
  };

  const handleEnableAlerts = async () => {
    setIsEnabling(true);
    try {
      await requestDesktopNotificationPermission();
      playNotificationSound('chime');
      
      // Send immediate welcome test popup to demonstrate live corner alerts
      addNotification({
        title: 'Monitor & Mobile Alerts Enabled! 🔔',
        message: 'Live popups are active! You will receive instant notifications for new replies, opens, and campaign updates.',
        type: 'reply'
      });

      handleDismissBanner();
    } catch (e) {
      console.warn('Error activating alerts:', e);
    } finally {
      setIsEnabling(false);
    }
  };

  const activeToasts = notifications.filter(n => activeToastIds.includes(n.id) && !n.isRead);

  const getIcon = (type: string) => {
    switch (type) {
      case 'reply':
        return <Flame className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'open':
        return <Eye className="w-4 h-4 text-cyan-400" />;
      case 'click':
        return <Send className="w-4 h-4 text-emerald-400" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      default:
        return <MailCheck className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div 
      id="floating-notification-hub"
      className="fixed bottom-20 md:bottom-4 inset-x-3 sm:left-auto sm:right-4 z-40 flex flex-col gap-2.5 sm:max-w-sm md:max-w-md sm:w-full pointer-events-none"
    >
      {/* 1-Click Browser & Mobile Push Permissions Banner */}
      {!isBannerDismissed && (
        <div className="pointer-events-auto bg-[#0a0f1c]/95 border border-cyan-500/50 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl shadow-black/80 flex flex-col gap-2 text-xs animate-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-100 flex items-center gap-1.5">
                  <span>Monitor & Phone Alerts</span>
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-[9px] font-black uppercase tracking-wider">Live</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Get instant sound & screen popups when leads reply or open emails.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissBanner}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Close Banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Monitor className="w-3 h-3 text-cyan-400" />
                <span>PC & Mac</span>
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-purple-400" />
                <span>Mobile</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnableAlerts}
                disabled={isEnabling}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isEnabling ? 'Activating...' : 'Enable Alerts'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Corner Toasts */}
      {activeToasts.map((toast) => {
        const isPriorityReply = toast.type === 'reply' || toast.linkTab === 'inbox';
        const animDuration = isPriorityReply ? '8s' : '5s';
        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#090e1a]/95 border border-slate-700/80 hover:border-slate-600 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl shadow-black/80 space-y-2.5 transition-all duration-300 animate-in slide-in-from-right-4 fade-in"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center justify-center shrink-0">
                  {getIcon(toast.type)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-100 text-xs leading-tight truncate">
                    {toast.title}
                  </h4>
                  <span className="text-[10px] text-slate-400">{toast.timestamp}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDismissToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
              {typeof toast.message === 'object'
                ? ((toast.message as any)?.message || (toast.message as any)?.text || JSON.stringify(toast.message))
                : String(toast.message || '')}
            </p>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-cyan-400" />
                  <span>PC</span>
                </span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-purple-400" />
                  <span>Mobile</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenNotification(toast)}
                  className="px-3 py-1 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Auto-dismiss Progress Indicator */}
            <div className="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden mt-1">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full"
                style={{
                  animation: `toastCountdown ${animDuration} linear forwards`
                }}
              />
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes toastCountdown {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
