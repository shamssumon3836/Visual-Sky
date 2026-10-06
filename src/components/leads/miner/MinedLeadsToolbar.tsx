import React from 'react';
import { 
  Search, 
  Download, 
  Copy, 
  Trash2, 
  Tag, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Phone, 
  Globe, 
  Flame, 
  ArrowUpDown, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export type LeadSortOption = 'score' | 'company' | 'speed' | 'newest';

interface MinedLeadsToolbarProps {
  totalCount: number;
  selectedCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  scoreFilter: 'all' | 'hot' | 'high';
  setScoreFilter: (f: 'all' | 'hot' | 'high') => void;
  contactFilter: 'all' | 'phone' | 'website';
  setContactFilter: (f: 'all' | 'phone' | 'website') => void;
  sortBy: LeadSortOption;
  setSortBy: (s: LeadSortOption) => void;
  viewMode: 'table' | 'cards';
  setViewMode: (v: 'table' | 'cards') => void;
  onOpenSaveModal: () => void;
  onOpenCampaignModal: () => void;
  onExportCsv: () => void;
  onCopyEmails: () => void;
  onDiscardSelected: () => void;
  onClearAll: () => void;
  onSelectAllVisible: (checked: boolean) => void;
  isAllVisibleSelected: boolean;
  onBulkVerifySelected?: () => void;
  isVerifying?: boolean;
  onPurgeDeadLeads?: () => void;
  deadCount?: number;
}

export const MinedLeadsToolbar: React.FC<MinedLeadsToolbarProps> = ({
  totalCount,
  selectedCount,
  searchQuery,
  setSearchQuery,
  scoreFilter,
  setScoreFilter,
  contactFilter,
  setContactFilter,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  onOpenSaveModal,
  onOpenCampaignModal,
  onExportCsv,
  onCopyEmails,
  onDiscardSelected,
  onClearAll,
  onSelectAllVisible,
  isAllVisibleSelected,
  onBulkVerifySelected,
  isVerifying,
  onPurgeDeadLeads,
  deadCount = 0
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3.5">
      {/* Top Row: Title, Counters, and Primary Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Mined Prospects ({totalCount})</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {selectedCount} Selected
          </span>

          <label className="flex items-center gap-1.5 ml-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllVisibleSelected}
              onChange={(e) => onSelectAllVisible(e.target.checked)}
              className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
            />
            <span>Select All</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCount > 0 && (
            <>
              {/* 1-Click Bulk Verification */}
              {onBulkVerifySelected && (
                <button
                  type="button"
                  onClick={onBulkVerifySelected}
                  disabled={isVerifying}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Ping domains and verify live mailboxes"
                >
                  {isVerifying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isVerifying ? 'Verifying...' : `Verify (${selectedCount})`}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenCampaignModal}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer"
                title="Add selected prospects to a campaign sequence"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Add to Campaign ({selectedCount})</span>
              </button>

              <button
                type="button"
                onClick={onOpenSaveModal}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                title="Save selected leads into Lead Directory"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Save ({selectedCount})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onExportCsv}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Download CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={onCopyEmails}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Copy emails to clipboard"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy Emails</span>
          </button>

          {onPurgeDeadLeads && deadCount > 0 && (
            <button
              type="button"
              onClick={onPurgeDeadLeads}
              className="px-2.5 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm animate-pulse"
              title="Remove leads with unreachable websites ('je website golote na jawa jai shegolor mail neya jabe na')"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Purge Dead Sites ({deadCount})</span>
            </button>
          )}

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onDiscardSelected}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Discard selected leads"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard ({selectedCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 transition cursor-pointer"
            title="Clear all leads"
          >
            Clear All
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-xl ml-auto sm:ml-0">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-slate-800 text-cyan-300 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-slate-800 text-cyan-300 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Middle Row: Quick Filter Chips (Pills) */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60 text-xs">
        <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Filters:</span>
        <button
          type="button"
          onClick={() => {
            setScoreFilter('all');
            setContactFilter('all');
          }}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
            scoreFilter === 'all' && contactFilter === 'all'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All ({totalCount})
        </button>

        <button
          type="button"
          onClick={() => setScoreFilter(scoreFilter === 'hot' ? 'all' : 'hot')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
            scoreFilter === 'hot'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-300'
          }`}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>Hot 95%+</span>
        </button>

        <button
          type="button"
          onClick={() => setContactFilter(contactFilter === 'phone' ? 'all' : 'phone')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
            contactFilter === 'phone'
              ? 'bg-emerald-500 text-black shadow-sm'
              : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-300'
          }`}
        >
          <Phone className="w-3 h-3 text-emerald-400" />
          <span>Direct Phones</span>
        </button>

        <button
          type="button"
          onClick={() => setContactFilter(contactFilter === 'website' ? 'all' : 'website')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
            contactFilter === 'website'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-blue-300'
          }`}
        >
          <Globe className="w-3 h-3 text-blue-400" />
          <span>Live Websites</span>
        </button>
      </div>

      {/* Bottom Row: Instant Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prospects by name, company, email, phone, location..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Sort By Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
          <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as LeadSortOption)}
            className="bg-transparent focus:outline-none text-slate-200 cursor-pointer font-medium"
          >
            <option value="score">Highest Match Score</option>
            <option value="company">Company Name (A-Z)</option>
            <option value="speed">Fastest Health Ping</option>
            <option value="newest">Recently Mined</option>
          </select>
        </div>
      </div>
    </div>
  );
};
