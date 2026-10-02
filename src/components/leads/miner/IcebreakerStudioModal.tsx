import React, { useState } from 'react';
import { X, Sparkles, RefreshCw, Copy, Check, Send, CheckCircle2 } from 'lucide-react';
import { Lead } from '../../../types';

interface IcebreakerStudioModalProps {
  lead: Lead | null;
  onClose: () => void;
  onApplyIcebreaker: (leadId: string, newIcebreaker: string) => void;
  onOpenSendMail?: (lead: Lead) => void;
}

export const ICEBREAKER_TONES = [
  { id: 'roi', label: 'Direct ROI & Value', icon: '⚡', desc: 'Punchy metrics, revenue growth & clear outcome pitch' },
  { id: 'compliment', label: 'Warm Recognition', icon: '🤝', desc: 'Congratulate recent milestone, product launch, or funding' },
  { id: 'painpoint', label: 'Pain Point & Solution', icon: '🎯', desc: 'Address outbound bottlenecks and provide easy solution' },
  { id: 'casual', label: 'Casual & Low Friction', icon: '☕', desc: 'Conversational, relaxed coffee-chat vibe without hard selling' },
  { id: 'bangla_english', label: 'Bangla-English Touch', icon: '🇧🇩', desc: 'Culturally attuned Bangla & English personalized opening' }
];

export const IcebreakerStudioModal: React.FC<IcebreakerStudioModalProps> = ({
  lead,
  onClose,
  onApplyIcebreaker,
  onOpenSendMail
}) => {
  if (!lead) return null;

  const [selectedTone, setSelectedTone] = useState<string>('roi');
  const [currentIcebreaker, setCurrentIcebreaker] = useState<string>(
    lead.icebreaker || `Noticed your rapid expansion in ${lead.niche} and impressive client acquisition metrics at ${lead.company}.`
  );
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentIcebreaker);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRegenerate = async (toneToUse?: string) => {
    const tone = toneToUse || selectedTone;
    setIsRegenerating(true);
    setApplied(false);

    try {
      const res = await fetch('/api/leads/icebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            name: lead.name,
            company: lead.company,
            title: lead.title,
            niche: lead.niche,
            website: lead.website,
            location: lead.location
          },
          tone
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.icebreaker) {
          setCurrentIcebreaker(data.icebreaker);
          setIsRegenerating(false);
          return;
        }
      }
    } catch {}

    // Dynamic smart fallback generator based on tone
    let fallbackText = '';
    const firstName = lead.name.split(' ')[0] || 'there';

    switch (tone) {
      case 'roi':
        fallbackText = `Hi ${firstName}, saw how quickly ${lead.company} is scaling in ${lead.niche}. We recently helped similar companies drive 3.2x higher cold pipeline response rates without burning domain reputation.`;
        break;
      case 'compliment':
        fallbackText = `Congratulations ${firstName} on the standout momentum with ${lead.company}! Your team's execution in the ${lead.niche} sector has been truly impressive to follow.`;
        break;
      case 'painpoint':
        fallbackText = `Most leaders in ${lead.niche} tell us manual prospecting and email deliverability eat up 15+ hours weekly. Noticed ${lead.company}'s active growth and wanted to share how we solve that.`;
        break;
      case 'casual':
        fallbackText = `Hey ${firstName} – loved coming across ${lead.company}'s latest updates. Quick question for you regarding how you currently handle outbound for ${lead.niche}?`;
        break;
      case 'bangla_english':
        fallbackText = `${firstName} bhai/apa, আশা করি ভালো আছেন! ${lead.company}-র রিসেন্ট গ্রোথ দেখে খুব ভালো লাগলো। আপনার সাথে একটি শর্ট আইডিয়া শেয়ার করার ইচ্ছে ছিল।`;
        break;
      default:
        fallbackText = `Noticed ${lead.company}'s strong positioning in ${lead.niche} and thought your team would appreciate a fresh perspective on high-deliverability outreach.`;
    }

    setTimeout(() => {
      setCurrentIcebreaker(fallbackText);
      setIsRegenerating(false);
    }, 300);
  };

  const handleApply = () => {
    onApplyIcebreaker(lead.id, currentIcebreaker);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-100 text-sm">AI Icebreaker Studio</h3>
              <p className="text-[11px] text-slate-400">Personalize outreach for <span className="text-cyan-300 font-bold">{lead.name}</span> ({lead.company})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tone Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">Select Pitch Tone:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ICEBREAKER_TONES.map((t) => {
              const isSelected = selectedTone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTone(t.id);
                    handleRegenerate(t.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-200 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-200">{t.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generated Icebreaker Output Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Tailored Opening Line:</span>
            <button
              type="button"
              onClick={() => handleRegenerate()}
              disabled={isRegenerating}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer text-[11px]"
            >
              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              value={currentIcebreaker}
              onChange={(e) => setCurrentIcebreaker(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed resize-none"
            />
            {isRegenerating && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-cyan-300 text-xs font-bold">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Crafting personalized icebreaker with Gemini...</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Line'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              {applied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{applied ? 'Saved to Lead!' : 'Apply to Lead'}</span>
            </button>

            {onOpenSendMail && (
              <button
                type="button"
                onClick={() => {
                  onApplyIcebreaker(lead.id, currentIcebreaker);
                  onClose();
                  onOpenSendMail({ ...lead, icebreaker: currentIcebreaker });
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Compose Mail</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
