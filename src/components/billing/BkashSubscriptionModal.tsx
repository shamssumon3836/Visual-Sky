import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BDT_CLIENT_PLANS, OWNER_PAYOUT_ACCOUNTS } from '../auth/AuthModal';
import { safeParseResponse } from '../../lib/safeFetch';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  BkashGatewayWindow,
  BkashPaymentSuccessPayload
} from './BkashGatewayWindow';

interface BkashSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlanId?: string;
}

export const BkashSubscriptionModal: React.FC<BkashSubscriptionModalProps> = ({
  isOpen,
  onClose,
  initialPlanId = 'scale'
}) => {
  const { currentUser, setCurrentUser, setAllUsers, addNotification } = useApp();

  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || 'scale');
  const [isGatewayWindowOpen, setIsGatewayWindowOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const [ownerBkashNumber, setOwnerBkashNumber] = useState<string>(
    OWNER_PAYOUT_ACCOUNTS.bKash.number
  );

  useEffect(() => {
    if (isOpen) {
      if (initialPlanId) setSelectedPlanId(initialPlanId);
      setErrorMessage('');
      setSuccessMessage('');
      fetch('/api/settings/payment')
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && d?.settings?.bkashPersonalNumber) {
            setOwnerBkashNumber(d.settings.bkashPersonalNumber);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialPlanId]);

  if (!isOpen) return null;

  const selectedPlan =
    BDT_CLIENT_PLANS.find((p) => p.id === selectedPlanId) || BDT_CLIENT_PLANS[1];

  const handleGatewaySuccess = async (payload: BkashPaymentSuccessPayload) => {
    setIsGatewayWindowOpen(false);
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/subscriptions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          phone: payload.senderPhone,
          planId: selectedPlan.id,
          planCode: selectedPlan.planCode,
          planName: selectedPlan.name,
          amountBDT: payload.amountBDT,
          senderPhone: payload.senderPhone,
          trxId: payload.trxId,
          quotaLimit: selectedPlan.quotaLimit,
          aiCredits: selectedPlan.aiCredits
        })
      });

      const parsed = await safeParseResponse(res, 'Failed to process bKash payment');
      if (!parsed.ok || !parsed.data?.success) {
        setIsSubmitting(false);
        setErrorMessage(parsed.data?.error || 'Could not process bKash payment. Please try again.');
        return;
      }

      const updatedUser = parsed.data.user;
      setCurrentUser(updatedUser);
      if (Array.isArray(parsed.data.users)) {
        setAllUsers(parsed.data.users);
      } else {
        setAllUsers((prev) => [
          updatedUser,
          ...prev.filter((u) => u.email.toLowerCase() !== updatedUser.email.toLowerCase())
        ]);
      }

      setIsSubmitting(false);
      setSuccessMessage(
        `✅ আপনার বিকাশ পেমেন্ট তথ্য (নাম্বার: ${payload.senderPhone}, TrxID: ${payload.trxId}, ৳${payload.amountBDT.toLocaleString()}) জমা হয়েছে! এডমিন ভেরিফাই করলেই আপনার ${selectedPlan.name} সাবস্ক্রিপশন চালু হয়ে যাবে।`
      );
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.3 } });

      addNotification({
        title: `bKash Send Money Submitted (${selectedPlan.name})`,
        message: `Submitted BDT ${payload.amountBDT.toLocaleString()} (TrxID: ${payload.trxId}) for Admin verification.`,
        type: 'system'
      });

      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Payment verification failed.');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full max-w-xl bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 my-auto text-slate-100">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-[#E2136E] flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg shadow-[#E2136E]/30">
              bKash
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Upgrade Subscription with bKash
              </h2>
              <p className="text-xs text-slate-400">
                প্ল্যান সিলেক্ট করে bKash বাটনে ক্লিক করলে বিকাশ উইন্ডো খুলবে এবং পিন দিলে অটো টাকা কেটে প্ল্যান চালু হবে
              </p>
            </div>
          </div>

          {/* Step 1: Select Plan */}
          <div className="mt-5 space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300">
              1. Choose Your Subscription Plan (সাবস্ক্রিপশন প্ল্যান বেছে নিন)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {BDT_CLIENT_PLANS.map((plan) => {
                const isSelected = plan.id === selectedPlan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#E2136E]/15 border-[#E2136E] shadow-md'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">{plan.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#f43f8e]" />}
                    </div>
                    <div className="text-base font-black font-mono text-[#f43f8e] mt-1">
                      {plan.priceDisplay}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {plan.quotaLimit.toLocaleString()} Leads &middot; {plan.maxSmtp} SMTPs
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Plan Features & Payment Method Summary */}
          <div className="mt-5 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">{selectedPlan.name} Plan</div>
                <div className="text-[11px] text-slate-400">{selectedPlan.description}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Total Payable
                </div>
                <div className="text-lg font-black font-mono text-[#f43f8e]">
                  ৳ {selectedPlan.priceBDT.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
              {selectedPlan.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Pay with bKash Gateway Button */}
          <div className="mt-5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsGatewayWindowOpen(true)}
              className="w-full py-3.5 px-5 rounded-xl bg-[#E2136E] hover:bg-[#c91060] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-[#E2136E]/25 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded bg-white text-[#E2136E] font-black text-xs">
                    bKash
                  </span>
                  <span>
                    Pay ৳{selectedPlan.priceBDT.toLocaleString()} with bKash Checkout Window
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                ক্লিক করলে বিকাশ পেমেন্ট উইন্ডো ওপেন হবে (নাম্বার, অ্যামাউন্ট ও পিন দিয়ে অটো পেমেন্ট)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive bKash Checkout Popup Window */}
      <BkashGatewayWindow
        isOpen={isGatewayWindowOpen}
        onClose={() => setIsGatewayWindowOpen(false)}
        amountBDT={selectedPlan.priceBDT}
        planId={selectedPlan.id}
        planName={selectedPlan.name}
        receiverNumber={ownerBkashNumber}
        initialPhone={currentUser?.phone || ''}
        customerEmail={currentUser?.email || ''}
        onSuccess={handleGatewaySuccess}
      />
    </>
  );
};
