import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { EmailTemplate } from '../../types';
import { 
  FileText, 
  Plus, 
  Search, 
  Sparkles, 
  Copy, 
  Trash2, 
  Edit3, 
  Check, 
  Send, 
  ShieldCheck, 
  Zap, 
  Layers,
  ArrowRight,
  TrendingUp,
  Tag,
  X,
  FolderPlus
} from 'lucide-react';
import { auditEmailDeliverability } from '../../utils/spamChecker';

interface TemplateCategoryItem {
  id: string;
  name: string;
  label: string;
  isCustom?: boolean;
}

const DEFAULT_CATEGORIES: TemplateCategoryItem[] = [
  { id: 'all', name: 'all', label: 'All Templates' },
  { id: 'cold_outreach', name: 'cold_outreach', label: 'Cold Outreach' },
  { id: 'followup_7d', name: 'followup_7d', label: '7-Day Follow-Up' },
  { id: 'followup_14d', name: 'followup_14d', label: '14-Day Follow-Up' },
  { id: 'breakup_30d', name: 'breakup_30d', label: '30-Day Breakup' },
  { id: 'agency_pitch', name: 'agency_pitch', label: 'Agency Pitch' },
  { id: 'custom', name: 'custom', label: 'Custom' }
];

export { INITIAL_TEMPLATES } from '../../context/AppContext';

export const TemplateManager: React.FC = () => {
  const { 
    setActiveTab, 
    openCampaignWizard,
    addNotification, 
    emailTemplates, 
    setEmailTemplates,
    templateCategories,
    addTemplateCategory,
    deleteTemplateCategory,
    deleteEmailTemplate,
    saveWorkspaceToDatabase,
    syncStatus
  } = useApp();
  
  // Use global emailTemplates as single source of truth (excluding trash)
  const activeEmailTemplates = useMemo(() => {
    return emailTemplates.filter(t => !t.isTrash);
  }, [emailTemplates]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [newCatLabel, setNewCatLabel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplate | null>(() => activeEmailTemplates[0] || null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

  // Category Tabs including 'all'
  const categoryTabs = useMemo(() => {
    return [
      { id: 'all', name: 'all', label: 'All Templates', color: 'slate' },
      ...templateCategories
    ];
  }, [templateCategories]);

  // Keep activeTemplate synchronized
  useEffect(() => {
    if (activeEmailTemplates.length > 0) {
      setActiveTemplate(prev => {
        if (prev && activeEmailTemplates.some(t => t.id === prev.id)) {
          const matched = activeEmailTemplates.find(t => t.id === prev.id);
          return matched || prev;
        }
        return activeEmailTemplates[0];
      });
    } else {
      setActiveTemplate(null);
    }
  }, [activeEmailTemplates]);

  // Edit / Create Form State
  const [editForm, setEditForm] = useState<Partial<EmailTemplate>>({});

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCatLabel.trim();
    if (!label) return;
    const name = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (templateCategories.some(c => c.name === name)) {
      setNewCatLabel('');
      setShowAddCatModal(false);
      return;
    }
    addTemplateCategory({
      name,
      label,
      color: 'cyan',
      isCustom: true
    });
    setSelectedCategory(name);
    setNewCatLabel('');
    setShowAddCatModal(false);
    saveWorkspaceToDatabase();
  };

  const handleDeleteCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetCat = templateCategories.find(c => c.id === catId);
    if (!targetCat) return;
    deleteTemplateCategory(catId);
    if (selectedCategory === targetCat.name) {
      setSelectedCategory('all');
    }
    saveWorkspaceToDatabase();
  };

  const handleCopy = (t?: EmailTemplate) => {
    if (!t) return;
    navigator.clipboard.writeText(`Subject: ${t.subject || ''}\n\n${t.body || ''}`);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartCreate = () => {
    const newTmpl: Partial<EmailTemplate> = {
      title: 'New High-Deliverability Template',
      category: templateCategories[0]?.name || 'cold_outreach',
      subject: 'Quick question for {{name}} at {{company}}',
      body: 'Hi {{name}},\n\nI was looking at {{website}} and wanted to reach out regarding...\n\nBest regards,',
      tags: ['Custom', 'Outreach'],
      isCustom: true,
      usageCount: 0,
      replyRatePercent: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setEditForm(newTmpl);
    setIsEditing(true);
  };

  const handleStartEdit = (t?: EmailTemplate) => {
    if (!t) return;
    setEditForm({ ...t });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const title = editForm.title?.trim() || 'Custom Outreach Template';
    const subject = editForm.subject?.trim() || 'Quick question regarding {{company}}';
    const body = editForm.body?.trim() || 'Hi {{name}},\n\nReaching out regarding {{company}}.\n\nBest regards,';
    const category = (editForm.category as string) || templateCategories[0]?.name || 'cold_outreach';
    const tags = editForm.tags && editForm.tags.length > 0 ? editForm.tags : ['Custom', 'Outreach'];

    setIsSaving(true);

    let savedTemplate: EmailTemplate;

    if (editForm.id) {
      // Update existing
      savedTemplate = {
        ...editForm,
        id: editForm.id,
        title,
        subject,
        body,
        category,
        tags,
        usageCount: editForm.usageCount || 0,
        replyRatePercent: editForm.replyRatePercent || 0,
        createdAt: editForm.createdAt || new Date().toISOString().split('T')[0],
        isTrash: false
      } as EmailTemplate;

      const updated = emailTemplates.map(t => t.id === editForm.id ? savedTemplate : t);
      setEmailTemplates(updated);
      try { localStorage.setItem('visualsky_templates', JSON.stringify(updated)); } catch {}
      setActiveTemplate(savedTemplate);
      addNotification({
        title: `Template Saved to Database 📝`,
        message: `"${title}" has been updated and synchronized with your workspace.`,
        type: 'system',
        linkTab: 'templates'
      });
    } else {
      // Add new (prepended to top)
      savedTemplate = {
        id: `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        category,
        subject,
        body,
        tags,
        isCustom: true,
        usageCount: 0,
        replyRatePercent: 0,
        createdAt: new Date().toISOString().split('T')[0],
        isTrash: false
      };
      const updated = [savedTemplate, ...emailTemplates];
      setEmailTemplates(updated);
      try { localStorage.setItem('visualsky_templates', JSON.stringify(updated)); } catch {}
      setActiveTemplate(savedTemplate);
      addNotification({
        title: `New Template Created & Saved 📝`,
        message: `"${savedTemplate.title}" is saved and available across all campaigns & inbox.`,
        type: 'system',
        linkTab: 'templates'
      });
    }

    // Guarantee immediate persistent save
    await saveWorkspaceToDatabase();
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    setIsEditing(false);
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    deleteEmailTemplate(id);
    if (activeTemplate?.id === id) {
      const remaining = activeEmailTemplates.filter(t => t.id !== id);
      setActiveTemplate(remaining.length > 0 ? remaining[0] : null);
    }
    saveWorkspaceToDatabase();
  };

  // Anti-Spam Check on Active Template
  const activeSubject = isEditing ? (editForm.subject || '') : (activeTemplate?.subject || '');
  const activeBody = isEditing ? (editForm.body || '') : (activeTemplate?.body || '');
  const spamAudit = auditEmailDeliverability(activeSubject, activeBody);

  const filteredTemplates = activeEmailTemplates.filter(t => {
    const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
    const matchSearch = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.tags && t.tags.some(tag => (tag || '').toLowerCase().includes(searchQuery.toLowerCase())));
    return matchCat && matchSearch;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-lg flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              B2B Outbound Vault
            </span>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
              100% Primary Inbox Ready
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 mt-2">Email Templates & Copy Hub</h1>
          <p className="text-xs text-slate-400 mt-1">
            Pre-tested, spam-proof cold email templates & automated 7d/14d/30d follow-up frameworks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Create Custom Template
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
          {categoryTabs.map(cat => (
            <div key={cat.id} className="relative group shrink-0">
              <button
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat.name
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                {'isCustom' in cat && (cat as any).isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCategory(cat.id, e)}
                    className="opacity-60 hover:opacity-100 hover:text-rose-300 p-0.5 rounded transition"
                    title="Delete category"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowAddCatModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-dashed border-blue-500/40 text-blue-400 hover:text-blue-300 text-xs font-bold whitespace-nowrap flex items-center gap-1 transition cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ Add Category</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates & tags..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Main Layout: Template Cards Grid + Active Template Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Cards List (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {filteredTemplates.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 text-xs">
              No templates found for this filter.
            </div>
          ) : (
            filteredTemplates.map(t => {
              const isSelected = activeTemplate?.id === t.id && !isEditing;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTemplate(t);
                    setIsEditing(false);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-950/50 to-indigo-950/30 border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm truncate">{t.title}</span>
                        {t.isCustom && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-pink-500/10 text-pink-300 border border-pink-500/20 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-400 font-medium truncate mt-0.5">
                        Subject: {t.subject}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                        <TrendingUp className="w-3 h-3" />
                        {t.replyRatePercent > 0 ? `${t.replyRatePercent}%` : 'New'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-2 font-mono">
                    {t.body}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {t.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500">{t.usageCount} uses</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Template Editor & Spam Radar (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {isEditing ? (
            /* Editing Form */
            <div className="bg-slate-900 rounded-2xl border border-blue-500/50 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  {editForm.id ? 'Edit Template' : 'Create Custom Template'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving to Cloud...</span>
                      </>
                    ) : savedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Saved to Database!</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Save Template</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Template Title</label>
                <input
                  type="text"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="e.g. Enterprise SaaS Follow-Up"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={editForm.category || templateCategories[0]?.name || 'cold_outreach'}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {templateCategories.map(c => (
                      <option key={c.id} value={c.name}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Insert Dynamic Tags</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {['{{name}}', '{{company}}', '{{website}}', '{{niche}}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, body: (editForm.body || '') + ' ' + tag })}
                        className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-mono"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editForm.subject || ''}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  placeholder="e.g. Scaling outreach pipeline for {{company}}"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Body Copy</label>
                <textarea
                  rows={8}
                  value={editForm.body || ''}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                />
              </div>
            </div>
          ) : activeTemplate ? (
            /* Live Preview & Action Hub */
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-100">{activeTemplate.title || 'Untitled Template'}</h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded capitalize">
                      {(activeTemplate.category || 'custom').replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Used {activeTemplate.usageCount || 0} times &bull; Estimated positive reply rate: <strong className="text-emerald-400">{activeTemplate.replyRatePercent || 0}%</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(activeTemplate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                  >
                    {copiedId === activeTemplate.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === activeTemplate.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleStartEdit(activeTemplate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    Edit
                  </button>
                  <button
                    onClick={() => setTemplateToDelete(activeTemplate)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subject Display */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Line</div>
                <div className="text-sm font-semibold text-slate-100">{activeTemplate?.subject || '(No subject)'}</div>
              </div>

              {/* Body Display */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Body Copy</div>
                <div className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {activeTemplate?.body || ''}
                </div>
              </div>

              {/* Anti-Spam & Deliverability Radar */}
              <div className={`p-4 rounded-xl border ${
                spamAudit.score >= 90 
                  ? 'bg-emerald-950/20 border-emerald-800/40' 
                  : spamAudit.score >= 70 
                    ? 'bg-amber-950/20 border-amber-800/40' 
                    : 'bg-rose-950/20 border-rose-800/40'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${spamAudit.score >= 90 ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className="text-xs font-bold text-slate-200">Anti-Spam Deliverability Radar</span>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    spamAudit.score >= 90 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    Score: {spamAudit.score}/100 ({spamAudit.estimatedDeliverability})
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-slate-300">
                  {spamAudit.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Action to Campaign / Send Mail */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => openCampaignWizard({ templateId: activeTemplate.id, step: 4 })}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-500/10 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Use in Campaign Wizard
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No Template Selected</p>
              <button
                onClick={handleStartCreate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + Create New Template
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ADD CATEGORY MODAL */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-blue-500/40 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-400" />
                Create Template Category
              </h3>
              <button onClick={() => setShowAddCatModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="e.g. Executive Follow-Ups"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TEMPLATE MODAL */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-rose-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-slate-100 text-base">Delete Template?</h3>
              </div>
              <button 
                onClick={() => setTemplateToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Are you sure you want to delete template <strong className="text-white font-bold">&quot;{templateToDelete.title}&quot;</strong>?
              </p>
              <p className="text-slate-400 text-[11px]">
                This template will be removed from your active templates and Campaign Wizard sequence selectors.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDelete(templateToDelete.id);
                  addNotification({
                    title: 'Template Deleted 🗑️',
                    message: `"${templateToDelete.title}" removed.`,
                    type: 'system'
                  });
                  setTemplateToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
