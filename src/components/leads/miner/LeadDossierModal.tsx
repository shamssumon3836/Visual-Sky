import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  Globe, 
  Building, 
  MapPin, 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Tag, 
  MessageCircle, 
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Lead } from '../../../types';

interface LeadDossierModalProps {
  lead: Lead | null;
  onClose: () => void;
  onOpenSendMail?: (lead: Lead) => void;
  onSaveSingleLead?: (lead: Lead) => void;
  onOpenIcebreakerStudio?: (lead: Lead) => void;
  onVerifyLead?: (lead: Lead) => Promise<void>;
  isVerifying?: boolean;
}

export const LeadDossierModal: React.FC<LeadDossierModalProps> = ({
  lead,
  onClose,
  onOpenSendMail,
  onSaveSingleLead,
  onOpenIcebreakerStudio,
  onVerifyLead,
  isVerifying
}) => {
  if (!lead) return null;

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Clean phone number for WhatsApp
  const cleanPhoneForWa = lead.phone ? lead.phone.replace(/[^0-9]/g, '') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/30">
              {lead.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-100 text-lg">{lead.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {lead.leadScore}% Match Score
                </span>
                {lead.websiteStatus === 'alive' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-cyan-400 font-semibold">{lead.title} at {lead.company}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company & Location Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Company</span>
            <span className="font-bold text-slate-200 truncate block">{lead.company}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Location</span>
            <span className="font-bold text-slate-200 truncate block">{lead.location || 'United States'}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Company Size</span>
            <span className="font-bold text-slate-200 truncate block">{lead.companySize || '20-50 employees'}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Ping Latency</span>
            <span className="font-bold text-emerald-400 truncate block flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>{lead.responseTimeMs || 65}ms</span>
            </span>
          </div>
        </div>

        {/* Contact Intelligence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Verified Contact Channels</span>
            {onVerifyLead && (
              <button
                type="button"
                onClick={() => onVerifyLead(lead)}
                disabled={isVerifying}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
              >
                {isVerifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                <span>{isVerifying ? 'Checking...' : 'Run Live MX Ping'}</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {/* Email */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-slate-200 truncate">{lead.email}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(lead.email, 'email')}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-sans font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'email' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Phone & Direct Communication */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-emerald-400 font-semibold truncate">{lead.phone || 'Phone not available'}</span>
              </div>
              
              <div className="flex items-center gap-2 font-sans">
                {lead.phone && (
                  <>
                    {/* Call tel link */}
                    <a
                      href={`tel:${lead.phone}`}
                      className="px-2 py-0.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition"
                      title="Direct Phone Call"
                    >
                      <Phone className="w-2.5 h-2.5" />
                      <span>Call</span>
                    </a>

                    {/* WhatsApp link */}
                    {cleanPhoneForWa && (
                      <a
                        href={`https://wa.me/${cleanPhoneForWa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-green-950/60 hover:bg-green-900 border border-green-500/40 text-green-300 text-[10px] font-bold flex items-center gap-1 transition"
                        title="Open WhatsApp Chat"
                      >
                        <MessageCircle className="w-2.5 h-2.5" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopy(lead.phone, 'phone')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'phone' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Website */}
            {lead.website && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 truncate">
                  <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-300 truncate">{lead.website}</span>
                </div>
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-sans font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Visit Domain</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Social Profiles */}
        {lead.socials && Object.keys(lead.socials).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">Social Media Footprint</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(lead.socials).map(([platform, url]) => {
                if (!url) return null;
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 hover:text-cyan-300 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span className="capitalize">{platform}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Icebreaker */}
        {lead.icebreaker && (
          <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Personalized Cold Icebreaker</span>
              </span>

              <div className="flex items-center gap-2">
                {onOpenIcebreakerStudio && (
                  <button
                    type="button"
                    onClick={() => onOpenIcebreakerStudio(lead)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Customize Tone</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(lead.icebreaker, 'icebreaker')}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  {copiedField === 'icebreaker' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'icebreaker' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              "{lead.icebreaker}"
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
          {onOpenSendMail && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSendMail(lead);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Cold Email Now</span>
            </button>
          )}

          {onSaveSingleLead && (
            <button
              type="button"
              onClick={() => {
                onSaveSingleLead(lead);
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Save to Directory</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
