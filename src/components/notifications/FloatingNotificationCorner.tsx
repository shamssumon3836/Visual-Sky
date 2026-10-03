import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { AppNotification } from '../../types';
import {
  Mail,
  Eye,
  ShieldAlert,
  X,
  Volume2,
  VolumeX,
  ArrowUpRight,
  Send,
  BellRing,
  CheckCheck,
  MessageCircle,
  Smartphone
} from 'lucide-react';

export const FloatingNotificationCorner: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    setActiveTab,
    setActiveThreadId,
    threads,
    sendReply,
    notificationSettings,
    updateNotificationSettings,
    requestDesktopNotificationPermission,
    sendDesktopNotification,
    playNotificationSound
  } = useApp();

  const [visibleToasts, setVisibleToasts] = useState<AppNotification[]>([]);
  const [quickReplyMap, setQuickReplyMap] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [nativePermission, setNativePermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef<boolean>(false);

  // Sync native permission status
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNativePermission(Notification.permission);
    }
  }, [notificationSettings.desktopPushEnabled]);

  // Pre-populate existing notifications on first mount so only new live events pop up
  useEffect(() => {
    if (!initializedRef.current) {
      notifications.forEach(n => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    // Strictly allow only the 3 core email events: reply (incoming mail), open (mail opened), bounce (blocked/bounced)
    const newOnes = notifications.filter(
      n =>
        !seenIdsRef.current.has(n.id) &&
        !n.isRead &&
        (n.type === 'reply' || n.type === 'open' || n.type === 'bounce')
    );

    if (newOnes.length > 0) {
      newOnes.forEach(n => seenIdsRef.current.add(n.id));
      setVisibleToasts(prev => [...newOnes, ...prev].slice(0, 3));
    }
  }, [notifications]);

  // Auto-dismiss each toast after 12 seconds unless user is typing a quick reply
  useEffect(() => {
    if (visibleToasts.length === 0) return;
    const timer = setInterval(() => {
      setVisibleToasts(prev => {
        if (prev.length === 0) return prev;
        const lastToast = prev[prev.length - 1];
        if (lastToast && quickReplyMap[lastToast.id]?.trim()) {
          return prev; // Don't auto-close while user is typing a reply
        }
        return prev.slice(0, -1);
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [visibleToasts, quickReplyMap]);

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVisibleToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleClickToast = (notif: AppNotification) => {
    markNotificationRead(notif.id);
    setVisibleToasts(prev => prev.filter(t => t.id !== notif.id));

    if (notif.threadId) {
      setActiveThreadId(notif.threadId);
      setActiveTab('inbox');
      return;
    }

    if (notif.leadEmail) {
      const matchingThread = threads.find(
        t => t.leadEmail?.toLowerCase() === notif.leadEmail?.toLowerCase()
      );
      if (matchingThread) {
        setActiveThreadId(matchingThread.id);
      }
    }

    if (notif.linkTab) {
      setActiveTab(notif.linkTab as any);
    } else if (notif.type === 'reply') {
      setActiveTab('inbox');
    } else {
      setActiveTab('sent');
    }
  };

  const handleQuickInlineReply = (notif: AppNotification, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = (quickReplyMap[notif.id] || '').trim();
    if (!text) return;

    const targetThread =
      (notif.threadId && threads.find(t => t.id === notif.threadId)) ||
      (notif.leadEmail &&
        threads.find(t => t.leadEmail?.toLowerCase() === notif.leadEmail?.toLowerCase()));

    if (targetThread) {
      setSendingReplyId(notif.id);
      sendReply(targetThread.id, text, targetThread.smtpAccountId);
      setTimeout(() => {
        setSendingReplyId(null);
        markNotificationRead(notif.id);
        setQuickReplyMap(prev => {
          const next = { ...prev };
          delete next[notif.id];
          return next;
        });
        setVisibleToasts(prev => prev.filter(t => t.id !== notif.id));
      }, 300);
    } else {
      handleClickToast(notif);
    }
  };

  const handleEnableNativeAlerts = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const granted = await requestDesktopNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNativePermission(Notification.permission);
    }
    if (granted) {
      playNotificationSound('chime');
      sendDesktopNotification({
        id: `notif-enabled-${Date.now()}`,
        title: '✅ Gmail & Messenger Screen Alerts Enabled',
        message: 'You will now receive instant phone & desktop notifications for new emails, opens, and blocks.',
        type: 'reply',
        timestamp: 'Just now',
        isRead: false,
        linkTab: 'inbox'
      });
    }
  };

  if (visibleToasts.length === 0) return null;

  const getEventTheme = (notif: AppNotification) => {
    const initials = (notif.senderName || notif.leadEmail || 'M')
      .trim()
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    if (notif.type === 'reply') {
      return {
        initials,
        avatarGrad: 'from-blue-600 via-indigo-600 to-cyan-500',
        badgeBg: 'bg-[#0084FF] border-[#0b111e]',
        badgeIcon: <MessageCircle className="w-3 h-3 text-white fill-white" />,
        pillText: 'NEW MAIL • GMAIL / MESSENGER SYNC',
        pillClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        cardBorder: 'border-blue-500/50 shadow-[0_20px_50px_rgba(0,132,255,0.28)]',
        glowBar: 'from-blue-500 via-cyan-400 to-emerald-400',
        actionLabel: 'Open in Smart Inbox'
      };
    }

    if (notif.type === 'open') {
      return {
        initials,
        avatarGrad: 'from-cyan-600 via-teal-600 to-emerald-500',
        badgeBg: 'bg-cyan-500 border-[#0b111e]',
        badgeIcon: <Eye className="w-3 h-3 text-slate-950" />,
        pillText: 'LIVE TRACKING • EMAIL OPENED',
        pillClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        cardBorder: 'border-cyan-500/50 shadow-[0_20px_50px_rgba(6,182,212,0.25)]',
        glowBar: 'from-cyan-400 via-teal-400 to-emerald-400',
        actionLabel: 'View Open Log'
      };
    }

    if (notif.type === 'smtp') {
      return {
        initials: '⚙️',
        avatarGrad: 'from-amber-600 via-orange-600 to-yellow-500',
        badgeBg: 'bg-amber-500 border-[#0b111e]',
        badgeIcon: <ShieldAlert className="w-3 h-3 text-black" />,
        pillText: 'SMTP NOTICE • CREDENTIALS / RELAY',
        pillClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        cardBorder: 'border-amber-500/60 shadow-[0_20px_50px_rgba(245,158,11,0.22)]',
        glowBar: 'from-amber-500 via-orange-500 to-yellow-400',
        actionLabel: 'Open SMTP Settings'
      };
    }

    if (notif.type === 'campaign' || notif.type === 'lead' || notif.type === 'system') {
      return {
        initials: '🚀',
        avatarGrad: 'from-cyan-600 via-blue-600 to-indigo-600',
        badgeBg: 'bg-cyan-500 border-[#0b111e]',
        badgeIcon: <MessageCircle className="w-3 h-3 text-black" />,
        pillText: 'OUTREACH • SYSTEM DISPATCH',
        pillClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        cardBorder: 'border-cyan-500/50 shadow-[0_20px_50px_rgba(6,182,212,0.22)]',
        glowBar: 'from-cyan-400 via-blue-500 to-indigo-500',
        actionLabel: 'View Details'
      };
    }

    // 'bounce' (Blocked / Bounced)
    return {
      initials: '!',
      avatarGrad: 'from-rose-600 via-red-600 to-orange-600',
      badgeBg: 'bg-rose-500 border-[#0b111e]',
      badgeIcon: <ShieldAlert className="w-3 h-3 text-white" />,
      pillText: 'DELIVERY ALERT • MAIL BLOCKED / BOUNCED',
      pillClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      cardBorder: 'border-rose-500/60 shadow-[0_20px_50px_rgba(244,63,94,0.28)]',
      glowBar: 'from-rose-500 via-red-500 to-amber-500',
      actionLabel: 'Inspect Blocked Mail'
    };
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-[390px] w-[calc(100vw-1.5rem)] pointer-events-none">
      {visibleToasts.map(notif => {
        const theme = getEventTheme(notif);
        const canQuickReply =
          notif.type === 'reply' &&
          Boolean(
            (notif.threadId && threads.some(t => t.id === notif.threadId)) ||
              (notif.leadEmail &&
                threads.some(t => t.leadEmail?.toLowerCase() === notif.leadEmail?.toLowerCase()))
          );

        return (
          <div
            key={notif.id}
            onClick={() => handleClickToast(notif)}
            className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-[#0b111e]/98 backdrop-blur-2xl border ${theme.cardBorder} p-4 cursor-pointer transition-all duration-300 hover:scale-[1.01] group animate-in slide-in-from-bottom-5 fade-in`}
          >
            {/* Top Messenger / Gmail Accent Bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.glowBar}`} />

            {/* Top Header Row: App Pill + Sound & Close Controls */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.pillClass}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  {theme.pillText}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    updateNotificationSettings({
                      soundEnabled: !notificationSettings.soundEnabled
                    });
                  }}
                  title={
                    notificationSettings.soundEnabled
                      ? 'Notification Sound On (Click to Mute)'
                      : 'Notification Sound Muted (Click to Unmute)'
                  }
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                >
                  {notificationSettings.soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={e => handleDismiss(notif.id, e)}
                  title="Dismiss notification"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Body: Messenger Avatar + Overlapping Badge + Content */}
            <div className="flex items-start gap-3.5">
              <div className="relative shrink-0">
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${theme.avatarGrad} flex items-center justify-center text-white font-black text-sm shadow-lg ring-2 ring-white/10`}
                >
                  {theme.initials}
                </div>
                {/* Facebook / Messenger style overlapping corner badge */}
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full ${theme.badgeBg} border-2 flex items-center justify-center shadow-md`}
                >
                  {theme.badgeIcon}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[13px] font-extrabold text-white truncate">
                    {notif.title}
                  </h4>
                  <span className="text-[10px] font-bold text-blue-400 shrink-0">
                    {notif.timestamp || 'Just now'}
                  </span>
                </div>

                {notif.leadEmail && (
                  <div className="text-[11px] font-semibold text-cyan-300/90 truncate mt-0.5">
                    {notif.senderName ? `${notif.senderName} • ` : ''}
                    {notif.leadEmail}
                  </div>
                )}

                <p className="text-xs text-slate-200 mt-1.5 leading-relaxed line-clamp-3 bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2">
                  {notif.message}
                </p>
              </div>
            </div>

            {/* Messenger-Style Instant Inline Reply Box for Incoming Emails */}
            {canQuickReply && (
              <form
                onSubmit={e => handleQuickInlineReply(notif, e)}
                onClick={e => e.stopPropagation()}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={quickReplyMap[notif.id] || ''}
                  onChange={e =>
                    setQuickReplyMap(prev => ({ ...prev, [notif.id]: e.target.value }))
                  }
                  placeholder="Write a quick reply right here..."
                  className="flex-1 bg-slate-950/95 border border-slate-700/80 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!quickReplyMap[notif.id]?.trim() || sendingReplyId === notif.id}
                  className="px-3 py-1.5 rounded-xl bg-[#0084FF] hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-md shadow-blue-500/20"
                >
                  <Send className="w-3 h-3" />
                  <span>{sendingReplyId === notif.id ? 'Sending...' : 'Send'}</span>
                </button>
              </form>
            )}

            {/* Native Phone & Desktop Screen Alert Prompt if not yet granted */}
            {nativePermission !== 'granted' && (
              <div
                onClick={handleEnableNativeAlerts}
                className="mt-2.5 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-[11px] text-blue-300 font-bold transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Enable Phone & Desktop Screen Alerts</span>
                </div>
                <span className="underline">Allow</span>
              </div>
            )}

            {/* Footer Action Bar */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  markNotificationRead(notif.id);
                  handleDismiss(notif.id);
                }}
                className="text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mark as Read</span>
              </button>

              <span className="font-bold text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1">
                <span>{theme.actionLabel}</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
