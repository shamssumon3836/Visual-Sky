import React, { useState } from 'react';
import { X, Send, Plus, CheckCircle, Calendar, Users } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Lead } from '../../../types';
import confetti from 'canvas-confetti';

interface AddToCampaignModalProps {
  selectedLeads: Lead[];
  onClose: () => void;
}

export const AddToCampaignModal: React.FC<AddToCampaignModalProps> = ({ selectedLeads, onClose }) => {
  const { campaigns, updateCampaign, addNotification, setActiveTab } = useApp();
  const activeCampaigns = campaigns.filter(c => !c.isTrash);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(activeCampaigns[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmAddToCampaign = () => {
    if (!selectedCampaignId || selectedLeads.length === 0) return;
    setIsSubmitting(true);

    const targetCamp = activeCampaigns.find(c => c.id === selectedCampaignId);
    if (!targetCamp) return;

    // Convert leads to campaign recipient objects or IDs
    const existingIds = new Set((targetCamp.leadIds || []).map(String));
    const newLeadIds = selectedLeads.map(l => l.id).filter(id => !existingIds.has(id));
    const updatedLeadIds = [...(targetCamp.leadIds || []), ...newLeadIds];

    updateCampaign(targetCamp.id, {
      leadIds: updatedLeadIds,
      totalLeads: updatedLeadIds.length
    });

    addNotification({
      title: 'Campaign Enqueued 🚀',
      message: `Enqueued ${selectedLeads.length} leads into campaign "${targetCamp.name}".`,
      type: 'campaign'
    });

    confetti({ particleCount: 50, spread: 70 });
    onClose();
    setActiveTab('campaigns');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090d16] border border-blue-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-slate-100 text-base">Enqueue into Campaign</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Add <strong className="text-blue-300">{selectedLeads.length}</strong> selected mined leads directly into an active outbound campaign sequence:
        </p>

        {activeCampaigns.length > 0 ? (
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {activeCampaigns.map((camp) => {
              const isSelected = selectedCampaignId === camp.id;
              return (
                <label
                  key={camp.id}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/60 text-blue-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <div className="font-bold text-xs text-slate-100 truncate">{camp.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>Status: <strong className="capitalize text-emerald-400">{camp.status}</strong></span>
                      <span>&bull;</span>
                      <span>{camp.totalLeads || 0} existing leads</span>
                    </div>
                  </div>

                  <input
                    type="radio"
                    name="selectedCampaign"
                    checked={isSelected}
                    onChange={() => setSelectedCampaignId(camp.id)}
                    className="text-blue-500 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
            <div>No active campaigns found.</div>
            <button
              type="button"
              onClick={() => {
                onClose();
                setActiveTab('campaigns');
              }}
              className="text-blue-400 hover:underline font-bold"
            >
              Go to Campaign Manager to create one &rarr;
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedCampaignId || activeCampaigns.length === 0 || isSubmitting}
            onClick={handleConfirmAddToCampaign}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enqueue {selectedLeads.length} Leads</span>
          </button>
        </div>
      </div>
    </div>
  );
};
