import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  ShieldCheck,
  Copy,
  Check,
  Hash,
  Send
} from 'lucide-react';
import { safeParseResponse } from '../../lib/safeFetch';

export interface BkashPaymentSuccessPayload {
  senderPhone: string;
  trxId: string;
  amountBDT: number;
  planId: string;
  planName: string;
  paidAt: string;
  receiverAccount: string;
  status?: 'pending' | 'verified' | 'rejected';
}

interface BkashGatewayWindowProps {
  isOpen: boolean;
  onClose: () => void;
  amountBDT: number;
  planId: string;
  planName: string;
  receiverNumber: string;
  initialPhone?: string;
  customerEmail?: string;
  customerName?: string;
  onPlanChange?: (planId: string) => void;
  onSuccess: (payload: BkashPaymentSuccessPayload) => void;
}

const PLAN_OPTIONS = [
  { id: 'starter', name: 'Starter Growth', priceBDT: 1999 },
  { id: 'scale', name: 'Scale Business', priceBDT: 4999 },
  { id: 'enterprise', name: 'Agency Unlimited', priceBDT: 9999 }
];

export const BkashGatewayWindow: React.FC<BkashGatewayWindowProps> = ({
  isOpen,
  onClose,
  amountBDT,
  planId,
  planName,
  receiverNumber,
  initialPhone = '',
  customerEmail = '',
  customerName = '',
  onPlanChange,
  onSuccess
}) => {
  const [step, setStep] = useState<'form' | 'submitting' | 'submitted'>('form');
  const [activePlanId, setActivePlanId] = useState<string>(planId || 'scale');
  const [senderBkashNumber, setSenderBkashNumber] = useState<string>(initialPhone);
  const [trxId, setTrxId] = useState<string>('');
  const [enteredAmount, setEnteredAmount] = useState<string>(String(amountBDT));
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [liveReceiverNumber, setLiveReceiverNumber] = useState<string>(
    receiverNumber || '01577-225248'
  );
  const [copiedReceiver, setCopiedReceiver] = useState<boolean>(false);

  const currentPlan =
    PLAN_OPTIONS.find((p) => p.id === activePlanId) || {
      id: planId,
      name: planName,
      priceBDT: amountBDT
    };

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setActivePlanId(planId || 'scale');
      setSenderBkashNumber(initialPhone ? initialPhone.replace(/[^0-9]/g, '').slice(-11) : '');
      setTrxId('');
      setEnteredAmount(String(amountBDT));
      setErrorMsg('');
      setIsSubmitting(false);

      fetch('/api/settings/payment')
        .then((r) => safeParseResponse(r, 'Failed to load payment settings'))
        .then((parsed) => {
          if (parsed.ok && parsed.data?.settings?.bkashPersonalNumber) {
            setLiveReceiverNumber(parsed.data.settings.bkashPersonalNumber);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialPhone, amountBDT, planId]);

  if (!isOpen) return null;

  const handleCopyReceiverNumber = () => {
    const cleanNum = liveReceiverNumber.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(cleanNum || liveReceiverNumber);
    setCopiedReceiver(true);
    setTimeout(() => setCopiedReceiver(false), 2000);
  };

  const handleSelectPlanOption = (pId: string, price: number) => {
    setActivePlanId(pId);
    setEnteredAmount(String(price));
    setErrorMsg('');
    if (onPlanChange) onPlanChange(pId);
  };

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPhone = senderBkashNumber.replace(/[^0-9]/g, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg(
        '❌ সঠিক ১১ ডিজিটের গ্রাহকের বিকাশ নাম্বার দিন (013-019 দিয়ে শুরু)। যে নাম্বার থেকে টাকা পাঠিয়েছেন সেটি লিখুন।'
      );
      return;
    }

    const cleanTrx = trxId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanTrx.length < 8 || cleanTrx.length > 12) {
      setErrorMsg(
        '❌ সঠিক ৮ থেকে ১২ ক্যারেক্টারের বিকাশ Transaction ID (TrxID) দিন (যেমন: BKA83L92X1)।'
      );
      return;
    }

    const numericEntered = Number(enteredAmount);
    if (!numericEntered || numericEntered !== currentPlan.priceBDT) {
      setErrorMsg(
        `❌ ${currentPlan.name} প্ল্যানের জন্য নির্ধারিত ৳${currentPlan.priceBDT.toLocaleString()} অ্যামাউন্ট সঠিকভাবে লিখুন।`
      );
      return;
    }

    setIsSubmitting(true);
    setStep('submitting');

    try {
      const res = await fetch('/api/bkash/submit-manual-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderPhone: cleanPhone,
          trxId: cleanTrx,
          amountBDT: numericEntered,
          expectedAmountBDT: currentPlan.priceBDT,
          planId: currentPlan.id,
          planName: currentPlan.name,
          customerEmail,
          customerName
        })
      });

      const parsed = await safeParseResponse(res, 'Failed to submit manual bKash payment');
      if (!parsed.ok || !parsed.data?.success || !parsed.data?.payment) {
        setIsSubmitting(false);
        setStep('form');
        setErrorMsg(
          parsed.data?.error ||
            '❌ সঠিক বিকাশ নাম্বার এবং আসল Transaction ID (TrxID) প্রদান করুন।'
        );
        return;
      }

      const livePayment = parsed.data.payment;
      setStep('submitted');

      setTimeout(() => {
        setIsSubmitting(false);
        onSuccess({
          senderPhone: livePayment.senderPhone,
          trxId: livePayment.trxId,
          amountBDT: livePayment.amountBDT,
          planId: currentPlan.id,
          planName: currentPlan.name,
          paidAt: livePayment.paidAt,
          status: 'pending',
          receiverAccount: livePayment.receiverAccount || liveReceiverNumber
        });
      }, 900);
    } catch (err: any) {
      setIsSubmitting(false);
      setStep('form');
      setErrorMsg(err?.message || 'নেটওয়ার্ক ত্রুটি, আবার চেষ্টা করুন।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="vs-auth-popup-window relative w-full max-w-[440px] max-w-md my-auto rounded-2xl overflow-hidden shadow-2xl border-2 border-[#E2136E] bg-white text-slate-900 select-none animate-in fade-in zoom-in-95 duration-150">
        {/* Top Official bKash Send Money Header */}
        <div className="bg-[#E2136E] text-white px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white text-[#E2136E] flex items-center justify-center font-black text-xs tracking-tight shadow-md shrink-0">
              bKash
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold tracking-tight leading-tight truncate">
                bKash Send Money (ম্যানুয়াল পেমেন্ট)
              </div>
              <div className="text-[10px] sm:text-[11px] text-pink-100 flex items-center gap-1 truncate">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">Personal bKash Send Money &amp; TrxID</span>
              </div>
            </div>
          </div>

          {step === 'form' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
              title="Close Window"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* FIELD 1: OWNER'S PERSONAL BKASH NUMBER (FIXED DISPLAY + COPY) & PLAN SELECTOR */}
        <div className="bg-slate-50 border-b border-slate-200 px-3.5 sm:px-5 py-3 sm:py-3.5 space-y-2.5">
          {/* Quick Plan Selector */}
          {step === 'form' && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                সাবস্ক্রিপশন প্ল্যান (Select Plan)
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PLAN_OPTIONS.map((p) => {
                  const active = p.id === currentPlan.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPlanOption(p.id, p.priceBDT)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                        active
                          ? 'bg-[#E2136E] text-white border-[#E2136E] font-bold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#E2136E]/50'
                      }`}
                    >
                      <div className="text-[10px] truncate">{p.name.split(' ')[0]}</div>
                      <div className="text-xs font-black font-mono">
                        ৳{p.priceBDT.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. AMAR PERSONAL BKASH NUMBER (FIXED DISPLAY) */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-pink-50 border-2 border-[#E2136E]/40 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-[#E2136E]">
                  ১. আমাদের পার্সোনাল বিকাশ নাম্বার (Send Money করুন)
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900 tracking-wide mt-0.5">
                  {liveReceiverNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyReceiverNumber}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#E2136E] hover:bg-[#c91060] text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
              >
                {copiedReceiver ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Number</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              আপনার বিকাশ অ্যাপ থেকে উপরের <strong>{liveReceiverNumber}</strong> পার্সোনাল নাম্বারে{' '}
              <strong className="text-[#E2136E]">৳{currentPlan.priceBDT.toLocaleString()}</strong>{' '}
              <strong>Send Money</strong> করুন। এরপর নিচের ফর্মে আপনার বিকাশ নাম্বার ও{' '}
              <strong>TrxID</strong> দিয়ে সাবমিট করুন।
            </p>
          </div>
        </div>

        {/* Main Pink Form Body */}
        <div className="bg-[#E2136E] text-white px-3.5 sm:px-5 py-3.5 sm:py-4 min-h-[250px] flex flex-col justify-center">
          {errorMsg && (
            <div className="mb-3 p-2.5 rounded-xl bg-red-950/80 border border-white/40 text-white text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'form' && (
            <form
              id="bkash-manual-form"
              onSubmit={handleManualPaymentSubmit}
              className="space-y-3"
            >
              {/* 2. GRAHOKER BKASH NUMBER (SENDER PHONE) */}
              <div>
                <label className="block text-xs font-bold text-pink-100 mb-1">
                  ২. গ্রাহকের বিকাশ নাম্বার (যে নাম্বার থেকে টাকা পাঠিয়েছেন) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    maxLength={11}
                    value={senderBkashNumber}
                    onChange={(e) => setSenderBkashNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="017XXXXXXXX (১১ ডিজিট)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-extrabold placeholder-slate-400 focus:outline-none shadow-inner"
                  />
                </div>
              </div>

              {/* 3. TRANSACTION ID (TrxID) INPUT FIELD */}
              <div>
                <label className="block text-xs font-bold text-pink-100 mb-1">
                  ৩. Transaction ID (TrxID - বিকাশ মেসেজের ট্রানজেকশন আইডি) *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={trxId}
                    onChange={(e) =>
                      setTrxId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    placeholder="যেমন: BKA83L92X1"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-extrabold uppercase tracking-wider placeholder-slate-400 focus:outline-none shadow-inner"
                  />
                </div>
              </div>

              {/* 4. AMOUNT INPUT FIELD */}
              <div>
                <label className="block text-xs font-bold text-pink-100 mb-1">
                  ৪. টাকার পরিমাণ (Amount in BDT) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">
                    ৳
                  </span>
                  <input
                    type="number"
                    required
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={String(currentPlan.priceBDT)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-[#E2136E] font-mono text-base font-black focus:outline-none shadow-inner"
                  />
                </div>
              </div>
            </form>
          )}

          {/* SUBMITTING STATE */}
          {step === 'submitting' && (
            <div className="py-6 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-white animate-spin mx-auto" />
              <div className="text-sm font-extrabold text-white">
                আপনার বিকাশ পেমেন্ট তথ্য (TrxID: {trxId}) জমা হচ্ছে...
              </div>
              <div className="text-xs text-pink-100">
                ডাটাবেস এবং এডমিন ড্যাশবোর্ডে সংরক্ষণ করা হচ্ছে
              </div>
            </div>
          )}

          {/* SUBMITTED STATE */}
          {step === 'submitted' && (
            <div className="py-5 text-center space-y-2.5 animate-in zoom-in-95">
              <CheckCircle2 className="w-12 h-12 text-white mx-auto" />
              <div className="text-base font-black text-white">
                পেমেন্ট তথ্য সফলভাবে জমা হয়েছে!
              </div>
              <div className="inline-block px-3 py-1 rounded-lg bg-white/20 text-xs font-mono text-white">
                Sender: {senderBkashNumber} &bull; TrxID: {trxId} &bull; ৳
                {Number(enteredAmount).toLocaleString()}
              </div>
              <div className="text-xs text-pink-100 block leading-relaxed">
                আপনার পেমেন্ট তথ্য এডমিনের ইমেইল ও ড্যাশবোর্ডে পাঠানো হয়েছে। এডমিন ভেরিফাই করলেই আপনার সার্ভিস অ্যাক্টিভ হয়ে যাবে।
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        {step === 'form' && (
          <div className="grid grid-cols-2 bg-slate-100 border-t border-slate-300 text-[11px] sm:text-xs font-extrabold uppercase tracking-tight sm:tracking-wider">
            <button
              type="button"
              onClick={onClose}
              className="py-3.5 px-2 text-slate-600 hover:bg-slate-200 border-r border-slate-300 transition cursor-pointer"
            >
              CANCEL (বন্ধ করুন)
            </button>
            <button
              type="submit"
              form="bkash-manual-form"
              disabled={isSubmitting}
              className="py-3.5 px-2 bg-white hover:bg-pink-50 text-[#E2136E] font-black flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>SUBMIT (জমা দিন)</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="bg-white py-2 px-4 text-center border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Phone className="w-3 h-3 text-[#E2136E]" />
          <span>Personal bKash (Send Money): {liveReceiverNumber}</span>
        </div>
      </div>
    </div>
  );
};
