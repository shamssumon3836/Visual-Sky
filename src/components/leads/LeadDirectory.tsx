import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Lead, LeadTag } from '../../types';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Phone, 
  Mail, 
  Columns, 
  Download, 
  Upload,
  Send, 
  RefreshCw, 
  Edit3, 
  Sparkles, 
  Tag as TagIcon,
  Building, 
  X, 
  Check, 
  CheckSquare, 
  Eye, 
  MessageSquare,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LeadDirectoryProps {
  onOpenSendMail?: (lead?: Lead) => void;
}

export const LeadDirectory: React.FC<LeadDirectoryProps> = ({ onOpenSendMail }) => {
  const { 
    leads, 
    leadTags,
    addLeadTag,
    deleteLeadTag,
    columnSettings, 
    toggleColumnSetting, 
    deleteLeadToTrash,
    bulkDeleteLeads, 
    updateLead, 
    addLeads,
    verifyLeadWebsite,
    launchQuickFollowUp,
    searchQuery,
    setSearchQuery,
    addNotification
  } = useApp();

  // Active Filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'replied' | 'opened' | 'inactive_7d' | 'inactive_14d' | 'inactive_30d' | 'new'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showColumnModal, setShowColumnModal] = useState<boolean>(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  
  // Tag Management Modal State
  const [showTagModal, setShowTagModal] = useState<boolean>(false);
  const [newTagName, setNewTagName] = useState<string>('');
  const [newTagColor, setNewTagColor] = useState<LeadTag['color']>('cyan');
  const [newTagDesc, setNewTagDesc] = useState<string>('');
  const [bulkTagDropdownOpen, setBulkTagDropdownOpen] = useState<boolean>(false);

  // Custom Manual Add Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newLeadData, setNewLeadData] = useState<Partial<Lead>>(() => {
    try {
      const saved = sessionStorage.getItem('visualsky_lead_draft');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: '',
      title: 'Founder & CEO',
      company: '',
      email: '',
      phone: '',
      website: '',
      niche: 'B2B SaaS & Tech',
      location: 'United States',
      status: 'new',
      icebreaker: '',
      tags: leadTags[0]?.name ? [leadTags[0].name] : []
    };
  });

  useEffect(() => {
    if (newLeadData && (newLeadData.name || newLeadData.email || newLeadData.company)) {
      sessionStorage.setItem('visualsky_lead_draft', JSON.stringify(newLeadData));
    }
  }, [newLeadData]);

  // File Upload Modal
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadSelectedTag, setUploadSelectedTag] = useState<string>(() => leadTags[0]?.name || 'Imported Leads');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [parsedLeadsPreview, setParsedLeadsPreview] = useState<Partial<Lead>[]>([]);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync default tag if tags array updates
  useEffect(() => {
    if ((!uploadSelectedTag || uploadSelectedTag === 'Imported Leads') && leadTags.length > 0) {
      setUploadSelectedTag(leadTags[0].name);
    }
  }, [leadTags]);

  // Active Leads
  const activeLeads = useMemo(() => {
    return leads.filter(l => !l.isTrash);
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return activeLeads.filter(lead => {
      if (!lead) return false;
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || (
        (lead.name || '').toLowerCase().includes(query) ||
        (lead.company || '').toLowerCase().includes(query) ||
        (lead.email || '').toLowerCase().includes(query) ||
        (lead.phone || '').toLowerCase().includes(query) ||
        (lead.niche || '').toLowerCase().includes(query) ||
        (lead.location || '').toLowerCase().includes(query) ||
        (lead.title || '').toLowerCase().includes(query) ||
        (lead.tags && lead.tags.some(t => (t || '').toLowerCase().includes(query)))
      );

      if (!matchesSearch) return false;

      // Tag Filter
      if (selectedTagFilter !== 'all') {
        if (!lead.tags || !lead.tags.includes(selectedTagFilter)) return false;
      }

      // Status/Cohort Filter
      if (activeFilter === 'replied') return lead.status === 'replied' || lead.isReplied;
      if (activeFilter === 'opened') return lead.status === 'opened' || (lead.openCount && lead.openCount > 0);
      if (activeFilter === 'new') return lead.status === 'new';
      if (activeFilter === 'inactive_7d') return lead.daysAgo >= 7 && lead.daysAgo < 14;
      if (activeFilter === 'inactive_14d') return lead.daysAgo >= 14 && lead.daysAgo < 30;
      if (activeFilter === 'inactive_30d') return lead.daysAgo >= 30;

      return true;
    });
  }, [activeLeads, searchQuery, selectedTagFilter, activeFilter]);

  // Tag color mapping helper
  const getTagColorClass = (tagName: string) => {
    const foundTag = leadTags.find(t => t.name === tagName);
    const color = foundTag?.color || 'cyan';
    switch (color) {
      case 'cyan': return 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40';
      case 'emerald': return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
      case 'purple': return 'bg-purple-950/70 text-purple-300 border-purple-500/40';
      case 'blue': return 'bg-blue-950/70 text-blue-300 border-blue-500/40';
      case 'amber': return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
      case 'rose': return 'bg-rose-950/70 text-rose-300 border-rose-500/40';
      case 'indigo': return 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(prev => [...prev, id]);
    } else {
      setSelectedLeadIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkAssignTag = (tagName: string) => {
    if (selectedLeadIds.length === 0) return;
    selectedLeadIds.forEach(id => {
      const lead = leads.find(l => l.id === id);
      if (lead && !lead.tags.includes(tagName)) {
        updateLead(id, { tags: [...lead.tags, tagName] });
      }
    });
    setBulkTagDropdownOpen(false);
    addNotification({
      title: 'Tags Assigned',
      message: `Tag "${tagName}" assigned to ${selectedLeadIds.length} leads.`,
      type: 'system'
    });
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleCreateNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    addLeadTag({
      name: newTagName.trim(),
      color: newTagColor,
      description: newTagDesc.trim() || undefined
    });

    setNewTagName('');
    setNewTagDesc('');
    addNotification({
      title: 'Tag Created',
      message: `New tag "${newTagName.trim()}" created successfully.`,
      type: 'system'
    });
  };

  const handleAddNewLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadData.name || !newLeadData.email) return;

    addLeads([{
      ...newLeadData,
      status: 'new',
      websiteStatus: 'alive',
      leadScore: 94,
      responseTimeMs: 80,
    }], newLeadData.tags?.[0]);

    setShowAddModal(false);
    sessionStorage.removeItem('visualsky_lead_draft');
    setNewLeadData({
      name: '',
      title: 'Founder & CEO',
      company: '',
      email: '',
      phone: '',
      website: '',
      niche: 'B2B SaaS & Tech',
      location: 'United States',
      status: 'new',
      icebreaker: '',
      tags: [leadTags[0]?.name || 'SaaS Decision Makers']
    });
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      'Lead ID,Name,Title,Company,Email,Phone,Website,Niche,Location,Lead Score,Tags,Open Count,Replied,Status'
    ];

    const rows = filteredLeads.map(l => [
      `"${l.id || ''}"`,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${l.email || ''}"`,
      `"${l.phone || ''}"`,
      `"${l.website || ''}"`,
      `"${l.niche || ''}"`,
      `"${l.location || ''}"`,
      l.leadScore || 0,
      `"${(l.tags || []).join('; ')}"`,
      l.openCount || 0,
      l.isReplied || l.status === 'replied' ? 'YES' : 'NO',
      `"${l.status || 'new'}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `visualsky_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    confetti({ particleCount: 40, spread: 60 });
  };

  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Robust File Parsing (CSV, TXT, TSV, JSON)
  const processUploadedFile = (file: File) => {
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const parsed: Partial<Lead>[] = [];

        // Check if JSON file
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          const list = Array.isArray(json) ? json : (json.leads || []);
          for (const item of list) {
            if (item.email || item.name) {
              parsed.push({
                name: item.name || 'Prospective Lead',
                email: item.email || `lead${parsed.length + 1}@company.com`,
                company: item.company || 'Enterprise Corp',
                title: item.title || 'Decision Maker',
                phone: item.phone || '+1 (555) 000-0000',
                website: item.website || 'https://example.com',
                niche: item.niche || 'Imported Target',
                location: item.location || 'United States',
                tags: [uploadSelectedTag || 'Imported Leads']
              });
            }
          }
          if (parsed.length > 0) {
            setParsedLeadsPreview(parsed);
            setShowUploadModal(true);
            return;
          }
        }

        // CSV / TSV / TXT Parsing
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          setUploadError('File is empty. Please select a valid CSV or TXT file.');
          return;
        }

        // Detect delimiter (comma, semicolon, tab)
        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');

        // Check if file has a header row
        const lowerFirst = firstLine.toLowerCase();
        const hasHeader = lowerFirst.includes('email') || lowerFirst.includes('name') || lowerFirst.includes('company') || lowerFirst.includes('mail');

        let nameIdx = -1, emailIdx = -1, compIdx = -1, titleIdx = -1, phoneIdx = -1, webIdx = -1;
        let startIndex = 0;

        if (hasHeader) {
          startIndex = 1;
          const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
          nameIdx = headers.findIndex(h => h.includes('name') || h.includes('contact') || h.includes('person'));
          emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
          compIdx = headers.findIndex(h => h.includes('company') || h.includes('business') || h.includes('org') || h.includes('account'));
          titleIdx = headers.findIndex(h => h.includes('title') || h.includes('role') || h.includes('position') || h.includes('job'));
          phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel') || h.includes('cell'));
          webIdx = headers.findIndex(h => h.includes('website') || h.includes('url') || h.includes('domain') || h.includes('site'));
        }

        for (let i = startIndex; i < lines.length; i++) {
          const rawLine = lines[i];
          const cols = rawLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
          
          let email = '';
          let name = '';
          let company = '';
          let title = 'Decision Maker';
          let phone = '+1 (555) 019-2834';
          let website = 'https://example.com';

          if (hasHeader) {
            email = emailIdx !== -1 ? cols[emailIdx] : '';
            name = nameIdx !== -1 ? cols[nameIdx] : '';
            company = compIdx !== -1 ? cols[compIdx] : '';
            if (titleIdx !== -1 && cols[titleIdx]) title = cols[titleIdx];
            if (phoneIdx !== -1 && cols[phoneIdx]) phone = cols[phoneIdx];
            if (webIdx !== -1 && cols[webIdx]) website = cols[webIdx];
          } else {
            // Find email in cols
            const foundEmail = cols.find(c => c.includes('@') && c.includes('.'));
            if (foundEmail) {
              email = foundEmail;
              const nonEmailCols = cols.filter(c => c !== foundEmail);
              if (nonEmailCols.length > 0) name = nonEmailCols[0];
              if (nonEmailCols.length > 1) company = nonEmailCols[1];
            } else if (cols.length >= 2) {
              name = cols[0];
              email = cols[1];
              company = cols[2] || '';
            } else if (cols.length === 1 && cols[0].includes('@')) {
              email = cols[0];
              name = email.split('@')[0].replace(/[._-]/g, ' ');
            }
          }

          if (!email && cols[0] && cols[0].includes('@')) {
            email = cols[0];
          }

          if (email || name) {
            parsed.push({
              name: name || (email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'Prospective Lead'),
              email: email || `contact${parsed.length + 1}@leadtarget.io`,
              company: company || 'Enterprise Partner',
              title: title || 'Executive Decision Maker',
              phone: phone || '+1 (555) 019-2834',
              website: website || 'https://example.com',
              niche: 'Imported CSV Target',
              location: 'United States',
              tags: [uploadSelectedTag || 'Imported Leads']
            });
          }
        }

        if (parsed.length === 0) {
          setUploadError('No valid contacts or email rows found in the uploaded file.');
          return;
        }

        setParsedLeadsPreview(parsed);
        setShowUploadModal(true);
      } catch (err: any) {
        setUploadError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // CSV File Input Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processUploadedFile(file);
    }
  };

  const handleConfirmUpload = () => {
    if (parsedLeadsPreview.length === 0) return;
    const tagToAssign = uploadSelectedTag || leadTags[0]?.name || 'Imported Leads';
    const leadsWithTag = parsedLeadsPreview.map(lead => ({
      ...lead,
      tags: [tagToAssign]
    }));
    addLeads(leadsWithTag, tagToAssign);
    setShowUploadModal(false);
    setParsedLeadsPreview([]);
    setUploadedFileName('');
    confetti({ particleCount: 60, spread: 70 });
  };

  // Helper check for column visibility
  const isColVisible = (colId: string) => {
    const found = columnSettings.find(c => c.id === colId);
    return found ? found.visible : true;
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 relative"
    >
      {/* Global Drag & Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-cyan-950/85 backdrop-blur-sm border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center p-6 pointer-events-none animate-in fade-in">
          <Upload className="w-16 h-16 text-cyan-300 animate-bounce mb-3" />
          <h2 className="text-2xl font-black text-white">Drop Lead File Anywhere to Import</h2>
          <p className="text-sm text-cyan-200 mt-1">Supports CSV, TXT, TSV & JSON lead lists</p>
        </div>
      )}

      {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 flex items-center gap-3">
              <Users className="w-8 h-8 text-cyan-400" />
              Lead Directory & Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Verified decision makers with single-line precision, live site health pings, tag groups, and direct outreach actions.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setShowTagModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <TagIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manage Tags ({leadTags.length})</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upload CSV</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:via-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* 1-Click Automated Dormant Re-engagement Bar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                1-Click Dormant Follow-Up Sequences
                <span className="px-2 py-0.2 text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded uppercase">
                  Automated Trigger
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Instantly trigger targeted re-engagement sequences for non-responsive leads based on inactive days.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => launchQuickFollowUp('7d')}
              className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <span>⚡ 7-Day Follow-Up</span>
            </button>
            <button
              onClick={() => launchQuickFollowUp('14d')}
              className="px-3 py-1.5 rounded-lg bg-orange-950/40 hover:bg-orange-900/60 border border-orange-500/30 text-orange-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <span>⚡ 14-Day Value Add</span>
            </button>
            <button
              onClick={() => launchQuickFollowUp('30d')}
              className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <span>⚡ 30-Day Breakup</span>
            </button>
          </div>
        </div>

        {/* Tag Filter Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <TagIcon className="w-3 h-3 text-cyan-400" /> Filter by Tag:
          </span>
          <button
            onClick={() => setSelectedTagFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              selectedTagFilter === 'all'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Tags ({activeLeads.length})
          </button>
          {leadTags.map(tag => {
            const count = activeLeads.filter(l => l.tags.includes(tag.name)).length;
            const isSelected = selectedTagFilter === tag.name;
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedTagFilter(tag.name)}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{tag.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Cohort Filter Bar with Columns Button */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, email, phone, title, location, or tags..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'all', label: 'All Statuses' },
              { id: 'opened', label: '👁️ Opened' },
              { id: 'replied', label: '💬 Replied' },
              { id: 'new', label: '✨ New' },
              { id: 'inactive_7d', label: '⏳ Inactive 7d+' },
              { id: 'inactive_14d', label: '⏳ Inactive 14d+' },
              { id: 'inactive_30d', label: '⏳ Inactive 30d+' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Column Selector Toggle - Elevated and Fixed */}
            <button
              onClick={() => setShowColumnModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap"
            >
              <Columns className="w-3.5 h-3.5 text-cyan-400" />
              <span>Customize Columns</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (When rows selected) */}
        {selectedLeadIds.length > 0 && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <CheckSquare className="w-4 h-4 text-cyan-400" />
              <span>{selectedLeadIds.length} leads selected</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Bulk Tag Assignment */}
              <div className="relative">
                <button
                  onClick={() => setBulkTagDropdownOpen(!bulkTagDropdownOpen)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <TagIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Assign Tag</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {bulkTagDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-[#090d16] border border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1">
                    {leadTags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleBulkAssignTag(t.name)}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-900 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <div className={`w-2 h-2 rounded-full ${getTagColorClass(t.name).split(' ')[0]}`} />
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => bulkDeleteLeads(selectedLeadIds)}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>

              <button
                onClick={() => setSelectedLeadIds([])}
                className="text-xs text-slate-400 hover:text-white px-2 cursor-pointer"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* Leads Table - STRICT SINGLE-LINE RESPONSIVE FORMAT */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-base font-bold text-slate-300">No leads found matching current criteria</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try clearing your search or mining fresh leads with the AI Lead Miner.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] font-extrabold whitespace-nowrap">
                    <th className="p-3.5 w-10 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                    </th>
                    {isColVisible('name') && <th className="p-3.5 min-w-[200px]">Lead & Title</th>}
                    {isColVisible('company') && <th className="p-3.5 min-w-[180px]">Company & Website</th>}
                    {isColVisible('email') && <th className="p-3.5 min-w-[180px]">Email Address</th>}
                    {isColVisible('phone') && <th className="p-3.5 min-w-[140px]">Phone Number</th>}
                    {isColVisible('openStatus') && <th className="p-3.5 min-w-[90px]">Opened</th>}
                    {isColVisible('replyStatus') && <th className="p-3.5 min-w-[100px]">Replied</th>}
                    {isColVisible('tags') && <th className="p-3.5 min-w-[150px]">Tags</th>}
                    {isColVisible('status') && <th className="p-3.5 min-w-[100px]">Status</th>}
                    {isColVisible('websiteStatus') && <th className="p-3.5 min-w-[110px]">Site Health</th>}
                    {isColVisible('score') && <th className="p-3.5 min-w-[70px]">Score</th>}
                    {isColVisible('daysAgo') && <th className="p-3.5 min-w-[90px]">Inactive</th>}
                    {isColVisible('actions') && <th className="p-3.5 min-w-[110px] text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);

                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-slate-800/40 transition group whitespace-nowrap ${
                          isSelected ? 'bg-cyan-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                          />
                        </td>

                        {/* Name & Title - Strictly Single Line */}
                        {isColVisible('name') && (
                          <td className="p-3.5">
                            <div className="flex items-center gap-2 max-w-[240px] truncate">
                              <span className="font-bold text-slate-100 truncate">{lead.name}</span>
                              <span className="text-slate-500">&bull;</span>
                              <span className="text-[11px] text-cyan-400 font-medium truncate">{lead.title}</span>
                            </div>
                          </td>
                        )}

                        {/* Company & Domain - Strictly Single Line */}
                        {isColVisible('company') && (
                          <td className="p-3.5">
                            <div className="flex items-center gap-2 max-w-[220px] truncate">
                              <div className="font-semibold text-slate-200 flex items-center gap-1 truncate">
                                <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">{lead.company}</span>
                              </div>
                              {lead.website && (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-slate-400 hover:text-cyan-300 font-mono flex items-center gap-0.5 shrink-0"
                                  title={lead.website}
                                >
                                  <span>{lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 16)}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Email - Strictly Single Line */}
                        {isColVisible('email') && (
                          <td className="p-3.5">
                            <div className="font-mono text-slate-200 text-[11px] flex items-center gap-1.5 max-w-[200px] truncate">
                              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate" title={lead.email}>{lead.email}</span>
                            </div>
                          </td>
                        )}

                        {/* Phone - Strictly Single Line (No 2nd line wrapping) */}
                        {isColVisible('phone') && (
                          <td className="p-3.5">
                            <div className="font-mono text-emerald-400 font-medium text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{lead.phone || '+1 (555) 000-0000'}</span>
                            </div>
                          </td>
                        )}

                        {/* Open Status Column */}
                        {isColVisible('openStatus') && (
                          <td className="p-3.5">
                            {lead.openCount && lead.openCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit whitespace-nowrap">
                                <Eye className="w-3 h-3 text-blue-400" />
                                {lead.openCount} {lead.openCount === 1 ? 'open' : 'opens'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">0 opens</span>
                            )}
                          </td>
                        )}

                        {/* Reply Status Column */}
                        {isColVisible('replyStatus') && (
                          <td className="p-3.5">
                            {lead.isReplied || lead.status === 'replied' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit whitespace-nowrap">
                                <MessageSquare className="w-3 h-3 text-emerald-400" />
                                Replied 🔥
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">Awaiting</span>
                            )}
                          </td>
                        )}

                        {/* Tags Column - Clean Single Line */}
                        {isColVisible('tags') && (
                          <td className="p-3.5">
                            <div className="flex items-center gap-1 max-w-[190px] overflow-hidden whitespace-nowrap">
                              {lead.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase whitespace-nowrap ${getTagColorClass(tag)}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                        )}

                        {/* Pipeline Status */}
                        {isColVisible('status') && (
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border whitespace-nowrap ${
                              lead.status === 'replied'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : lead.status === 'opened'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : lead.status === 'contacted'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              {lead.status}
                            </span>
                          </td>
                        )}

                        {/* Site Health Ping */}
                        {isColVisible('websiteStatus') && (
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${
                                lead.websiteStatus === 'alive' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`} />
                              <span className="text-[11px] font-mono text-slate-300">
                                {lead.responseTimeMs || 85}ms
                              </span>
                              <button
                                onClick={() => verifyLeadWebsite(lead.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-cyan-300 transition cursor-pointer"
                                title="Re-ping domain health"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>
                        )}

                        {/* Score */}
                        {isColVisible('score') && (
                          <td className="p-3.5 font-extrabold text-cyan-300 whitespace-nowrap">
                            {lead.leadScore}%
                          </td>
                        )}

                        {/* Inactive Days */}
                        {isColVisible('daysAgo') && (
                          <td className="p-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                            {lead.daysAgo === 0 ? 'Today' : `${lead.daysAgo}d ago`}
                          </td>
                        )}

                        {/* Actions */}
                        {isColVisible('actions') && (
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {onOpenSendMail && (
                                <button
                                  onClick={() => onOpenSendMail(lead)}
                                  className="px-2 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                  title="Send Direct Email"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Send</span>
                                </button>
                              )}

                              <button
                                onClick={() => setEditingLead(lead)}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                title="Edit Lead"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>

                              <button
                                onClick={() => setLeadToDelete(lead)}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 border border-transparent transition cursor-pointer"
                                title="Move Lead to Trash"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* CUSTOMIZE COLUMNS MODAL (Clean, Visible, Never Hidden) */}
      {showColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Columns className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Customize Table Columns</h3>
              </div>
              <button 
                onClick={() => setShowColumnModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Toggle which data fields and analytics columns are visible in your lead pipeline table.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {columnSettings.map((col) => (
                <label 
                  key={col.id} 
                  className="flex items-center justify-between pt-2 text-xs text-slate-200 hover:bg-slate-900/60 p-2 rounded-xl cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium">{col.label}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumnSetting(col.id)}
                    className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {columnSettings.filter(c => c.visible).length} of {columnSettings.length} columns active
              </span>
              <button
                onClick={() => setShowColumnModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE TAGS MODAL */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Manage Lead Tags & Cohorts</h3>
              </div>
              <button 
                onClick={() => setShowTagModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create New Tag Form */}
            <form onSubmit={handleCreateNewTag} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-slate-200">Create New Tag</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag Name (e.g. VIP SaaS)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <select
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="cyan">Cyan (Tech / SaaS)</option>
                  <option value="emerald">Emerald (Verified / High Score)</option>
                  <option value="purple">Purple (Enterprise)</option>
                  <option value="blue">Blue (Outreach)</option>
                  <option value="amber">Amber (Follow-Up)</option>
                  <option value="rose">Rose (Urgent / VIP)</option>
                  <option value="indigo">Indigo (Agencies)</option>
                </select>
              </div>

              <input
                type="text"
                value={newTagDesc}
                onChange={(e) => setNewTagDesc(e.target.value)}
                placeholder="Description (Optional)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />

              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tag to Pipeline</span>
              </button>
            </form>

            {/* List of Existing Tags */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-400">Existing Tags ({leadTags.length})</div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {leadTags.map(tag => {
                  const count = activeLeads.filter(l => l.tags.includes(tag.name)).length;
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getTagColorClass(tag.name)}`}>
                          {tag.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">({count} leads)</span>
                      </div>

                      <button
                        onClick={() => deleteLeadTag(tag.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                        title="Delete Tag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ADD LEAD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Add New Lead</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewLead} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newLeadData.name}
                    onChange={(e) => setNewLeadData({ ...newLeadData, name: e.target.value })}
                    placeholder="e.g. Alex Mercer"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newLeadData.title}
                    onChange={(e) => setNewLeadData({ ...newLeadData, title: e.target.value })}
                    placeholder="e.g. Founder & CEO"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Company Name</label>
                  <input
                    type="text"
                    value={newLeadData.company}
                    onChange={(e) => setNewLeadData({ ...newLeadData, company: e.target.value })}
                    placeholder="e.g. Linear Labs"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Website URL</label>
                  <input
                    type="text"
                    value={newLeadData.website}
                    onChange={(e) => setNewLeadData({ ...newLeadData, website: e.target.value })}
                    placeholder="https://linear.app"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Business Email *</label>
                  <input
                    type="email"
                    required
                    value={newLeadData.email}
                    onChange={(e) => setNewLeadData({ ...newLeadData, email: e.target.value })}
                    placeholder="alex@linear.app"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Direct Phone</label>
                  <input
                    type="text"
                    value={newLeadData.phone}
                    onChange={(e) => setNewLeadData({ ...newLeadData, phone: e.target.value })}
                    placeholder="+1 (415) 890-4123"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Target Tag</label>
                  <select
                    value={newLeadData.tags?.[0]}
                    onChange={(e) => setNewLeadData({ ...newLeadData, tags: [e.target.value] })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {leadTags.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Location</label>
                  <input
                    type="text"
                    value={newLeadData.location}
                    onChange={(e) => setNewLeadData({ ...newLeadData, location: e.target.value })}
                    placeholder="San Francisco, CA"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-base">Upload Leads CSV</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Assign Tag to Uploaded Leads</label>
                <select
                  value={uploadSelectedTag}
                  onChange={(e) => setUploadSelectedTag(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {leadTags.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`p-6 border-2 border-dashed ${isDragOver ? 'border-cyan-400 bg-cyan-950/40' : 'border-slate-800 hover:border-cyan-500/50 bg-slate-950/40'} rounded-2xl text-center space-y-2 cursor-pointer transition`}
              >
                <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
                <div className="text-xs font-bold text-slate-200">
                  {uploadedFileName ? uploadedFileName : 'Click or Drag & Drop Lead File (CSV, TXT, TSV, JSON)'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Auto-detects columns: Name, Title, Company, Email, Phone, Website
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
                  {uploadError}
                </div>
              )}

              {parsedLeadsPreview.length > 0 && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-bold flex items-center justify-between">
                  <span>✓ {parsedLeadsPreview.length} valid leads parsed</span>
                  <span className="font-mono text-[11px]">Ready to import</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedLeadsPreview.length === 0}
                  onClick={handleConfirmUpload}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  Import {parsedLeadsPreview.length} Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Edit Lead Profile</h3>
              </div>
              <button 
                onClick={() => setEditingLead(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editingLead.name}
                    onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={editingLead.title}
                    onChange={(e) => setEditingLead({ ...editingLead, title: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Company</label>
                  <input
                    type="text"
                    value={editingLead.company}
                    onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Website</label>
                  <input
                    type="text"
                    value={editingLead.website}
                    onChange={(e) => setEditingLead({ ...editingLead, website: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    value={editingLead.email}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingLead.phone}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateLead(editingLead.id, editingLead);
                    setEditingLead(null);
                    addNotification({
                      title: 'Lead Updated',
                      message: `Details for ${editingLead.name} saved.`,
                      type: 'system'
                    });
                  }}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Update Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEAD DELETION CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-rose-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-slate-100 text-base">Move Lead to Trash?</h3>
              </div>
              <button 
                onClick={() => setLeadToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Are you sure you want to move <strong className="text-white font-bold">{leadToDelete.name}</strong> ({leadToDelete.company}) to the Trash bin?
              </p>
              <p className="text-slate-400 text-[11px]">
                You can restore this lead anytime from the Trash Manager, or permanently purge it.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteLeadToTrash(leadToDelete.id);
                  addNotification({
                    title: 'Lead Moved to Trash 🗑️',
                    message: `${leadToDelete.name} moved to trash bin.`,
                    type: 'system'
                  });
                  setLeadToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
