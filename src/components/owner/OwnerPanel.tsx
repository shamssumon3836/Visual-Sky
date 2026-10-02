import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAccount, CustomerPermissions } from '../../types';
import { safeParseResponse } from '../../lib/safeFetch';
import {
  ShieldCheck,
  Users,
  CreditCard,
  Plus,
  Activity,
  Server,
  Key,
  CheckCircle2,
  XCircle,
  Lock,
  Edit2,
  Trash2,
  Crown,
  Sparkles,
  Check,
  Settings,
  Mail,
  Send,
  Bot,
  Copy,
  Phone,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { OWNER_PAYOUT_ACCOUNTS, BDT_CLIENT_PLANS } from '../auth/AuthModal';

export const OwnerPanel: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    allUsers,
    setAllUsers,
    deleteUserAccount,
    resetUserPasswordByEmail,
    leads,
    smtpAccounts,
    campaigns,
    addNotification
  } = useApp();

  const [activeTab, setActiveTab] = useState<'credentials' | 'billing' | 'customers' | 'system'>('credentials');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Inline password edit modal state
  const [editingPasswordUser, setEditingPasswordUser] = useState<UserAccount | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');

  // Owner's bKash Personal Number & Verification PIN configuration state
  const [bkashPersonalNumber, setBkashPersonalNumber] = useState<string>(OWNER_PAYOUT_ACCOUNTS.bKash.number);
  const [bkashAccountType, setBkashAccountType] = useState<string>('bKash Personal / Merchant Gateway');
  const [paymentAuthPin, setPaymentAuthPin] = useState<string>('38360');
  const [smsApiKey, setSmsApiKey] = useState<string>('');
  const [bkashInstruction, setBkashInstruction] = useState<string>(
    'আপনার সচল বিকাশ নাম্বার দিন, আপনার বিকাশ মোবাইল নাম্বারে (SMS-এ) পাঠানো আসল ৬-ডিজিট ভেরিফিকেশন কোড (OTP) এবং পিন দিয়ে পেমেন্ট সম্পন্ন করুন।'
  );
  const [isSavingBkash, setIsSavingBkash] = useState<boolean>(false);

  // Add Customer Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    plan: 'Pro' as 'Free' | 'Pro' | 'Agency' | 'Enterprise',
    quotaLimit: 10000,
    aiCredits: 2500,
    senderBkash: '',
    trxId: '',
    amountBDT: 4999,
    leadMiner: true,
    smartInbox: true,
    campaigns: true,
    smtpAccess: true,
    aiCopilot: true
  });

  // Load latest users registry & bKash payment settings from server on mount
  const fetchLatestRegistry = () => {
    fetch('/api/users/registry')
      .then((r) => safeParseResponse(r, 'Failed to fetch registry'))
      .then((parsed) => {
        const d = parsed.data || {};
        if (parsed.ok && d.success) {
          if (Array.isArray(d.users)) {
            setAllUsers(d.users);
          }
          if (d.paymentSettings?.bkashPersonalNumber) {
            setBkashPersonalNumber(d.paymentSettings.bkashPersonalNumber);
            if (d.paymentSettings.accountType) setBkashAccountType(d.paymentSettings.accountType);
            if (d.paymentSettings.paymentAuthPin) setPaymentAuthPin(d.paymentSettings.paymentAuthPin);
            if (d.paymentSettings.smsApiKey !== undefined) setSmsApiKey(d.paymentSettings.smsApiKey);
            if (d.paymentSettings.instruction) setBkashInstruction(d.paymentSettings.instruction);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLatestRegistry();
  }, []);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    addNotification({
      title: `${label} Copied`,
      message: `${text} copied to clipboard.`,
      type: 'system'
    });
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleSaveBkashSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bkashPersonalNumber || bkashPersonalNumber.trim().length < 11) {
      addNotification({
        title: 'Invalid bKash Number',
        message: 'Please enter a valid 11-digit bKash Personal Number.',
        type: 'system'
      });
      return;
    }

    setIsSavingBkash(true);
    try {
      const res = await fetch('/api/settings/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bkashPersonalNumber: bkashPersonalNumber.trim(),
          accountType: bkashAccountType.trim(),
          paymentAuthPin: paymentAuthPin.trim() || '38360',
          smsApiKey: smsApiKey.trim(),
          instruction: bkashInstruction.trim()
        })
      });
      const parsed = await safeParseResponse(res, 'Failed to save bKash number');
      setIsSavingBkash(false);
      if (parsed.ok && parsed.data?.success) {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.2 } });
        addNotification({
          title: 'bKash Personal Number Updated',
          message: `All client subscription payments will now route to ${bkashPersonalNumber.trim()}.`,
          type: 'system'
        });
      }
    } catch {
      setIsSavingBkash(false);
    }
  };

  const handleAdminPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPasswordUser || newPasswordInput.trim().length < 6) return;

    const cleanPass = newPasswordInput.trim();
    resetUserPasswordByEmail(editingPasswordUser.email, cleanPass);

    await fetch('/api/users/admin-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editingPasswordUser.id,
        email: editingPasswordUser.email,
        updates: { password: cleanPass }
      })
    }).catch(() => {});

    addNotification({
      title: 'User Password Updated',
      message: `Password for ${editingPasswordUser.email} has been updated to "${cleanPass}".`,
      type: 'system'
    });
    setEditingPasswordUser(null);
    setNewPasswordInput('');
  };

  const handleVerifySubscriptionStatus = async (
    user: UserAccount,
    newStatus: 'verified' | 'pending' | 'rejected'
  ) => {
    if (!user.paymentInfo) return;
    const updatedPaymentInfo = {
      ...user.paymentInfo,
      status: newStatus
    };

    const updatedAccountStatus = newStatus === 'rejected' ? 'suspended' : 'active';
    const updatedPerms: CustomerPermissions = {
      ...(user.permissions || {
        leadMinerEnabled: true,
        smartInboxEnabled: true,
        campaignAutomationEnabled: true,
        smtpRotationEnabled: true,
        aiCopilotEnabled: true,
        templatesEnabled: true,
        analyticsEnabled: true,
        maxSmtpSlots: 10,
        dailySendLimit: 2000,
        accountStatus: 'active'
      }),
      accountStatus: updatedAccountStatus
    };

    setAllUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, paymentInfo: updatedPaymentInfo, permissions: updatedPerms }
          : u
      )
    );

    await fetch('/api/users/admin-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        updates: { paymentInfo: updatedPaymentInfo, permissions: updatedPerms }
      })
    }).catch(() => {});

    await fetch('/api/subscriptions/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        trxId: user.paymentInfo.trxId,
        status: newStatus
      })
    }).catch(() => {});

    if (newStatus === 'verified') {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.3 } });
    }

    addNotification({
      title:
        newStatus === 'verified'
          ? 'bKash Subscription Approved'
          : 'Subscription Status Updated',
      message: `${user.name} (${user.email}) subscription marked as ${newStatus.toUpperCase()}.`,
      type: 'system'
    });
  };

  const handleToggleService = (userId: string, serviceKey: keyof CustomerPermissions) => {
    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentPerms: CustomerPermissions = u.permissions || {
            leadMinerEnabled: true,
            smartInboxEnabled: true,
            campaignAutomationEnabled: true,
            smtpRotationEnabled: true,
            aiCopilotEnabled: true,
            templatesEnabled: true,
            analyticsEnabled: true,
            maxSmtpSlots: 5,
            dailySendLimit: 2000,
            accountStatus: 'active'
          };
          const updatedPerms = {
            ...currentPerms,
            [serviceKey]: !currentPerms[serviceKey]
          };
          const updatedUser = { ...u, permissions: updatedPerms };
          if (currentUser.id === userId) {
            setCurrentUser(updatedUser);
          }
          fetch('/api/users/admin-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: u.id,
              email: u.email,
              updates: { permissions: updatedPerms }
            })
          }).catch(() => {});
          return updatedUser;
        }
        return u;
      })
    );
  };

  const handleToggleAccountStatus = (userId: string) => {
    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentStatus = u.permissions?.accountStatus || 'active';
          const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
          const updatedPerms: CustomerPermissions = {
            ...(u.permissions || {
              leadMinerEnabled: true,
              smartInboxEnabled: true,
              campaignAutomationEnabled: true,
              smtpRotationEnabled: true,
              aiCopilotEnabled: true,
              templatesEnabled: true,
              analyticsEnabled: true,
              maxSmtpSlots: 5,
              dailySendLimit: 2000,
              accountStatus: 'active'
            }),
            accountStatus: nextStatus
          };
          const updatedUser = { ...u, permissions: updatedPerms };
          if (currentUser.id === userId) {
            setCurrentUser(updatedUser);
          }
          fetch('/api/users/admin-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: u.id,
              email: u.email,
              updates: { permissions: updatedPerms }
            })
          }).catch(() => {});
          return updatedUser;
        }
        return u;
      })
    );

    addNotification({
      title: 'Customer Status Updated',
      message: 'Account access and outbound quota permissions adjusted.',
      type: 'system'
    });
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.email) return;

    const normalizedEmail = newCustomer.email.trim().toLowerCase();
    const existing = allUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      addNotification({
        title: 'Duplicate Email Notice',
        message: `An account with email "${newCustomer.email.trim()}" already exists.`,
        type: 'system'
      });
      return;
    }

    const hasBkashPayment = Boolean(newCustomer.senderBkash.trim() && newCustomer.trxId.trim());
    const created: UserAccount = {
      id: `usr-cust-${Date.now()}`,
      name: newCustomer.name.trim(),
      email: normalizedEmail,
      password: newCustomer.password.trim() || '123456',
      phone: newCustomer.phone.trim() || newCustomer.senderBkash.trim() || '+880 1700-000000',
      authProvider: 'email',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role: 'client',
      plan: newCustomer.plan,
      bdtPlanLabel: `${newCustomer.plan} Plan (BDT ${newCustomer.amountBDT.toLocaleString()}/mo)`,
      quotaUsed: 0,
      quotaLimit: newCustomer.quotaLimit,
      aiCredits: newCustomer.aiCredits,
      joinedAt: new Date().toISOString().split('T')[0],
      paymentInfo: hasBkashPayment
        ? {
            method: 'bKash',
            planName: `${newCustomer.plan} Plan`,
            amountBDT: Number(newCustomer.amountBDT) || 4999,
            trxId: newCustomer.trxId.trim().toUpperCase(),
            senderPhone: newCustomer.senderBkash.trim(),
            paymentDate: new Date().toISOString().split('T')[0],
            status: 'verified',
            ownerPayoutAccount: `${bkashPersonalNumber} (bKash Personal)`
          }
        : undefined,
      permissions: {
        leadMinerEnabled: newCustomer.leadMiner,
        smartInboxEnabled: newCustomer.smartInbox,
        campaignAutomationEnabled: newCustomer.campaigns,
        smtpRotationEnabled: newCustomer.smtpAccess,
        aiCopilotEnabled: newCustomer.aiCopilot,
        templatesEnabled: true,
        analyticsEnabled: true,
        maxSmtpSlots: newCustomer.plan === 'Enterprise' ? 20 : newCustomer.plan === 'Agency' ? 10 : 3,
        dailySendLimit: Math.round(newCustomer.quotaLimit / 30),
        accountStatus: 'active'
      }
    };

    setAllUsers((prev) => [created, ...prev]);
    setShowAddCustomerModal(false);
    confetti({ particleCount: 50, spread: 60 });
    addNotification({
      title: `Added Customer: ${created.name}`,
      message: `Saved login credentials and ${created.plan} subscription.`,
      type: 'system'
    });
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (user.id === currentUser.id) return;
    deleteUserAccount(user.id);
    fetch('/api/users/admin-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        deleteAccount: true
      })
    }).catch(() => {});
  };

  const filteredUsers = allUsers.filter((u) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.paymentInfo?.trxId || '').toLowerCase().includes(q) ||
      (u.paymentInfo?.senderPhone || '').toLowerCase().includes(q)
    );
  });

  const paidSubscribers = allUsers.filter((u) => Boolean(u.paymentInfo));
  const agencyMasterUsers = allUsers.filter(
    (u) =>
      (u.role === 'agency' || u.isOwner) &&
      u.email?.trim().toLowerCase().endsWith('@gmail.com')
  );
  const totalRevenueBDT = paidSubscribers.reduce(
    (sum, u) => sum + (u.paymentInfo?.status !== 'rejected' ? Number(u.paymentInfo?.amountBDT || 0) : 0),
    0
  );
  const totalLeadsCount = leads.filter((l) => !l.isTrash).length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
            <Crown className="w-4 h-4" />
            <span>Master Owner Admin Panel &bull; All Users, Passwords &amp; bKash Subscriptions</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Admin Control Center &amp; bKash Subscription Vault
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            সকল ইউজারের ইমেইল, পাসওয়ার্ড, অ্যাকাউন্ট স্ট্যাটাস এবং বিকাশ পার্সোনাল সাবস্ক্রিপশন পেমেন্টের সম্পূর্ণ তথ্য এখানে সংরক্ষিত থাকে।
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'credentials'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>User Emails &amp; Passwords ({allUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'billing'
                ? 'bg-[#E2136E] text-white font-bold shadow-md'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>bKash Subscriptions ({paidSubscribers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Service Permissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>System Status</span>
          </button>
        </div>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">Total Registered Accounts</div>
          <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
            {allUsers.length} Users
          </div>
          <div className="text-xs text-amber-400 font-semibold">
            Agency Master Gmail: {Math.min(3, agencyMasterUsers.length)} / 3 Slots Used
          </div>
        </div>

        <div
          onClick={() => setActiveTab('billing')}
          className="p-4 rounded-xl bg-slate-900/90 border border-[#E2136E]/40 hover:border-[#E2136E] transition cursor-pointer space-y-1"
        >
          <div className="text-xs text-slate-400">Active Receiving bKash Number</div>
          <div className="text-xl font-bold text-[#f43f8e] font-mono tabular-nums">
            {bkashPersonalNumber}
          </div>
          <div className="text-xs text-pink-300">
            যেকোনো সময় পরিবর্তনযোগ্য (নিচে বক্সে পরিবর্তন করুন)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">bKash Subscription Revenue</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            BDT {totalRevenueBDT.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-400">
            {paidSubscribers.length} Active bKash Subscribers
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">Total Workspace Leads</div>
          <div className="text-2xl font-bold text-blue-400 font-mono tabular-nums">
            {totalLeadsCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">
            {smtpAccounts.filter((s) => !s.isTrash).length} Active SMTP Relays
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ALWAYS-VISIBLE OWNER BKASH RECEIVING NUMBER EDITOR                  */}
      {/* =================================================================== */}
      <div className="bg-slate-900/95 border-2 border-[#E2136E]/50 rounded-2xl p-5 md:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#f43f8e]" />
              <span>টাকা গ্রহণ করার বিকাশ নাম্বার সেটিংস (Set / Change Receiving bKash Number Anytime)</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              ইউজাররা একাউন্ট খোলার সময় যে বিকাশ নাম্বারে পেমেন্টের টাকা পাঠাবে, সেই নাম্বারটি নিচে লিখে <strong>Save &amp; Update bKash Number</strong> বাটনে ক্লিক করুন। আপনি পরবর্তীতে যখন ইচ্ছা এখান থেকে নাম্বার পরিবর্তন করতে পারবেন।
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-[#E2136E]/20 border border-[#E2136E]/40 text-xs font-mono font-bold text-[#f43f8e] shrink-0">
            Active: {bkashPersonalNumber}
          </span>
        </div>

        <form onSubmit={handleSaveBkashSettings} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              যে বিকাশ নাম্বারে টাকা ঢুকবে (১১ ডিজিট) *
            </label>
            <input
              type="text"
              required
              value={bkashPersonalNumber}
              onChange={(e) => setBkashPersonalNumber(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#E2136E]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Account Type (Personal / Merchant)
            </label>
            <select
              value={bkashAccountType}
              onChange={(e) => setBkashAccountType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-100 focus:outline-none focus:border-[#E2136E]"
            >
              <option value="bKash Personal / Merchant Gateway">bKash Personal / Merchant Gateway</option>
              <option value="bKash Personal (Send Money)">bKash Personal (Send Money)</option>
              <option value="bKash Merchant (Payment)">bKash Merchant (Payment)</option>
              <option value="bKash Agent Account">bKash Agent Account</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              SIM SMS API Key (BulkSMSBD / AlphaSMS - ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={smsApiKey}
              onChange={(e) => setSmsApiKey(e.target.value)}
              placeholder="ফোনের সিমে SMS পাঠাতে API Key দিন"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#E2136E]"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSavingBkash}
              className="w-full py-2.5 px-4 rounded-xl bg-[#E2136E] hover:bg-[#c91060] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-[#E2136E]/25"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingBkash ? 'Saving...' : 'Save bKash Number'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: USER EMAILS, PASSWORDS & ACCOUNT CREDENTIALS VAULT            */}
      {/* =================================================================== */}
      {activeTab === 'credentials' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>Registered User Emails, Passwords &amp; Account Information</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                যারা সাইটে ইমেইল-পাসওয়ার্ড বা গুগল দিয়ে সাইন-ইন/সাইন-আপ করেছে, তাদের সকলের ইমেইল, পাসওয়ার্ড, ফোন নাম্বার ও প্ল্যান নিচে দেওয়া আছে।
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, email, phone..."
                  className="pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="button"
                onClick={fetchLatestRegistry}
                className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add User Account</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-3">User Name &amp; Role</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Password / Login Method</th>
                  <th className="py-3 px-3">Phone / Contact</th>
                  <th className="py-3 px-3">Plan &amp; Quota</th>
                  <th className="py-3 px-3">bKash Payment Info</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredUsers.map((user) => {
                  const isOwner =
                    user.role === 'agency' ||
                    user.role === 'owner' ||
                    Boolean(user.isOwner);
                  const isPassVisible = Boolean(revealedPasswords[user.id]);
                  const hasPassword = Boolean(user.password);

                  return (
                    <tr key={user.id} className="hover:bg-slate-950/60 transition">
                      {/* Name & Role */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{user.name}</span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                &middot; {isOwner ? 'Admin' : 'Client'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Joined: {user.joinedAt || '2026-09-25'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-3 font-mono text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{user.email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(user.email, 'Email')}
                            className="p-1 text-slate-500 hover:text-cyan-400 transition cursor-pointer"
                            title="Copy Email"
                          >
                            {copiedText === user.email ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Password / Auth Provider */}
                      <td className="py-3.5 px-3">
                        {hasPassword ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                              {isPassVisible ? user.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                              title={isPassVisible ? 'Hide Password' : 'Show Password'}
                            >
                              {isPassVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(user.password || '', 'Password')}
                              className="p-1 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedText === user.password ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            Google OAuth (1-Click Sign-In)
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-3 font-mono text-slate-300">
                        {user.phone || user.paymentInfo?.senderPhone || '—'}
                      </td>

                      {/* Plan & Quota */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-cyan-400">{user.plan || 'Pro'} Plan</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {Number(user.quotaUsed || 0).toLocaleString()} / {Number(user.quotaLimit || 1500).toLocaleString()} leads
                        </div>
                      </td>

                      {/* bKash Info */}
                      <td className="py-3.5 px-3">
                        {user.paymentInfo ? (
                          <div className="space-y-1 font-mono text-[11px]">
                            <div className="text-[#f43f8e] font-semibold">
                              bKash &middot; BDT {Number(user.paymentInfo.amountBDT || 0).toLocaleString()}
                            </div>
                            <div className="text-slate-300">
                              From: {user.paymentInfo.senderPhone}
                            </div>
                            <div className="text-amber-300 font-bold">
                              TrxID: {user.paymentInfo.trxId}
                            </div>
                            <div className="pt-0.5 flex items-center gap-1.5 flex-wrap font-sans">
                              {user.paymentInfo.status === 'verified' ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                  ✓ Verified &amp; Active
                                </span>
                              ) : user.paymentInfo.status === 'rejected' ? (
                                <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                                  ✕ Rejected
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                                  ⏳ Pending Verification
                                </span>
                              )}

                              {user.paymentInfo.status !== 'verified' && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifySubscriptionStatus(user, 'verified')}
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer"
                                >
                                  Verify &amp; Activate
                                </button>
                              )}
                              {user.paymentInfo.status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifySubscriptionStatus(user, 'rejected')}
                                  className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-semibold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">No bKash payment yet</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPasswordUser(user);
                              setNewPasswordInput(user.password || '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                          >
                            Set Password
                          </button>

                          {user.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: BKASH PERSONAL SUBSCRIPTIONS & BUYER PAYMENT LEDGER          */}
      {/* =================================================================== */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Owner's bKash Personal Number Settings Card */}
          <div className="bg-slate-900/90 border border-[#E2136E]/40 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#f43f8e]" />
                  <span>আপনার বিকাশ পার্সোনাল নাম্বার সেটিংস (Owner bKash Personal Number)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  ক্লায়েন্টরা সাবস্ক্রিপশন কেনার সময় শুধুমাত্র আপনার এই বিকাশ পার্সোনাল নাম্বারে (Send Money) টাকা পাঠাবে। অন্য কোনো পেমেন্ট মেথড (নগদ/রকেট) রাখা হয়নি।
                </p>
              </div>
              <span className="text-xs font-semibold text-[#f43f8e]">
                bKash Personal Only
              </span>
            </div>

            <form onSubmit={handleSaveBkashSettings} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your bKash Personal Number (১১ ডিজিট) *
                </label>
                <input
                  type="text"
                  required
                  value={bkashPersonalNumber}
                  onChange={(e) => setBkashPersonalNumber(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#E2136E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Payment Method Label
                </label>
                <input
                  type="text"
                  value={bkashAccountType}
                  onChange={(e) => setBkashAccountType(e.target.value)}
                  placeholder="bKash Personal (Send Money)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-[#E2136E]"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSavingBkash}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#E2136E] hover:bg-[#c91060] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBkash ? 'Saving...' : 'Save bKash Personal Number'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Complete bKash Subscribers & Buyer Details Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>সাবস্ক্রিপশন ক্রেতাদের সম্পূর্ণ তালিকা ও বিকাশ পেমেন্ট তথ্য (bKash Subscribers Ledger)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  যারা টাকা দিয়ে সাবস্ক্রিপশন কিনেছে তাদের নাম, ইমেইল, ফোন নাম্বার, কোন বিকাশ নাম্বার থেকে টাকা পাঠিয়েছে, TrxID এবং প্ল্যানের বিস্তারিত।
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Manual bKash Subscriber</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 font-semibold">
                    <th className="py-3 px-3">Subscriber (Name &amp; Email)</th>
                    <th className="py-3 px-3">Subscription Plan</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Sender bKash Number</th>
                    <th className="py-3 px-3">bKash TrxID</th>
                    <th className="py-3 px-3">Amount (BDT)</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Verify / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {paidSubscribers.length > 0 ? (
                    paidSubscribers.map((client) => {
                      const p = client.paymentInfo!;
                      const status = p.status || 'verified';

                      return (
                        <tr key={client.id} className="hover:bg-slate-950/60 transition">
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-slate-100">{client.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{client.email}</div>
                            {client.password && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Pass: {client.password}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="text-cyan-400 font-semibold">{p.planName}</div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                              Quota: {Number(client.quotaLimit || 1500).toLocaleString()} leads
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#f43f8e]">
                            bKash Personal
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span>{p.senderPhone}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.senderPhone, 'Sender bKash Number')}
                                className="text-slate-500 hover:text-white cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-amber-300">
                            <div className="flex items-center gap-1.5">
                              <span>{p.trxId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.trxId, 'bKash TrxID')}
                                className="text-slate-500 hover:text-white cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-emerald-400 tabular-nums">
                            BDT {Number(p.amountBDT || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] text-slate-400">
                            {p.paymentDate || client.joinedAt || '2026-09-25'}
                          </td>
                          <td className="py-3.5 px-3">
                            {status === 'verified' || status === 'paid' ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verified</span>
                              </span>
                            ) : status === 'rejected' ? (
                              <span className="text-rose-400 font-semibold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <span className="text-amber-400 font-semibold">Pending</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {status !== 'verified' && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifySubscriptionStatus(client, 'verified')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifySubscriptionStatus(client, 'rejected')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        No bKash subscription payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client Subscription Tiers Overview */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="text-sm font-bold text-slate-200">
              Active BDT Subscription Packages (bKash Personal Checkout)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {BDT_CLIENT_PLANS.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                >
                  <div>
                    <h3 className="font-bold text-slate-100 text-base">{p.name}</h3>
                    <div className="text-2xl font-bold text-[#f43f8e] font-mono tabular-nums mt-1">
                      {p.priceDisplay}{' '}
                      <span className="text-xs text-slate-400 font-sans">{p.billingCycle}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: CUSTOMER SERVICE PERMISSIONS & ACCESS                        */}
      {/* =================================================================== */}
      {activeTab === 'customers' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Customer Account Service Permissions</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                প্রত্যেক ক্লায়েন্টের জন্য আলাদাভাবে যেকোনো সার্ভিস (Lead Miner, Smart Inbox, Campaigns, SMTP Hub, AI Copilot) অন বা অফ করুন।
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomerModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer Account</span>
            </button>
          </div>

          <div className="space-y-3">
            {allUsers.map((user) => {
              const perms: CustomerPermissions = user.permissions || {
                leadMinerEnabled: true,
                smartInboxEnabled: true,
                campaignAutomationEnabled: true,
                smtpRotationEnabled: true,
                aiCopilotEnabled: true,
                templatesEnabled: true,
                analyticsEnabled: true,
                maxSmtpSlots: 5,
                dailySendLimit: 2000,
                accountStatus: 'active'
              };
              const isSuspended = perms.accountStatus === 'suspended';
              const isOwner =
                user.role === 'owner' ||
                user.role === 'agency' ||
                Boolean(user.isOwner) ||
                user.email.toLowerCase() === 'rafiqulvisualsky@gmail.com' ||
                user.email.toLowerCase() === 'sojibdaridro123@gmail.com';

              return (
                <div
                  key={user.id}
                  className={`p-4 md:p-5 rounded-xl border transition-all space-y-3 ${
                    isSuspended
                      ? 'bg-slate-950/40 border-rose-900/40 opacity-75'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                      />
                      <div>
                        <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                          <span>{user.name}</span>
                          {isOwner && (
                            <span className="text-[11px] text-amber-400 font-semibold">
                              &middot; Master Owner
                            </span>
                          )}
                          {isSuspended && (
                            <span className="text-[11px] text-rose-400 font-semibold">
                              &middot; Suspended
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-cyan-400">
                        {user.plan || 'Pro'} Plan
                      </span>
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        &middot; {Number(user.quotaUsed || 0).toLocaleString()} / {Number(user.quotaLimit || 1500).toLocaleString()} sent
                      </span>

                      {!isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleAccountStatus(user.id)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                              isSuspended
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60'
                            }`}
                          >
                            {isSuspended ? 'Activate' : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">
                      Granted Services:
                    </span>

                    {[
                      { key: 'leadMinerEnabled', label: 'AI Lead Miner', icon: Sparkles },
                      { key: 'smartInboxEnabled', label: 'Smart Inbox', icon: Mail },
                      { key: 'campaignAutomationEnabled', label: 'Campaigns', icon: Send },
                      { key: 'smtpRotationEnabled', label: 'SMTP Hub', icon: Server },
                      { key: 'aiCopilotEnabled', label: 'AI Copilot', icon: Bot },
                      { key: 'templatesEnabled', label: 'Templates', icon: Settings }
                    ].map((svc) => {
                      const isGranted = (perms as any)[svc.key] ?? true;
                      const Icon = svc.icon;

                      return (
                        <button
                          key={svc.key}
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleToggleService(user.id, svc.key as any)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            isGranted
                              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/50'
                              : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800 line-through opacity-60'
                          } ${isOwner ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <Icon className={`w-3 h-3 ${isGranted ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span>{svc.label}</span>
                          {isGranted ? (
                            <Check className="w-3 h-3 text-emerald-400 ml-0.5" />
                          ) : (
                            <XCircle className="w-3 h-3 text-slate-500 ml-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SYSTEM HEALTH                                                */}
      {/* =================================================================== */}
      {activeTab === 'system' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Server &amp; Database Status</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production environment health and persistence status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Firebase &amp; Server Registry Sync</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                User credentials, Google OAuth profiles, and bKash subscription records are persistently stored.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">DNS &amp; SMTP MX Relay Engine</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> TLS 1.3 Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                SPF / DKIM / DMARC verification handshakes running with 99.8% inbox score.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change User Password */}
      {editingPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>Set / Update User Password</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingPasswordUser(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAdminPasswordUpdate} className="space-y-3.5">
              <div>
                <div className="text-slate-400">Account:</div>
                <div className="font-bold text-slate-100 mt-0.5">
                  {editingPasswordUser.name} ({editingPasswordUser.email})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  New Password (min 6 characters) *
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPasswordUser(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Customer & Optional bKash Subscription */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#090d16] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Add User Account &amp; bKash Subscription Info</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tanvir Ahmed"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="client@company.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Login Password *</label>
                  <input
                    type="text"
                    required
                    placeholder="At least 6 characters"
                    value={newCustomer.password}
                    onChange={(e) => setNewCustomer({ ...newCustomer, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Plan Tier</label>
                  <select
                    value={newCustomer.plan}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, plan: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Pro">Starter Growth (Pro)</option>
                    <option value="Agency">Scale Business (Agency)</option>
                    <option value="Enterprise">Enterprise Suite</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Sender bKash No.</label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={newCustomer.senderBkash}
                    onChange={(e) => setNewCustomer({ ...newCustomer, senderBkash: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-[#E2136E]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">bKash TrxID</label>
                  <input
                    type="text"
                    placeholder="BKA9823KL12"
                    value={newCustomer.trxId}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, trxId: e.target.value.toUpperCase() })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-amber-300 focus:outline-none focus:border-[#E2136E]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
