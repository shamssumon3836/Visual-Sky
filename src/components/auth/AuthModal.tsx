import React, { useState, useEffect, useRef } from 'react';
import { useApp, MAX_AGENCY_GMAIL_ACCOUNTS, isStrictGmailAddress } from '../../context/AppContext';
import { safeParseResponse } from '../../lib/safeFetch';
import { signInWithGooglePopup } from '../../lib/firebase';
import {
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  RefreshCw,
  ShieldCheck,
  Check,
  FileText,
  KeyRound
} from 'lucide-react';
import { VisualSkyLogo } from '../brand/VisualSkyLogo';
import {
  signUpWithSupabase,
  isSupabaseConfigured,
  supabase
} from '../../lib/supabase';
import { UserAccount } from '../../types';
import {
  BkashGatewayWindow,
  BkashPaymentSuccessPayload
} from '../billing/BkashGatewayWindow';
import confetti from 'canvas-confetti';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPortal?: 'client' | 'agency';
  initialMode?: 'signin' | 'signup' | 'forgot_password';
  initialPlan?: string;
}

// Preserved exports for LandingPage and OwnerPanel
export const BDT_CLIENT_PLANS = [
  {
    id: 'starter',
    name: 'Starter Growth',
    priceBDT: 1999,
    priceDisplay: 'BDT 1,999',
    billingCycle: '/ month',
    planCode: 'Pro' as const,
    quotaLimit: 1500,
    aiCredits: 500,
    maxSmtp: 3,
    description: 'For early-stage founders and solo outbound consultants.',
    features: [
      '1,500 Verified Outbound Leads',
      '3 Dedicated SMTP Relay Slots',
      'Smart Unified Inbox & Follow-ups',
      'Standard Lead Verification'
    ]
  },
  {
    id: 'scale',
    name: 'Scale Business',
    priceBDT: 4999,
    priceDisplay: 'BDT 4,999',
    billingCycle: '/ month',
    planCode: 'Agency' as const,
    quotaLimit: 10000,
    aiCredits: 2500,
    maxSmtp: 10,
    isPopular: true,
    description: 'High-velocity outbound engine with multi-step sequences & AI.',
    features: [
      '10,000 Verified Outbound Leads',
      '10 SMTP Multi-Domain Relays',
      'AI Outreach Copilot (2,500 Credits)',
      '7d / 14d / 30d Automated Sequences',
      'Primary Inbox Deliverability Radar'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise Suite',
    priceBDT: 9999,
    priceDisplay: 'BDT 9,999',
    billingCycle: '/ month',
    planCode: 'Enterprise' as const,
    quotaLimit: 35000,
    aiCredits: 10000,
    maxSmtp: 25,
    description: 'Full-scale multi-domain deliverability infrastructure.',
    features: [
      '35,000 Verified Outbound Leads',
      '25 Dedicated Relay Nodes',
      'Unlimited AI Copilot & Lead Miner',
      '24/7 Priority Deliverability Guard'
    ]
  }
];

export const OWNER_PAYOUT_ACCOUNTS = {
  bKash: {
    gatewayName: 'bKash Payment Gateway',
    number: '01577-225248',
    cleanNumber: '01577225248',
    type: 'bKash Automated Checkout',
    reference: 'VSKY',
    color: '#E2136E',
    bgColor: 'bg-[#E2136E]/10',
    borderColor: 'border-[#E2136E]/30',
    textColor: 'text-[#f43f8e]',
    instruction:
      'Click the bKash payment button to open the bKash window, enter your bKash number, OTP, and PIN to automatically pay and activate your account.'
  }
};

const REMEMBER_EMAIL_KEY = 'visualsky_remembered_email';

const evaluatePasswordStrength = (pwd: string) => {
  const hasMinLength = pwd.length >= 6;
  const hasGoodLength = pwd.length >= 8;
  const hasMixedCase = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasGoodLength && (hasMixedCase || hasNumber)) score += 1;
  if (hasMixedCase && hasNumber) score += 1;
  if (hasSymbol && hasGoodLength) score += 1;

  const labels = ['Too Short', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-cyan-500',
    'bg-emerald-500',
    'bg-emerald-400'
  ];
  const textColors = [
    'text-rose-400',
    'text-amber-400',
    'text-cyan-400',
    'text-emerald-400',
    'text-emerald-300'
  ];

  return {
    score,
    label: pwd.length === 0 ? '' : labels[score],
    barColor: colors[score],
    textColor: textColors[score],
    hasMinLength,
    hasGoodLength,
    hasMixedCase,
    hasNumber,
    hasSymbol
  };
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialPortal = 'client',
  initialMode = 'signin',
  initialPlan = 'scale'
}) => {
  const {
    loginUser,
    loadUserWorkspace,
    allUsers,
    setAllUsers,
    addNotification,
    resetUserPasswordByEmail
  } = useApp();

  const [portalType, setPortalType] = useState<'client' | 'agency'>(initialPortal);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot_password'>(initialMode);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlan || 'scale');

  // Sign In & Sign Up Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Legal Terms & Privacy Policy Viewer Modal
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy' | null>(null);

  // Sign Up 2-Step Email OTP Verification State
  const [signupStep, setSignupStep] = useState<'form' | 'verify_otp'>('form');
  const [signupOtpDigits, setSignupOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [signupOtpToken, setSignupOtpToken] = useState<string>('');
  const [verifiedEmailToken, setVerifiedEmailToken] = useState<string>('');
  const [signupFallbackOtp, setSignupFallbackOtp] = useState<string>('');
  const [signupResendCooldown, setSignupResendCooldown] = useState<number>(0);
  const signupOtpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // bKash Gateway Window State (for Pay-First Client Account Creation)
  const [isBkashWindowOpen, setIsBkashWindowOpen] = useState<boolean>(false);
  const [ownerBkashNumber, setOwnerBkashNumber] = useState<string>(OWNER_PAYOUT_ACCOUNTS.bKash.number);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    uid: string;
    email: string;
    name: string;
    avatar?: string;
  } | null>(null);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [confirmResetPassword, setConfirmResetPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState<boolean>(false);
  const [forgotPhase, setForgotPhase] = useState<'request' | 'verify'>('request');
  const [otpToken, setOtpToken] = useState<string>('');
  const [fallbackOtpCode, setFallbackOtpCode] = useState<string>('');

  // Status & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const selectedPlan =
    BDT_CLIENT_PLANS.find((p) => p.id === selectedPlanId) || BDT_CLIENT_PLANS[1];

  const passwordStrength = evaluatePasswordStrength(password);
  const resetPasswordStrength = evaluatePasswordStrength(newResetPassword);

  // Track unique registered Gmail accounts in Agency Master Portal (Strictly capped at 3)
  const agencyGmailAccounts = React.useMemo(() => {
    const seen = new Set<string>();
    const list: UserAccount[] = [];
    for (const u of allUsers) {
      if (!u || !u.email) continue;
      const em = u.email.trim().toLowerCase();
      if ((u.role === 'agency' || u.isOwner) && isStrictGmailAddress(em)) {
        if (!seen.has(em) && list.length < MAX_AGENCY_GMAIL_ACCOUNTS) {
          seen.add(em);
          list.push(u);
        }
      }
    }
    return list;
  }, [allUsers]);

  const agencyGmailCount = agencyGmailAccounts.length;
  const isAgencyLimitReached = agencyGmailCount >= MAX_AGENCY_GMAIL_ACCOUNTS;

  // Cooldown timer for Forgot Password OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Cooldown timer for Sign Up Email OTP
  useEffect(() => {
    if (signupResendCooldown <= 0) return;
    const interval = setInterval(() => {
      setSignupResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [signupResendCooldown]);

  useEffect(() => {
    if (isOpen) {
      if (initialPortal) setPortalType(initialPortal);
      if (initialMode) setAuthMode(initialMode);
      if (initialPlan) setSelectedPlanId(initialPlan);
      setErrorMessage('');
      setSuccessMessage('');
      setPendingGoogleUser(null);
      setSignupStep('form');
      setSignupOtpDigits(['', '', '', '', '', '']);
      setSignupFallbackOtp('');

      fetch('/api/settings/payment')
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && d?.settings?.bkashPersonalNumber) {
            setOwnerBkashNumber(d.settings.bkashPersonalNumber);
          }
        })
        .catch(() => {});

      fetch('/api/users/registry')
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && Array.isArray(d?.users)) {
            setAllUsers(d.users);
          }
        })
        .catch(() => {});

      try {
        const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail && !email) {
          setEmail(savedEmail);
        }
      } catch {}
    }
  }, [isOpen, initialPortal, initialMode, initialPlan]);

  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
    setSignupStep('form');
    setSignupOtpDigits(['', '', '', '', '', '']);
    setSignupFallbackOtp('');
  }, [portalType, authMode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (legalModalTab) {
          setLegalModalTab(null);
        } else if (!isBkashWindowOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBkashWindowOpen, legalModalTab, onClose]);

  if (!isOpen) return null;

  const safeString = (val: any, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '[object Object]' || !trimmed) return fallback;
      return trimmed;
    }
    if (typeof val === 'object') {
      if (typeof val.message === 'string' && val.message.trim()) return val.message.trim();
      if (typeof val.error === 'string' && val.error.trim()) return val.error.trim();
    }
    return fallback || 'An unexpected error occurred.';
  };

  // =========================================================================
  // 1-CLICK REAL GOOGLE POPUP SIGN-IN / SIGN-UP
  // =========================================================================
  const handleGoogleContinue = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    // Block new Agency Sign-Up immediately if 3 Gmail accounts are already registered
    if (portalType === 'agency' && authMode === 'signup' && isAgencyLimitReached) {
      setErrorMessage(
        `❌ Agency Master Portal-এ সর্বোচ্চ ৩টি Gmail একাউন্ট খোলার সীমা (${MAX_AGENCY_GMAIL_ACCOUNTS}/${MAX_AGENCY_GMAIL_ACCOUNTS}) পূর্ণ হয়ে গেছে! ৩টির বেশি মেইল থেকে একাউন্ট খোলা যাবে না।`
      );
      return;
    }

    setIsGoogleLoading(true);

    try {
      const googleUser = await signInWithGooglePopup(portalType);
      const cleanEmail = (googleUser.email || '').trim().toLowerCase();
      const cleanName = (
        googleUser.displayName ||
        cleanEmail.split('@')[0].replace(/[._-]/g, ' ')
      ).trim();

      const isAgencyPortal = portalType === 'agency';

      if (isAgencyPortal) {
        if (!isStrictGmailAddress(cleanEmail)) {
          setIsGoogleLoading(false);
          setErrorMessage(
            '❌ Agency Master Portal-এ শুধুমাত্র Gmail (@gmail.com) একাউন্ট দিয়ে প্রবেশ ও একাউন্ট খোলা যাবে।'
          );
          return;
        }
        const isAlreadyAgencyMember = agencyGmailAccounts.some(
          (u) => u.email.trim().toLowerCase() === cleanEmail
        );
        if (!isAlreadyAgencyMember && isAgencyLimitReached) {
          setIsGoogleLoading(false);
          setErrorMessage(
            `❌ Agency Master Portal-এ সর্বোচ্চ ৩টি Gmail একাউন্ট খোলার সীমা (${MAX_AGENCY_GMAIL_ACCOUNTS}/${MAX_AGENCY_GMAIL_ACCOUNTS}) পূর্ণ হয়ে গেছে! এর বেশি মেইল থেকে একাউন্ট করা যাবে না।`
          );
          return;
        }
      }

      const localExisting = allUsers.find((u) => u.email?.toLowerCase() === cleanEmail);

      // If user is in Sign-Up mode OR does not yet have an account -> pre-fill Name & Email and require Password + Confirm Password + Terms (✓) + 6-Digit Email OTP!
      if (authMode === 'signup' || !localExisting) {
        // Double-check on server if user already exists when in signin mode
        let serverExists = false;
        if (authMode === 'signin') {
          try {
            const checkRes = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: googleUser.uid,
                email: cleanEmail,
                name: cleanName,
                avatar: googleUser.photoURL || undefined,
                role: isAgencyPortal ? 'agency' : 'client',
                checkOnly: true
              })
            });
            const checkParsed = await safeParseResponse(checkRes, 'Google check failed');
            if (checkParsed.ok && checkParsed.data?.exists) {
              serverExists = true;
            }
          } catch {}
        }

        if (authMode === 'signup' || !serverExists) {
          setIsGoogleLoading(false);
          setFullName(cleanName);
          setEmail(cleanEmail);
          setAuthMode('signup');
          setSignupStep('form');
          setSuccessMessage(
            `✅ Google থেকে আপনার নাম ও ইমেইল (${cleanEmail}) যুক্ত হয়েছে! এখন নিচে Password, Confirm Password এবং Terms & Conditions (✓) পূরণ করে ইমেইলে ৬-ডিজিট ভেরিফিকেশন কোড পাঠান।`
          );
          return;
        }
      }

      if (!isAgencyPortal && localExisting?.paymentInfo?.status === 'pending') {
        setIsGoogleLoading(false);
        setErrorMessage(
          `⏳ আপনার বিকাশ পেমেন্ট (TrxID: ${localExisting.paymentInfo.trxId}) বর্তমানে এডমিন ভেরিফিকেশনের অপেক্ষায় (Pending) আছে। এডমিন যাচাই করে অ্যাক্টিভ করলেই আপনি লগইন করতে পারবেন।`
        );
        return;
      }

      const isAgency = isAgencyPortal;

      // Existing verified paid client or existing Agency Admin -> Sign in directly
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: googleUser.uid,
          email: cleanEmail,
          name: cleanName,
          avatar: googleUser.photoURL || undefined,
          role: isAgency ? 'agency' : 'client'
        })
      });

      const parsed = await safeParseResponse(res, 'Google sign-in failed');
      if (parsed.data?.requiresSignupVerification) {
        setIsGoogleLoading(false);
        setFullName(cleanName);
        setEmail(cleanEmail);
        setAuthMode('signup');
        setSignupStep('form');
        setSuccessMessage(
          `✅ Google থেকে আপনার নাম ও ইমেইল (${cleanEmail}) যুক্ত হয়েছে! নতুন একাউন্ট তৈরি করতে নিচে Password, Confirm Password এবং Terms & Conditions (✓) দিয়ে ৬-ডিজিট ভেরিফিকেশন কোড পাঠান।`
        );
        return;
      }

      if (parsed.data?.requiresPayment && !isAgency) {
        setIsGoogleLoading(false);
        setPendingGoogleUser({
          uid: googleUser.uid,
          email: cleanEmail,
          name: cleanName,
          avatar: googleUser.photoURL || undefined
        });
        setIsBkashWindowOpen(true);
        return;
      }

      if (!parsed.ok || !parsed.data?.success) {
        setIsGoogleLoading(false);
        setErrorMessage(
          safeString(
            parsed.data?.error,
            isAgency
              ? `❌ Agency Master Portal-এ সর্বোচ্চ ৩টি Gmail একাউন্টের বেশি খোলা যাবে না।`
              : 'Google sign-in could not be completed.'
          )
        );
        return;
      }

      const serverUser: UserAccount = parsed.data.user;

      if (Array.isArray(parsed.data?.users)) {
        setAllUsers(parsed.data.users);
      } else {
        setAllUsers((prev) => [
          serverUser,
          ...prev.filter((u) => u.email.toLowerCase() !== serverUser.email.toLowerCase())
        ]);
      }

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, serverUser.email);
        }
      } catch {}

      loginUser(serverUser, serverUser.role === 'agency' ? 'owner' : 'dashboard');
      await loadUserWorkspace(serverUser.email, serverUser.id);

      setIsGoogleLoading(false);
      addNotification({
        title: `Welcome, ${serverUser.name}`,
        message: `Signed in with Google (${serverUser.email}).`,
        type: 'system'
      });
      onClose();
    } catch (err: any) {
      setIsGoogleLoading(false);
      const code = String(err?.code || '');
      const msg = String(err?.message || '');

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'cold.visualsky.pro';
        setErrorMessage(
          `To use Google Sign-In on "${host}", add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`
        );
        return;
      }
      if (code === 'auth/popup-blocked') {
        setErrorMessage('Browser blocked the Google sign-in popup. Please allow popups for this site.');
        return;
      }
      setErrorMessage(safeString(err, 'Google sign-in could not be completed.'));
    }
  };

  // =========================================================================
  // EMAIL SIGN IN
  // =========================================================================
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (portalType === 'agency') {
      if (!isStrictGmailAddress(cleanEmail)) {
        setErrorMessage(
          '❌ Agency Master Portal-এ শুধুমাত্র Gmail (@gmail.com) দিয়ে লগইন ও একাউন্ট করা যাবে।'
        );
        return;
      }
      const isRegisteredAgencyGmail = agencyGmailAccounts.some(
        (u) => u.email.trim().toLowerCase() === cleanEmail
      );
      if (!isRegisteredAgencyGmail && isAgencyLimitReached) {
        setErrorMessage(
          `❌ Agency Master Portal-এ সর্বোচ্চ ৩টি Gmail একাউন্ট খোলার সীমা (${MAX_AGENCY_GMAIL_ACCOUNTS}/${MAX_AGENCY_GMAIL_ACCOUNTS}) পূর্ণ হয়ে গেছে! এর বেশি মেইল থেকে একাউন্ট করা বা প্রবেশ করা যাবে না।`
        );
        return;
      }
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      let authenticatedUser: UserAccount | null = null;
      let serverError = '';
      let serverRequiresPayment = false;
      let serverRejectedAgency = false;

      try {
        const res = await fetch('/api/auth/verify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password, role: portalType })
        });
        const parsed = await safeParseResponse(res, 'Invalid login credentials');
        if (parsed.ok && parsed.data?.success && parsed.data?.user) {
          authenticatedUser = parsed.data.user;
        } else {
          if (res.status === 403 || (portalType === 'agency' && !parsed.ok)) {
            serverRejectedAgency = true;
          }
          if (parsed.data?.requiresPayment) {
            serverRequiresPayment = true;
          }
          if (parsed.data?.error) {
            serverError = safeString(parsed.data.error);
          }
        }
      } catch {}

      if (!authenticatedUser && !serverRejectedAgency) {
        const localMatch = allUsers.find((u) => u.email?.toLowerCase() === cleanEmail);
        let resetPassMatch = false;
        try {
          const resetStore = JSON.parse(localStorage.getItem('visualsky_reset_passwords') || '{}');
          if (resetStore[cleanEmail] && resetStore[cleanEmail] === password) {
            resetPassMatch = true;
          }
        } catch {}

        if (localMatch && (localMatch.password === password || resetPassMatch)) {
          if (portalType !== 'agency' || localMatch.role === 'agency' || localMatch.isOwner) {
            authenticatedUser = { ...localMatch, password };
          }
        }
      }

      if (!authenticatedUser && serverRequiresPayment && portalType === 'client') {
        setIsLoading(false);
        setFullName(cleanEmail.split('@')[0]);
        setAuthMode('signup');
        setPendingGoogleUser(null);
        return;
      }

      if (!authenticatedUser) {
        setIsLoading(false);
        const existsInRegistry = allUsers.some((u) => u.email?.toLowerCase() === cleanEmail);
        if (!existsInRegistry && !serverRejectedAgency) {
          setErrorMessage(
            `❌ "${cleanEmail}" দিয়ে এখনো কোনো একাউন্ট খোলা হয়নি! নতুন একাউন্ট তৈরি করতে উপরে "Create Account" ট্যাবে গিয়ে Password, Confirm Password, Terms & Conditions (✓) পূরণ করে ইমেইল ভেরিফিকেশন কোড (OTP) দিন।`
          );
          return;
        }
        setErrorMessage(serverError || 'Invalid email or password.');
        return;
      }

      const isAgency = portalType === 'agency';

      if (!isAgency && authenticatedUser.paymentInfo?.status === 'pending') {
        setIsLoading(false);
        setErrorMessage(
          `⏳ আপনার বিকাশ পেমেন্ট (TrxID: ${authenticatedUser.paymentInfo.trxId}) বর্তমানে এডমিন ভেরিফিকেশনের অপেক্ষায় (Pending) আছে। এডমিন আপনার বিকাশ নাম্বার ও TrxID যাচাই করে অনুমোদন করলেই আপনি লগইন করতে পারবেন।`
        );
        return;
      }

      const hasValidPayment = Boolean(
        authenticatedUser.paymentInfo?.trxId &&
          authenticatedUser.paymentInfo?.trxId !== 'BKA9823KL12' &&
          authenticatedUser.paymentInfo?.trxId !== 'BKEV6RCP8X' &&
          authenticatedUser.paymentInfo?.status === 'verified'
      );

      if (!isAgency && !hasValidPayment) {
        setIsLoading(false);
        setFullName(authenticatedUser.name || cleanEmail.split('@')[0]);
        setPendingGoogleUser(null);
        setIsBkashWindowOpen(true);
        return;
      }

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, cleanEmail);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {}

      const finalUser: UserAccount = {
        ...authenticatedUser,
        role: isAgency ? 'agency' : 'client',
        isOwner: isAgency
      };

      setAllUsers((prev) => [
        finalUser,
        ...prev.filter((u) => u.email.toLowerCase() !== finalUser.email.toLowerCase())
      ]);

      loginUser(finalUser, isAgency ? 'owner' : 'dashboard');
      await loadUserWorkspace(finalUser.email, finalUser.id || finalUser.supabaseId);

      setIsLoading(false);
      addNotification({
        title: `Welcome back, ${finalUser.name}`,
        message: 'Workspace loaded successfully.',
        type: 'system'
      });
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Sign in failed.');
    }
  };

  // =========================================================================
  // SIGN UP STEP 1 -> VALIDATE FORM & SEND 6-DIGIT EMAIL VERIFICATION OTP
  // =========================================================================
  const handleSendSignupVerificationOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setSignupFallbackOtp('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('অনুগ্রহ করে আপনার সম্পূর্ণ নাম (Full Name) লিখুন।');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('অনুগ্রহ করে একটি সঠিক ও সচল ইমেইল এড্রেস দিন।');
      return;
    }
    if (portalType === 'agency') {
      if (!isStrictGmailAddress(cleanEmail)) {
        setErrorMessage(
          '❌ Agency Master Portal-এ শুধুমাত্র Gmail (@gmail.com) দিয়ে একাউন্ট খোলা যাবে। অন্য কোনো মেইল গ্রহণযোগ্য নয়।'
        );
        return;
      }
      if (isAgencyLimitReached) {
        setErrorMessage(
          `❌ Agency Master Portal-এ সর্বোচ্চ ৩টি Gmail একাউন্ট খোলার সীমা (${MAX_AGENCY_GMAIL_ACCOUNTS}/${MAX_AGENCY_GMAIL_ACCOUNTS}) পূর্ণ হয়ে গেছে! ৩টির বেশি মেইল থেকে একাউন্ট খোলা যাবে না।`
        );
        return;
      }
    }

    const existingDuplicate = allUsers.find((u) => u.email?.trim().toLowerCase() === cleanEmail);
    if (existingDuplicate) {
      setErrorMessage(
        `❌ এই ইমেইল (${cleanEmail}) দিয়ে ইতিমধ্যে একাউন্ট খোলা হয়েছে। অনুগ্রহ করে Sign In করুন।`
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters).');
      return;
    }
    if (!confirmPassword) {
      setErrorMessage('অনুগ্রহ করে Confirm Password বক্সে পুনরায় আপনার পাসওয়ার্ডটি লিখুন।');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('❌ Password এবং Confirm Password মিলছে না! দুটি বক্সেই একই পাসওয়ার্ড দিন।');
      return;
    }
    if (!acceptedTerms) {
      setErrorMessage(
        '❌ একাউন্ট তৈরি করার জন্য Terms & Conditions এবং Privacy Policy-তে টিক (✓) দেওয়া বাধ্যতামূলক।'
      );
      return;
    }

    setIsLoading(true);
    let localSmtpList: any[] = [];
    try {
      const stored = localStorage.getItem('visualsky_smtp');
      if (stored) localSmtpList = JSON.parse(stored);
    } catch {}

    try {
      const res = await fetch('/api/auth/send-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
          confirmPassword,
          acceptedTerms,
          role: portalType,
          smtpAccounts: localSmtpList
        })
      });

      const parsed = await safeParseResponse(res, 'Failed to send verification code');
      if (!parsed.ok || !parsed.data?.success) {
        setIsLoading(false);
        setErrorMessage(
          safeString(parsed.data?.error, 'ইমেইলে ভেরিফিকেশন কোড পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।')
        );
        return;
      }

      if (parsed.data?.signupOtpToken) {
        setSignupOtpToken(parsed.data.signupOtpToken);
      }
      if (parsed.data?.emergencyOtp) {
        setSignupFallbackOtp(String(parsed.data.emergencyOtp));
      }

      setSignupOtpDigits(['', '', '', '', '', '']);
      setSignupResendCooldown(60);
      setSignupStep('verify_otp');
      setIsLoading(false);
      setSuccessMessage(
        parsed.data?.message ||
          `আপনার ${cleanEmail} ইমেইলে ৬-ডিজিটের ভেরিফিকেশন কোড পাঠানো হয়েছে।`
      );

      setTimeout(() => signupOtpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'ইমেইলে ভেরিফিকেশন কোড পাঠাতে সমস্যা হয়েছে।');
    }
  };

  // =========================================================================
  // SIGN UP STEP 2 -> VERIFY 6-DIGIT EMAIL OTP CODE & COMPLETE ACCOUNT CREATION
  // =========================================================================
  const handleSignupOtpDigitChange = (index: number, val: string) => {
    const numericVal = val.replace(/\D/g, '');
    if (numericVal.length > 1) {
      const chars = numericVal.slice(0, 6).split('');
      const newDigits = [...signupOtpDigits];
      chars.forEach((c, i) => {
        if (i < 6) newDigits[i] = c;
      });
      setSignupOtpDigits(newDigits);
      signupOtpInputRefs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }

    const newDigits = [...signupOtpDigits];
    newDigits[index] = numericVal;
    setSignupOtpDigits(newDigits);
    if (numericVal && index < 5) {
      signupOtpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSignupOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !signupOtpDigits[index] && index > 0) {
      signupOtpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      signupOtpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      signupOtpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSignupOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((c, i) => {
      if (i < 6) newDigits[i] = c;
    });
    setSignupOtpDigits(newDigits);
    signupOtpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifySignupOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const finalOtp = signupOtpDigits.join('').trim();

    if (finalOtp.length !== 6) {
      setErrorMessage('অনুগ্রহ করে আপনার ইমেইলে পাঠানো ৬-ডিজিটের ভেরিফিকেশন কোডটি সম্পূর্ণ লিখুন।');
      return;
    }

    setIsLoading(true);
    try {
      const verifyRes = await fetch('/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otpCode: finalOtp,
          role: portalType,
          signupOtpToken
        })
      });

      const verifyParsed = await safeParseResponse(verifyRes, 'OTP verification failed');
      if (!verifyParsed.ok || !verifyParsed.data?.success) {
        setIsLoading(false);
        setErrorMessage(
          safeString(
            verifyParsed.data?.error,
            '❌ ভুল বা মেয়াদোত্তীর্ণ ভেরিফিকেশন কোড! আপনার ইমেইলে পাঠানো সঠিক ৬-ডিজিট কোডটি দিন।'
          )
        );
        return;
      }

      const vToken = verifyParsed.data.verifiedEmailToken || '';
      setVerifiedEmailToken(vToken);

      if (portalType === 'client') {
        // Email is now 100% verified -> Open bKash Payment Gateway Window for Client Subscription
        setIsLoading(false);
        setPendingGoogleUser(null);
        setIsBkashWindowOpen(true);
        return;
      }

      // Agency Master Portal -> Email is verified, create account immediately!
      await finalizeEmailRegistration(null, vToken, finalOtp);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'ভেরিফিকেশন কোড যাচাই করতে সমস্যা হয়েছে।');
    }
  };

  // =========================================================================
  // FINALIZE ACCOUNT CREATION AFTER EMAIL OTP (+ BKASH FOR CLIENTS)
  // =========================================================================
  const finalizeEmailRegistration = async (
    bkashPayload: BkashPaymentSuccessPayload | null,
    overrideVerifiedToken?: string,
    overrideOtpCode?: string
  ) => {
    setIsLoading(true);
    setErrorMessage('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const isAgency = portalType === 'agency';
    const activeVerifiedToken = overrideVerifiedToken ?? verifiedEmailToken;
    const activeOtpCode = overrideOtpCode ?? signupOtpDigits.join('').trim();

    const paymentInfo = bkashPayload
      ? {
          method: 'bKash' as const,
          planId: selectedPlan.id,
          planCode: selectedPlan.planCode,
          planName: selectedPlan.name,
          amountBDT: bkashPayload.amountBDT,
          trxId: bkashPayload.trxId,
          senderPhone: bkashPayload.senderPhone,
          paymentDate: bkashPayload.paidAt,
          status: (bkashPayload.status || 'pending') as 'pending' | 'verified' | 'rejected',
          ownerPayoutAccount: `${ownerBkashNumber} (bKash Personal Send Money)`,
          quotaLimit: selectedPlan.quotaLimit,
          aiCredits: selectedPlan.aiCredits
        }
      : undefined;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: bkashPayload?.senderPhone || '',
          password,
          confirmPassword,
          acceptedTerms: true,
          emailVerificationOtp: activeOtpCode,
          signupOtpToken,
          verifiedEmailToken: activeVerifiedToken,
          role: isAgency ? 'agency' : 'client',
          plan: isAgency ? 'Enterprise' : selectedPlan.planCode,
          bdtPlanLabel: isAgency
            ? 'Agency Master Admin (Free Unlimited)'
            : `${selectedPlan.name} (BDT ${selectedPlan.priceBDT.toLocaleString()}/mo)`,
          quotaLimit: isAgency ? 50000 : selectedPlan.quotaLimit,
          aiCredits: isAgency ? 10000 : selectedPlan.aiCredits,
          paymentInfo
        })
      });

      const parsed = await safeParseResponse(res, 'Registration failed');
      if (!parsed.ok || !parsed.data?.success) {
        setIsLoading(false);
        setErrorMessage(safeString(parsed.data?.error, 'Could not create account.'));
        return;
      }

      if (isSupabaseConfigured) {
        await signUpWithSupabase(cleanEmail, password, {
          name: cleanName,
          role: isAgency ? 'agency' : 'client',
          phone: bkashPayload?.senderPhone || ''
        }).catch(() => {});
      }

      const newUser: UserAccount = parsed.data.user;
      if (Array.isArray(parsed.data?.users)) {
        setAllUsers(parsed.data.users);
      } else {
        setAllUsers((prev) => [
          newUser,
          ...prev.filter((u) => u.email.toLowerCase() !== newUser.email.toLowerCase())
        ]);
      }

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, newUser.email);
        }
      } catch {}

      if (!isAgency && paymentInfo?.status === 'pending') {
        setIsLoading(false);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.3 } });
        setSignupStep('form');
        setAuthMode('signin');
        setSuccessMessage(
          `✅ আপনার ইমেইল ভেরিফিকেশন এবং বিকাশ পেমেন্ট তথ্য (নাম্বার: ${paymentInfo.senderPhone}, TrxID: ${paymentInfo.trxId}, ৳${paymentInfo.amountBDT.toLocaleString()}) সফলভাবে জমা হয়েছে! এডমিন আপনার বিকাশ নাম্বার ও TrxID ভেরিফাই করে অ্যাক্টিভ করলেই আপনি লগইন করতে পারবেন।`
        );
        addNotification({
          title: 'bKash Send Money Submitted (Pending Verification)',
          message: `TrxID ${paymentInfo.trxId} (৳${paymentInfo.amountBDT.toLocaleString()}) sent to Admin Dashboard for verification.`,
          type: 'system'
        });
        return;
      }

      loginUser(newUser, isAgency ? 'owner' : 'dashboard');
      await loadUserWorkspace(newUser.email, newUser.id);

      setIsLoading(false);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 } });
      addNotification({
        title: bkashPayload
          ? `bKash Payment Confirmed & Account Created!`
          : 'Email Verified & Account Created!',
        message: bkashPayload
          ? `Paid BDT ${bkashPayload.amountBDT.toLocaleString()} (TrxID: ${bkashPayload.trxId}) for ${selectedPlan.name}.`
          : `Welcome to VisualSky Agency Master Portal, ${newUser.name}!`,
        type: 'system'
      });
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Registration failed.');
    }
  };

  const finalizeGoogleRegistrationAfterPayment = async (
    bkashPayload: BkashPaymentSuccessPayload
  ) => {
    if (!pendingGoogleUser) return;
    setIsGoogleLoading(true);
    setErrorMessage('');

    const paymentInfo = {
      method: 'bKash' as const,
      planId: selectedPlan.id,
      planCode: selectedPlan.planCode,
      planName: selectedPlan.name,
      amountBDT: bkashPayload.amountBDT,
      trxId: bkashPayload.trxId,
      senderPhone: bkashPayload.senderPhone,
      paymentDate: bkashPayload.paidAt,
      status: (bkashPayload.status || 'pending') as 'pending' | 'verified' | 'rejected',
      ownerPayoutAccount: `${ownerBkashNumber} (bKash Personal Send Money)`,
      quotaLimit: selectedPlan.quotaLimit,
      aiCredits: selectedPlan.aiCredits
    };

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: pendingGoogleUser.uid,
          email: pendingGoogleUser.email,
          name: pendingGoogleUser.name,
          avatar: pendingGoogleUser.avatar,
          phone: bkashPayload.senderPhone,
          role: 'client',
          plan: selectedPlan.planCode,
          bdtPlanLabel: `${selectedPlan.name} (BDT ${selectedPlan.priceBDT.toLocaleString()}/mo)`,
          quotaLimit: selectedPlan.quotaLimit,
          aiCredits: selectedPlan.aiCredits,
          paymentInfo
        })
      });

      const parsed = await safeParseResponse(res, 'Google registration failed');
      const serverUser: UserAccount =
        parsed.ok && parsed.data?.user
          ? parsed.data.user
          : {
              id: pendingGoogleUser.uid,
              name: pendingGoogleUser.name,
              email: pendingGoogleUser.email,
              phone: bkashPayload.senderPhone,
              avatar:
                pendingGoogleUser.avatar ||
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
              role: 'client',
              isOwner: false,
              plan: selectedPlan.planCode,
              bdtPlanLabel: `${selectedPlan.name} (BDT ${selectedPlan.priceBDT.toLocaleString()}/mo)`,
              quotaUsed: 0,
              quotaLimit: selectedPlan.quotaLimit,
              aiCredits: selectedPlan.aiCredits,
              paymentInfo
            };

      if (Array.isArray(parsed.data?.users)) {
        setAllUsers(parsed.data.users);
      } else {
        setAllUsers((prev) => [
          serverUser,
          ...prev.filter((u) => u.email.toLowerCase() !== serverUser.email.toLowerCase())
        ]);
      }

      try {
        localStorage.setItem(REMEMBER_EMAIL_KEY, serverUser.email);
      } catch {}

      if (paymentInfo.status === 'pending') {
        setIsGoogleLoading(false);
        setPendingGoogleUser(null);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.3 } });
        setAuthMode('signin');
        setSuccessMessage(
          `✅ আপনার বিকাশ পেমেন্ট তথ্য (নাম্বার: ${paymentInfo.senderPhone}, TrxID: ${paymentInfo.trxId}, ৳${paymentInfo.amountBDT.toLocaleString()}) সফলভাবে জমা হয়েছে! এডমিন ভেরিফাই করে অ্যাক্টিভ করলেই আপনি লগইন করতে পারবেন।`
        );
        return;
      }

      loginUser(serverUser, 'dashboard');
      await loadUserWorkspace(serverUser.email, serverUser.id);

      setIsGoogleLoading(false);
      setPendingGoogleUser(null);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 } });
      addNotification({
        title: `bKash Payment Confirmed & Account Created!`,
        message: `Welcome ${serverUser.name}! Paid BDT ${bkashPayload.amountBDT.toLocaleString()} (TrxID: ${bkashPayload.trxId}).`,
        type: 'system'
      });
      onClose();
    } catch (err: any) {
      setIsGoogleLoading(false);
      setErrorMessage(err?.message || 'Could not complete Google account setup.');
    }
  };

  // =========================================================================
  // FORGOT PASSWORD (OTP)
  // =========================================================================
  const handleRequestPasswordReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setFallbackOtpCode('');

    const targetEmail = forgotEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    let localSmtpList: any[] = [];
    try {
      const stored = localStorage.getItem('visualsky_smtp');
      if (stored) localSmtpList = JSON.parse(stored);
    } catch {}

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, smtpAccounts: localSmtpList })
      });

      const parsed = await safeParseResponse(res, 'Failed to send code');
      if (!parsed.ok || !parsed.data?.success) {
        throw new Error(safeString(parsed.data?.error, 'Failed to send code.'));
      }

      if (parsed.data?.otpToken) setOtpToken(parsed.data.otpToken);
      if (parsed.data?.emergencyOtp) setFallbackOtpCode(String(parsed.data.emergencyOtp));

      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
      setForgotPhase('verify');
      setIsLoading(false);
      setSuccessMessage(`6-digit reset code sent to ${targetEmail}.`);

      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Unable to send reset code.');
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const numericVal = val.replace(/\D/g, '');
    if (numericVal.length > 1) {
      const chars = numericVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      chars.forEach((c, i) => {
        if (i < 6) newDigits[i] = c;
      });
      setOtpDigits(newDigits);
      otpInputRefs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = numericVal;
    setOtpDigits(newDigits);
    if (numericVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleForgotOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((c, i) => {
      if (i < 6) newDigits[i] = c;
    });
    setOtpDigits(newDigits);
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtpAndChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const targetEmail = forgotEmail.trim().toLowerCase();
    const finalOtp = otpDigits.join('').trim();
    if (finalOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    if (newResetPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      setErrorMessage('❌ New Password এবং Confirm Password মিলছে না!');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          otp: finalOtp,
          newPassword: newResetPassword,
          confirmPassword: confirmResetPassword,
          otpToken
        })
      });

      const parsed = await safeParseResponse(res, 'Password reset failed');
      if (!parsed.ok || !parsed.data?.success) {
        throw new Error(safeString(parsed.data?.error, 'Invalid or expired code.'));
      }

      if (isSupabaseConfigured && supabase) {
        await supabase.auth.updateUser({ password: newResetPassword }).catch(() => {});
      }

      resetUserPasswordByEmail(targetEmail, newResetPassword);

      setIsLoading(false);
      setEmail(targetEmail);
      setPassword(newResetPassword);
      setAuthMode('signin');
      setSuccessMessage('Password updated successfully! You can now sign in.');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(safeString(err, 'Failed to reset password.'));
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={`saas-modal-pop relative w-full ${
            authMode === 'signup' ? 'max-w-[490px]' : 'max-w-[440px]'
          } bg-[#0c1220] border border-slate-800/90 rounded-2xl shadow-2xl p-4 sm:p-7 my-auto transition-all`}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-4">
            <VisualSkyLogo size="sm" showText={false} />
            <h2 className="mt-2.5 text-xl font-bold tracking-tight text-slate-100">
              {authMode === 'signin'
                ? portalType === 'agency'
                  ? 'Agency Master Portal Login'
                  : 'Sign in to VisualSky'
                : authMode === 'signup'
                  ? signupStep === 'verify_otp'
                    ? 'Verify Your Email Address'
                    : portalType === 'client'
                      ? 'Choose Plan & Create Account'
                      : 'Agency Master Portal Sign Up'
                  : 'Reset Your Password'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {authMode === 'forgot_password'
                ? 'Enter your registered email to receive a 6-digit recovery code'
                : authMode === 'signup' && signupStep === 'verify_otp'
                  ? `We sent a 6-digit verification code to ${email.trim().toLowerCase()}`
                  : authMode === 'signup' && portalType === 'client'
                    ? 'ইমেইল ভেরিফিকেশন ও বিকাশ পেমেন্ট সম্পন্ন করলেই একাউন্ট চালু হবে'
                    : authMode === 'signup' && portalType === 'agency'
                      ? 'Gmail ভেরিফিকেশন কোড (OTP) দিয়ে আপনার Agency Master একাউন্ট তৈরি করুন'
                      : 'Continue with your Google account or verified email'}
            </p>

            {/* Client Workspace / Agency Master Portal Switch + Mode Switcher */}
            {authMode !== 'forgot_password' && signupStep === 'form' && (
              <div className="mt-3.5 flex flex-col items-center gap-2.5 w-full">
                {/* Portal Switcher */}
                <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs gap-1">
                  <button
                    type="button"
                    onClick={() => setPortalType('client')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                      portalType === 'client'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    Client Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('agency');
                      if (agencyGmailCount === 0) {
                        setAuthMode('signup');
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                      portalType === 'agency'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    Agency Master Portal
                  </button>
                </div>

                {/* Sign In / Sign Up Segmented Tabs */}
                <div className="grid grid-cols-2 w-full p-1 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthMode('signin')}
                    className={`py-2 rounded-lg font-semibold transition cursor-pointer ${
                      authMode === 'signin'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`py-2 rounded-lg font-semibold transition cursor-pointer ${
                      authMode === 'signup'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {portalType === 'agency' && (
                  <div
                    className={`w-full px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                      isAgencyLimitReached && authMode === 'signup'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-left">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>শুধুমাত্র ৩টি Gmail (@gmail.com) একাউন্ট অনুমোদিত</span>
                    </div>
                    <span className="font-mono font-bold tabular-nums px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 shrink-0">
                      {agencyGmailCount} / {MAX_AGENCY_GMAIL_ACCOUNTS} Gmail
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error / Success Alert */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* =================================================================== */}
          {/* SIGN UP STEP 2: 6-DIGIT EMAIL VERIFICATION VIEW                     */}
          {/* =================================================================== */}
          {authMode === 'signup' && signupStep === 'verify_otp' && (
            <form onSubmit={handleVerifySignupOtpSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span>ইমেইল ভেরিফিকেশন কোড পাঠানো হয়েছে</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep('form');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80 break-all">
                  {email.trim().toLowerCase()}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  আপনার ইমেইলের <strong>Inbox</strong> অথবা <strong>Spam / Promotions</strong> ফোল্ডার চেক করুন এবং ৬-ডিজিটের ভেরিফিকেশন কোডটি নিচে লিখুন:
                </p>
              </div>

              {/* Fallback OTP helper if SMTP server is unreachable in sandbox */}
              {signupFallbackOtp && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-amber-300">
                      Instant Verification Code: <span className="font-mono font-black tracking-wider text-white">{signupFallbackOtp}</span>
                    </div>
                    <div className="text-[10px] text-amber-200/80">
                      SMTP সার্ভারের বিকল্প হিসেবে এই কোডটি ব্যবহার করতে পারেন
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupOtpDigits(signupFallbackOtp.slice(0, 6).split(''));
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-[11px] shrink-0 cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-200">
                    Enter 6-Digit Verification Code
                  </label>
                  {signupResendCooldown > 0 ? (
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      Resend in {signupResendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendSignupVerificationOtp()}
                      disabled={isLoading}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      Resend Verification Code
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {signupOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        signupOtpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleSignupOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleSignupOtpKeyDown(idx, e)}
                      onPaste={handleSignupOtpPaste}
                      className="w-full h-11 text-center text-lg font-bold font-mono tabular-nums rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || signupOtpDigits.join('').length !== 6}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                  portalType === 'client'
                    ? 'bg-[#E2136E] hover:bg-[#c91060] text-white shadow-lg shadow-[#E2136E]/25'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold'
                }`}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : portalType === 'client' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Verify Code &amp; Pay ৳{selectedPlan.priceBDT.toLocaleString()} with bKash
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Code &amp; Create Agency Account</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSignupStep('form');
                  setErrorMessage('');
                }}
                className="w-full pt-1 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to account details</span>
              </button>
            </form>
          )}

          {/* =================================================================== */}
          {/* SIGN IN & SIGN UP STEP 1 VIEW                                       */}
          {/* =================================================================== */}
          {authMode !== 'forgot_password' && !(authMode === 'signup' && signupStep === 'verify_otp') && (
            <>
              {/* SUBSCRIPTION PLAN SELECTOR (Shown during Client Sign Up) */}
              {authMode === 'signup' && portalType === 'client' && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">
                      1. Select Subscription Plan
                    </span>
                    <span className="text-[11px] font-semibold text-[#f43f8e]">
                      bKash Checkout
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BDT_CLIENT_PLANS.map((plan) => {
                      const active = plan.id === selectedPlan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            active
                              ? 'bg-[#E2136E]/15 border-[#E2136E] shadow-sm'
                              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-[11px] font-bold text-slate-100 truncate">
                            {plan.name.split(' ')[0]}
                          </div>
                          <div className="text-xs font-black font-mono tabular-nums text-[#f43f8e] mt-0.5">
                            ৳{plan.priceBDT.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {plan.quotaLimit.toLocaleString()} leads
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 1-Click Official Continue with Google Button */}
              <button
                type="button"
                onClick={handleGoogleContinue}
                disabled={isGoogleLoading || isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 shadow-sm transition cursor-pointer disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                )}
                <span className="truncate">
                  {isGoogleLoading
                    ? 'Connecting to Google...'
                    : authMode === 'signup' && portalType === 'client'
                      ? `Continue with Google & Pay ৳${selectedPlan.priceBDT.toLocaleString()}`
                      : 'Continue with Google'}
                </span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="w-full border-t border-slate-800" />
                <span className="px-3 bg-[#0c1220] text-[11px] text-slate-500 shrink-0">
                  {authMode === 'signup' ? 'or register with email OTP' : 'or sign in with email'}
                </span>
                <div className="w-full border-t border-slate-800" />
              </div>

              {/* Email Form */}
              <form
                onSubmit={
                  authMode === 'signin' ? handleSignInSubmit : handleSendSignupVerificationOtp
                }
                className="space-y-3"
              >
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      {portalType === 'agency'
                        ? 'Gmail Address (@gmail.com only)'
                        : 'Email Address'}{' '}
                      <span className="text-rose-400">*</span>
                    </label>
                    {authMode === 'signup' && email.trim().length > 3 && (
                      <span
                        className={`text-[10px] font-medium ${
                          portalType === 'agency'
                            ? isStrictGmailAddress(email)
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                            : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {portalType === 'agency'
                          ? isStrictGmailAddress(email)
                            ? '✓ Valid Gmail'
                            : 'Must end with @gmail.com'
                          : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                            ? '✓ Valid Email'
                            : 'Enter valid email'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={portalType === 'agency' ? 'yourname@gmail.com' : 'you@company.com'}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      Password <span className="text-rose-400">*</span>
                    </label>
                    {authMode === 'signup' && password.length > 0 && (
                      <span className={`text-[10px] font-semibold ${passwordStrength.textColor}`}>
                        Strength: {passwordStrength.label}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        authMode === 'signup' ? 'Create a strong password (min 6 chars)' : '••••••••'
                      }
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter & Checklist (Shown on Sign Up) */}
                  {authMode === 'signup' && password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 rounded-full transition-colors ${
                              passwordStrength.score >= level
                                ? passwordStrength.barColor
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400">
                        <span
                          className={
                            passwordStrength.hasMinLength ? 'text-emerald-400' : 'text-slate-500'
                          }
                        >
                          {passwordStrength.hasMinLength ? '✓' : '○'} Min 6+ characters
                        </span>
                        <span
                          className={
                            passwordStrength.hasMixedCase ? 'text-emerald-400' : 'text-slate-500'
                          }
                        >
                          {passwordStrength.hasMixedCase ? '✓' : '○'} Upper &amp; lowercase
                        </span>
                        <span
                          className={
                            passwordStrength.hasNumber ? 'text-emerald-400' : 'text-slate-500'
                          }
                        >
                          {passwordStrength.hasNumber ? '✓' : '○'} At least 1 number
                        </span>
                        <span
                          className={
                            passwordStrength.hasSymbol ? 'text-emerald-400' : 'text-slate-500'
                          }
                        >
                          {passwordStrength.hasSymbol ? '✓' : '○'} Special symbol (!@#$)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field (Shown on Sign Up) */}
                {authMode === 'signup' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        Confirm Password <span className="text-rose-400">*</span>
                      </label>
                      {confirmPassword.length > 0 && (
                        <span
                          className={`text-[10px] font-semibold ${
                            confirmPassword === password ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {confirmPassword === password
                            ? '✓ Passwords match'
                            : '✕ Passwords do not match'}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password to confirm"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                          confirmPassword.length > 0
                            ? confirmPassword === password
                              ? 'border-emerald-500/50 focus:border-emerald-400'
                              : 'border-rose-500/50 focus:border-rose-400'
                            : 'border-slate-800 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        aria-label={
                          showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sign In Options: Remember Me & Forgot Password */}
                {authMode === 'signin' && (
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={rememberMe}
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-4 h-4 rounded flex items-center justify-center border transition cursor-pointer ${
                          rememberMe
                            ? 'bg-cyan-500 border-cyan-500 text-slate-950'
                            : 'bg-slate-900 border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                      <span className="text-xs text-slate-300">Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotPhase('request');
                        setAuthMode('forgot_password');
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Terms & Conditions and Privacy Policy Checkbox (Required on Sign Up) */}
                {authMode === 'signup' && (
                  <div className="pt-1">
                    <div
                      className={`p-3 rounded-xl border transition ${
                        acceptedTerms
                          ? 'bg-cyan-500/5 border-cyan-500/30'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={acceptedTerms}
                          onClick={() => setAcceptedTerms(!acceptedTerms)}
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition cursor-pointer ${
                            acceptedTerms
                              ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-xs'
                              : 'bg-slate-950 border-slate-600 hover:border-cyan-400 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                        <div className="text-[11px] text-slate-300 leading-relaxed text-left">
                          <span
                            onClick={() => setAcceptedTerms(!acceptedTerms)}
                            className="cursor-pointer select-none"
                          >
                            I have read and agree to the{' '}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLegalModalTab('terms')}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                          >
                            Terms &amp; Conditions
                          </button>{' '}
                          <span>and </span>
                          <button
                            type="button"
                            onClick={() => setLegalModalTab('privacy')}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                          >
                            Privacy Policy
                          </button>
                          <span
                            onClick={() => setAcceptedTerms(!acceptedTerms)}
                            className="cursor-pointer select-none"
                          >
                            , and consent to receive account verification emails.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selected Badge for Client Sign-Up */}
                {authMode === 'signup' && portalType === 'client' && (
                  <div className="p-2.5 sm:p-3 rounded-xl bg-[#E2136E]/10 border border-[#E2136E]/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#E2136E] text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        bKash
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] sm:text-xs font-bold text-white truncate">
                          Step 1: Email OTP → Step 2: bKash Payment
                        </div>
                        <div className="text-[10px] text-slate-300 leading-snug">
                          ইমেইল কোড ভেরিফাই হওয়ার পর বিকাশ পেমেন্ট উইন্ডো ওপেন হবে
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black font-mono tabular-nums text-[#f43f8e]">
                        ৳{selectedPlan.priceBDT.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">{selectedPlan.name.split(' ')[0]}</div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className={`w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                    authMode === 'signup' && portalType === 'client'
                      ? 'bg-[#E2136E] hover:bg-[#c91060] text-white shadow-lg shadow-[#E2136E]/25'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>
                        {authMode === 'signup'
                          ? 'Sending 6-Digit Verification Code...'
                          : 'Signing In...'}
                      </span>
                    </>
                  ) : authMode === 'signup' ? (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>
                        {portalType === 'agency'
                          ? 'Send Verification Code to Gmail'
                          : 'Send Email Verification Code'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer Toggle */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
                {authMode === 'signin' ? (
                  <>
                    <span>Don't have an account? </span>
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already have an account? </span>
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* =================================================================== */}
          {/* FORGOT PASSWORD VIEW                                                */}
          {/* =================================================================== */}
          {authMode === 'forgot_password' && (
            <div className="space-y-4">
              {forgotPhase === 'request' ? (
                <form onSubmit={handleRequestPasswordReset} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send 6-Digit Recovery Code</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpAndChangePass} className="space-y-3.5">
                  {fallbackOtpCode && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                      <span className="text-amber-200">
                        Recovery Code:{' '}
                        <strong className="font-mono text-white">{fallbackOtpCode}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtpDigits(fallbackOtpCode.slice(0, 6).split(''))}
                        className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        6-Digit Verification Code
                      </label>
                      {resendCooldown > 0 ? (
                        <span className="text-[11px] font-mono tabular-nums text-slate-400">
                          Resend in {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestPasswordReset()}
                          className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          Resend Code
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleForgotOtpPaste}
                          className="w-full h-10 text-center text-base font-bold font-mono tabular-nums rounded-lg bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">New Password</label>
                      {newResetPassword.length > 0 && (
                        <span
                          className={`text-[10px] font-semibold ${resetPasswordStrength.textColor}`}
                        >
                          {resetPasswordStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        value={newResetPassword}
                        onChange={(e) => setNewResetPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showResetPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        Confirm New Password
                      </label>
                      {confirmResetPassword.length > 0 && (
                        <span
                          className={`text-[10px] font-semibold ${
                            confirmResetPassword === newResetPassword
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {confirmResetPassword === newResetPassword
                            ? '✓ Passwords match'
                            : '✕ Does not match'}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showConfirmResetPassword ? 'text' : 'password'}
                        required
                        value={confirmResetPassword}
                        onChange={(e) => setConfirmResetPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showConfirmResetPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Verify Code &amp; Update Password</span>
                    )}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className="w-full pt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* INTERACTIVE TERMS & CONDITIONS / PRIVACY POLICY VIEWER MODAL          */}
      {/* ===================================================================== */}
      {legalModalTab && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLegalModalTab(null);
          }}
        >
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  {legalModalTab === 'terms'
                    ? 'VisualSky Terms & Conditions'
                    : 'VisualSky Privacy & Data Security Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModalTab(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Switch tabs inside legal viewer */}
            <div className="px-5 pt-3 flex gap-2 border-b border-slate-800/80 bg-slate-950/50">
              <button
                type="button"
                onClick={() => setLegalModalTab('terms')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  legalModalTab === 'terms'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => setLegalModalTab('privacy')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  legalModalTab === 'privacy'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Privacy Policy
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs text-slate-300 leading-relaxed">
              {legalModalTab === 'terms' ? (
                <>
                  <p className="font-semibold text-slate-100">
                    1. Account Registration &amp; Email Verification
                  </p>
                  <p>
                    Every account created on VisualSky (both Client Outbound Workspaces and Agency
                    Master Portal accounts) requires valid email ownership verification via a
                    6-digit One-Time Password (OTP). Agency Master Portal access is strictly
                    restricted to verified Gmail (@gmail.com) addresses up to a maximum of 3
                    authorized seats.
                  </p>
                  <p className="font-semibold text-slate-100">
                    2. Outbound Email &amp; Anti-Spam Compliance
                  </p>
                  <p>
                    Users connecting SMTP relays or launching sequences agree to comply with
                    applicable business communication standards (CAN-SPAM, GDPR, and regional
                    regulations). Unsolicited malicious phishing, deceptive headers, or unlawful
                    harassment are strictly prohibited.
                  </p>
                  <p className="font-semibold text-slate-100">
                    3. Subscription Billing &amp; bKash Verification
                  </p>
                  <p>
                    Client Workspace plans are billed in BDT via bKash payment verification.
                    Submitted Transaction IDs (TrxID) and sender numbers are verified against live
                    payment records before workspace activation.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-100">
                    1. Data Encryption &amp; Workspace Isolation
                  </p>
                  <p>
                    Your lead directories, SMTP credentials, campaigns, and inbox threads are
                    isolated per workspace. Passwords and verification tokens are protected with
                    cryptographic HMAC signatures.
                  </p>
                  <p className="font-semibold text-slate-100">
                    2. Email Verification &amp; Security Notifications
                  </p>
                  <p>
                    We use your registered email address strictly to dispatch 6-digit signup
                    verification codes, password recovery OTPs, and critical billing notifications.
                    We never sell or rent your contact lists or workspace data to third parties.
                  </p>
                  <p className="font-semibold text-slate-100">
                    3. Account Control &amp; Deletion
                  </p>
                  <p>
                    You may update your profile credentials, rotate SMTP passwords, or request
                    complete workspace deletion at any time from your Account Settings panel.
                  </p>
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLegalModalTab(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setLegalModalTab(null);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>I Agree &amp; Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive bKash Payment Gateway Window (Opens during Client Sign-Up after Email OTP Verification) */}
      <BkashGatewayWindow
        isOpen={isBkashWindowOpen}
        onClose={() => {
          setIsBkashWindowOpen(false);
          setPendingGoogleUser(null);
        }}
        amountBDT={selectedPlan.priceBDT}
        planId={selectedPlan.id}
        planName={selectedPlan.name}
        receiverNumber={ownerBkashNumber}
        customerEmail={pendingGoogleUser?.email || email.trim()}
        customerName={pendingGoogleUser?.name || fullName.trim()}
        onPlanChange={(pId) => setSelectedPlanId(pId)}
        onSuccess={(payload) => {
          setIsBkashWindowOpen(false);
          if (pendingGoogleUser) {
            finalizeGoogleRegistrationAfterPayment(payload);
          } else {
            finalizeEmailRegistration(payload);
          }
        }}
      />
    </>
  );
};
