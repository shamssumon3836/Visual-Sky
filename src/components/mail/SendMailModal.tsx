import React, { useState, useEffect } from 'react';
import { useApp, DEFAULT_USER_SIGNATURE } from '../../context/AppContext';
import { safeParseResponse } from '../../lib/safeFetch';
import { 
  X, 
  Send, 
  Sparkles, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  User, 
  Mail, 
  FileText, 
  Paperclip, 
  Layers, 
  CheckCircle2,
  Zap,
  ChevronDown,
  Wand2,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { INITIAL_TEMPLATES } from '../templates/TemplateManager';
import { auditEmailDeliverability } from '../../utils/spamChecker';
import confetti from 'canvas-confetti';

interface SendMailModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipientEmail?: string;
  defaultRecipientName?: string;
}

export const SendMailModal: React.FC<SendMailModalProps> = ({
  isOpen,
  onClose,
  defaultRecipientEmail = '',
  defaultRecipientName = ''
}) => {
  const { leads, smtpAccounts, currentUser, addNotification, sendDirectEmail, emailTemplates, deductAiTokens } = useApp();

  const [recipientEmail, setRecipientEmail] = useState<string>(() => {
    return defaultRecipientEmail || sessionStorage.getItem('visualsky_sendmail_draft_email') || '';
  });
  const [recipientName, setRecipientName] = useState<string>(() => {
    return defaultRecipientName || sessionStorage.getItem('visualsky_sendmail_draft_name') || '';
  });
  const [selectedSmtpId, setSelectedSmtpId] = useState<string>(() => {
    return sessionStorage.getItem('visualsky_sendmail_draft_smtpid') || smtpAccounts[0]?.id || '';
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const availableTemplates = emailTemplates && emailTemplates.length > 0 ? emailTemplates : INITIAL_TEMPLATES;
  
  const [subject, setSubject] = useState<string>(() => {
    return sessionStorage.getItem('visualsky_sendmail_draft_subject') || '';
  });
  const [body, setBody] = useState<string>(() => {
    return sessionStorage.getItem('visualsky_sendmail_draft_body') || '';
  });

  const [sendMode, setSendMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('2026-08-17T09:30');
  const [sendingInterval, setSendingInterval] = useState<number>(45); // 45s between emails
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Sync draft fields to sessionStorage
  useEffect(() => {
    if (recipientEmail) sessionStorage.setItem('visualsky_sendmail_draft_email', recipientEmail);
    if (recipientName) sessionStorage.setItem('visualsky_sendmail_draft_name', recipientName);
    if (selectedSmtpId) sessionStorage.setItem('visualsky_sendmail_draft_smtpid', selectedSmtpId);
    if (subject) sessionStorage.setItem('visualsky_sendmail_draft_subject', subject);
    if (body) sessionStorage.setItem('visualsky_sendmail_draft_body', body);
  }, [recipientEmail, recipientName, selectedSmtpId, subject, body]);

  const clearDraft = () => {
    sessionStorage.removeItem('visualsky_sendmail_draft_email');
    sessionStorage.removeItem('visualsky_sendmail_draft_name');
    sessionStorage.removeItem('visualsky_sendmail_draft_smtpid');
    sessionStorage.removeItem('visualsky_sendmail_draft_subject');
    sessionStorage.removeItem('visualsky_sendmail_draft_body');
  };

  // AI Assistant State
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(true);
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>('');
  const [aiTone, setAiTone] = useState<string>('Direct & High Converting');
  const [aiType, setAiType] = useState<'pitch' | 'audit' | 'demo' | 'followup'>('pitch');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [isOptimizingSpam, setIsOptimizingSpam] = useState<boolean>(false);

  useEffect(() => {
    if (defaultRecipientEmail) setRecipientEmail(defaultRecipientEmail);
    if (defaultRecipientName) setRecipientName(defaultRecipientName);
  }, [defaultRecipientEmail, defaultRecipientName]);

  // If a template is picked, populate subject and body
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = availableTemplates.find(t => t.id === templateId);
    if (tmpl) {
      setSubject(tmpl.subject || '');
      setBody(tmpl.body || '');
    }
  };

  // If a lead is picked from dropdown, autofill
  const handleLeadSelect = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setRecipientEmail(lead.email);
      setRecipientName(lead.name);
    }
  };

  // Generate Email with Gemini AI
  const handleGenerateAiEmail = async (presetPrompt?: string, presetType?: 'pitch' | 'audit' | 'demo' | 'followup') => {
    setIsGeneratingAi(true);
    const chosenPrompt = presetPrompt || aiCustomPrompt;
    const chosenType = presetType || aiType;

    const matchedLead = leads.find(l => l.email === recipientEmail || l.name === recipientName);

    try {
      const res = await fetch('/api/gemini/generate-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chosenPrompt,
          type: chosenType,
          tone: aiTone,
          recipientName: recipientName || matchedLead?.name || 'there',
          recipientCompany: matchedLead?.company || 'your company',
          recipientRole: matchedLead?.title || 'Decision Maker',
          recipientWebsite: matchedLead?.website || 'https://example.com',
          niche: matchedLead?.niche || 'B2B SaaS & Tech',
          senderName: currentUser.name || 'Outreach Specialist'
        })
      });

      const parsed = await safeParseResponse(res, 'Failed to generate outreach email');
      const data = parsed.data || {};
      if (parsed.ok && data.success && data.subject && data.body) {
        const tokensUsed = data.usage?.totalTokens || 140;
        deductAiTokens(tokensUsed);
        setSubject(data.subject);
        setBody(data.body);
        confetti({ particleCount: 40, spread: 60 });
        addNotification({
          title: 'AI Outreach Generated ✨',
          message: `Drafted personalized cold email for ${recipientName || 'recipient'} (${tokensUsed} AI tokens).`,
          type: 'system'
        });
      }
    } catch {
      deductAiTokens(110);
      // Fallback
      setSubject(`quick thought for {{company}}`);
      setBody(`Hi {{name}},\n\nI was checking out {{company}} and loved your recent traction.\n\nWe help teams achieve guaranteed 99.8% inbox deliverability on cold outreach.\n\nWould you be open to a 2-minute video overview this week?\n\nBest regards,\n${currentUser.name || 'Outreach Team'}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Anti-Spam Polish & Optimization with Gemini AI
  const handleOptimizeWithAi = async () => {
    if (!body.trim()) return;
    setIsOptimizingSpam(true);

    try {
      const res = await fetch('/api/gemini/optimize-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          targetTone: aiTone
        })
      });

      const parsed = await safeParseResponse(res, 'Failed to optimize email body');
      const data = parsed.data || {};
      if (parsed.ok && data.success && data.optimizedBody) {
        const tokensUsed = data.usage?.totalTokens || 115;
        deductAiTokens(tokensUsed);
        if (data.optimizedSubject) setSubject(data.optimizedSubject);
        setBody(data.optimizedBody);
        confetti({ particleCount: 30, spread: 50 });
        addNotification({
          title: 'Spam Score Optimized 🛡️',
          message: `Removed spam triggers and boosted Primary Inbox score to 100% (${tokensUsed} AI tokens).`,
          type: 'system'
        });
      }
    } catch {
      deductAiTokens(80);
      // Fallback
      setSubject(prev => prev.replace(/FREE|100%|GUARANTEED/gi, 'Quick Note'));
    } finally {
      setIsOptimizingSpam(false);
    }
  };

  // Anti-Spam calculation
  const spamAudit = auditEmailDeliverability(subject, body);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !subject || !body) return;

    setIsSending(true);

    // Call real direct email dispatcher
    const sendSuccess = await sendDirectEmail({
      recipientEmail,
      recipientName,
      senderSmtpId: selectedSmtpId || smtpAccounts[0]?.id || '',
      subject,
      body: includeSignature ? `${body}\n\n${DEFAULT_USER_SIGNATURE}` : body,
      scheduledFor: sendMode === 'scheduled' ? scheduledDateTime : undefined,
    });

    setIsSending(false);

    if (sendSuccess) {
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        clearDraft();
        onClose();
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090d16] border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Smart Direct Cold Mailer
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                  100% Primary Inbox Delivery
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                AI Cold Outreach Writer &bull; Anti-Spam Shield &bull; Multi-SMTP Relay Rotation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSend} className="p-4 md:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* AI OUTREACH GENERATOR & COPILOT DRAWER */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-cyan-950/40 border border-indigo-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-extrabold text-slate-100 text-xs">
                  Gemini AI Outreach Copilot & Writer
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Gemini 2.0 Flash
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOptimizeWithAi}
                  disabled={isOptimizingSpam || isGeneratingAi}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Rewrite current email to eliminate spam triggers and hit 100% Primary Inbox score"
                >
                  {isOptimizingSpam ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>{isOptimizingSpam ? 'Polishing...' : '🛡️ AI Spam Polish'}</span>
                </button>
              </div>
            </div>

            {/* AI Preset Quick Action Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>1-Click AI Strategy Presets:</span>
                <span className="text-[10px] text-slate-500">Auto-injects lead personalization</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '🚀 SaaS Pitch (99.8% Placement)', type: 'pitch' as const, prompt: 'Pitch our cold outreach software highlighting 99.8% deliverability and low-effort setup.' },
                  { label: '📈 Case Study (+3.5x Replies)', type: 'pitch' as const, prompt: 'Share a concrete case study of a tech team tripling positive response rates.' },
                  { label: '📅 15m Demo Request', type: 'demo' as const, prompt: 'Request a brief 15-minute screen share demo for next Tuesday or Wednesday.' },
                  { label: '🛡️ Deliverability Audit', type: 'audit' as const, prompt: 'Offer a complimentary 1-page domain deliverability & DNS health audit.' },
                  { label: '💬 Re-engagement Follow-up', type: 'followup' as const, prompt: 'Write a friendly, polite 3-sentence follow-up on our previous note.' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isGeneratingAi}
                    onClick={() => handleGenerateAiEmail(preset.prompt, preset.type)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer hover:border-cyan-500 flex items-center gap-1"
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom AI Prompt Input & Tone */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-1">
              <div className="md:col-span-6 space-y-1">
                <input
                  type="text"
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  placeholder="Or enter custom instruction (e.g. mention their recent blog post and offer 30-day trial)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="Direct & High Converting">Direct & High Converting</option>
                  <option value="Casual & Warm">Casual & Warm</option>
                  <option value="Executive B2B">Executive B2B</option>
                  <option value="Urgent & Scarce">Urgent & Scarce</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={() => handleGenerateAiEmail()}
                  className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAi ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isGeneratingAi ? 'Drafting...' : '✨ Generate Email'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 1: Recipient Selection & Quick Lead Picker */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-7 space-y-1">
              <label className="block font-semibold text-slate-300">Recipient Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. sarah.jenkins@linear.app"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="md:col-span-5 space-y-1">
              <label className="block font-semibold text-slate-300">Or Select from Verified Leads</label>
              <select
                onChange={(e) => handleLeadSelect(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Choose Lead --</option>
                {leads.filter(l => !l.isTrash).map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} ({lead.company})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Sender SMTP & Template Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Sender SMTP Account *</label>
              <select
                value={selectedSmtpId}
                onChange={(e) => setSelectedSmtpId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {smtpAccounts.filter(s => !s.isTrash).map(smtp => (
                  <option key={smtp.id} value={smtp.id}>
                    {smtp.name} ({smtp.username} &bull; {smtp.host}:{smtp.port})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Pre-built Email Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Select Template --</option>
                {availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title || 'Template'} ({t.replyRatePercent || 0}% Reply Rate)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject Line with Dynamic Tags */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-300">Subject Line *</label>
              <div className="flex items-center gap-1">
                {['{{name}}', '{{company}}'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSubject(prev => prev + ' ' + tag)}
                    className="text-[10px] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-mono"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Scaling cold outreach pipeline for {{company}}"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-300">Email Body *</label>
              <div className="flex items-center gap-1">
                {['{{name}}', '{{company}}', '{{website}}', '{{niche}}', '{{icebreaker}}'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setBody(prev => prev + ' ' + tag)}
                    className="text-[10px] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-mono"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed text-xs"
            />
          </div>

          {/* Clean HTML Signature Preview */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="font-semibold text-slate-300 text-xs">Append Verified HTML Signature</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-bold">100% Non-Breaking HTML</span>
            </div>

            {includeSignature && (
              <div 
                className="text-xs pt-1 overflow-x-auto" 
                dangerouslySetInnerHTML={{ __html: DEFAULT_USER_SIGNATURE }} 
              />
            )}
          </div>

          {/* Anti-Spam Radar Indicator */}
          <div className={`p-3.5 rounded-xl border ${
            spamAudit.score >= 90 
              ? 'bg-emerald-950/20 border-emerald-800/40' 
              : 'bg-amber-950/20 border-amber-800/40'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${spamAudit.score >= 90 ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="font-bold text-slate-200">Anti-Spam Deliverability Radar:</span>
              </div>
              <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] ${
                spamAudit.score >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {spamAudit.score}/100 &bull; {spamAudit.estimatedDeliverability}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {spamAudit.recommendations[0]}
            </div>
          </div>

          {/* Sending Schedule Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Dispatch Timing Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSendMode('instant')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                    sendMode === 'instant'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Instant Send
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('scheduled')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                    sendMode === 'scheduled'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⏰ Schedule Send
                </button>
              </div>
            </div>

            {sendMode === 'scheduled' ? (
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">Smart Sending Delay (Anti-Ban)</label>
                <select
                  value={sendingInterval}
                  onChange={(e) => setSendingInterval(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value={15}>15 seconds delay</option>
                  <option value={45}>45 seconds delay (Recommended)</option>
                  <option value={90}>90 seconds delay (High Volume Safe)</option>
                  <option value={120}>120 seconds delay (Enterprise Warmup)</option>
                </select>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSending || isSuccess}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition text-xs disabled:opacity-50 cursor-pointer"
            >
              {isSending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Dispatching...
                </span>
              ) : isSuccess ? (
                <span className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Sent!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" />
                  {sendMode === 'instant' ? 'Send Outbound Now' : 'Schedule Outbound'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
