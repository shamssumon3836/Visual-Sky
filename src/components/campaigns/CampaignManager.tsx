import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Campaign, CampaignStep, Lead, SMTPAccount, EmailTemplate } from '../../types';
import { SMTPConnectModal } from '../smtp/SMTPConnectModal';
import { safeParseResponse } from '../../lib/safeFetch';
import { 
  Send, 
  Activity,
  Plus, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Users, 
  Flame, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  Calendar,
  Layers,
  FileText,
  X,
  Server,
  Filter,
  Check,
  CheckSquare,
  Square,
  ShieldCheck,
  Search,
  Globe,
  Sliders,
  ChevronRight,
  Info,
  FolderPlus,
  RefreshCw,
  StopCircle,
  MessageSquare,
  History,
  Timer,
  Tag as TagIcon,
  Edit3,
  CheckCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const CampaignManager: React.FC = () => {
  const { 
    campaigns, 
    createCampaign, 
    updateCampaign,
    toggleCampaignStatus, 
    deleteCampaign, 
    launchQuickFollowUp, 
    getDormantLeads,
    leads,
    leadTags,
    updateLead,
    smtpAccounts,
    currentUser,
    emailTemplates,
    templateCategories,
    addTemplateCategory,
    addEmailTemplate,
    addSentEmailLog,
    addNotification,
    activeFollowUpCohort,
    setActiveFollowUpCohort
  } = useApp();

  // Wizard modal state & step
  const [showWizardModal, setShowWizardModal] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [stepValidationError, setStepValidationError] = useState<string>('');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  // Quick Follow-up modal (7d / 14d / 30d Cohorts)
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false);
  const [followUpDays, setFollowUpDays] = useState<'7d' | '14d' | '30d'>('7d');
  const [followUpSubject, setFollowUpSubject] = useState<string>('Quick follow-up regarding our conversation last week');
  const [followUpBody, setFollowUpBody] = useState<string>(
    'Hi {{name}},\n\nFollowing up on my message from about a week ago regarding {{company}}\'s outbound growth stack.\n\nDid you have a quick moment to review?\n\nBest regards,\n' + (currentUser.name || 'Outreach Manager')
  );
  const [followUpSelectedLeadIds, setFollowUpSelectedLeadIds] = useState<string[]>([]);
  const [followUpLeadSearch, setFollowUpLeadSearch] = useState<string>('');
  const [followUpSmtpId, setFollowUpSmtpId] = useState<string>('');
  const [followUpSendMode, setFollowUpSendMode] = useState<'instant' | 'scheduled'>('instant');
  const [followUpInterval, setFollowUpInterval] = useState<number>(15);

  // Direct SMTP Connect Modal Trigger inside Wizard / FollowUp
  const [showSmtpModalInWizard, setShowSmtpModalInWizard] = useState<boolean>(false);

  // Create Template Modal Trigger inside Wizard
  const [showCreateTemplateInWizard, setShowCreateTemplateInWizard] = useState<boolean>(false);
  const [newTmplTitle, setNewTmplTitle] = useState<string>('');
  const [newTmplSubject, setNewTmplSubject] = useState<string>('');
  const [newTmplBody, setNewTmplBody] = useState<string>('');
  const [newTmplCategory, setNewTmplCategory] = useState<string>('general');
  const [newTmplTags, setNewTmplTags] = useState<string>('Cold Outreach, High Intent');

  // Template Browser in Step 4
  const [selectedTemplateCat, setSelectedTemplateCat] = useState<string>('all');
  const [selectedTemplateTag, setSelectedTemplateTag] = useState<string>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState<string>('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [newCatLabel, setNewCatLabel] = useState<string>('');

  // 6-Step Wizard State
  // Step 1: Basic Info
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [senderName, setSenderName] = useState<string>(currentUser.name || '');
  const [senderEmail, setSenderEmail] = useState<string>(currentUser.email || '');
  const [campaignNiche, setCampaignNiche] = useState<string>('');

  // Step 2: Select SMTP (with Multi-tag, Provider Filter & Multi-mailbox Selection)
  const activeSmtps = useMemo(() => smtpAccounts.filter(s => !s.isTrash), [smtpAccounts]);
  const activeCampaigns = useMemo(() => campaigns.filter(c => !c.isTrash), [campaigns]);
  const [selectedSmtpIds, setSelectedSmtpIds] = useState<string[]>(() => {
    return activeSmtps.length > 0 ? activeSmtps.map(s => s.id) : [];
  });
  const [selectedSmtpId, setSelectedSmtpId] = useState<string>('round_robin');
  const [smtpProviderFilter, setSmtpProviderFilter] = useState<'all' | 'google' | 'cpanel' | 'ses' | 'custom' | 'webmail'>('all');
  const [selectedSmtpTags, setSelectedSmtpTags] = useState<string[]>([]);
  const [smtpSearchQuery, setSmtpSearchQuery] = useState<string>('');

  // Extract all unique SMTP tags (e.g. from provider, domain, custom tags)
  const allSmtpTags = useMemo(() => {
    const set = new Set<string>();
    activeSmtps.forEach(s => {
      if (s.domainWebmailUrl) set.add('Domain Webmail');
      if (s.provider) {
        if (s.provider.toLowerCase().includes('google') || s.provider.toLowerCase().includes('gmail')) set.add('Google Workspace');
        else if (s.provider.toLowerCase().includes('hostinger') || s.provider.toLowerCase().includes('cpanel')) set.add('cPanel / Hostinger');
        else if (s.provider.toLowerCase().includes('amazon') || s.provider.toLowerCase().includes('ses')) set.add('Amazon SES');
        else set.add(s.provider);
      }
      if (s.host) {
        const parts = s.host.split('.');
        if (parts.length >= 2) {
          set.add(parts.slice(-2).join('.'));
        }
      }
      if (s.healthScore && s.healthScore >= 99) set.add('99%+ Health');
    });
    return Array.from(set).filter(Boolean);
  }, [activeSmtps]);

  // Filtered SMTP list in Step 2
  const displayedWizardSmtps = useMemo(() => {
    return activeSmtps.filter(smtp => {
      // Search term
      if (smtpSearchQuery.trim()) {
        const q = smtpSearchQuery.toLowerCase();
        const matches = 
          (smtp.name || '').toLowerCase().includes(q) ||
          (smtp.username || '').toLowerCase().includes(q) ||
          (smtp.host || '').toLowerCase().includes(q) ||
          (smtp.provider || '').toLowerCase().includes(q) ||
          (smtp.fromName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Provider filter
      if (smtpProviderFilter === 'google' && !smtp.provider.toLowerCase().includes('google') && !smtp.host.toLowerCase().includes('gmail') && !smtp.host.toLowerCase().includes('google')) return false;
      if (smtpProviderFilter === 'cpanel' && !smtp.provider.toLowerCase().includes('cpanel') && !smtp.provider.toLowerCase().includes('hostinger') && !smtp.domainWebmailUrl) return false;
      if (smtpProviderFilter === 'ses' && !smtp.provider.toLowerCase().includes('ses') && !smtp.provider.toLowerCase().includes('amazon')) return false;
      if (smtpProviderFilter === 'custom' && (smtp.provider.toLowerCase().includes('google') || smtp.provider.toLowerCase().includes('amazon'))) return false;
      if (smtpProviderFilter === 'webmail' && !smtp.domainWebmailUrl) return false;

      // Tag filter
      if (selectedSmtpTags.length > 0) {
        const hasTag = selectedSmtpTags.some(tag => {
          if (tag === 'Domain Webmail' && smtp.domainWebmailUrl) return true;
          if (tag === 'Google Workspace' && (smtp.provider.toLowerCase().includes('google') || smtp.host.toLowerCase().includes('google'))) return true;
          if (tag === 'cPanel / Hostinger' && (smtp.provider.toLowerCase().includes('cpanel') || smtp.provider.toLowerCase().includes('hostinger'))) return true;
          if (tag === 'Amazon SES' && (smtp.provider.toLowerCase().includes('ses') || smtp.provider.toLowerCase().includes('amazon'))) return true;
          if (tag === '99%+ Health' && (smtp.healthScore || 0) >= 99) return true;
          if (smtp.host.toLowerCase().includes(tag.toLowerCase()) || smtp.provider.toLowerCase().includes(tag.toLowerCase()) || smtp.name.toLowerCase().includes(tag.toLowerCase())) return true;
          return false;
        });
        if (!hasTag) return false;
      }

      return true;
    });
  }, [activeSmtps, smtpSearchQuery, smtpProviderFilter, selectedSmtpTags]);

  const handleToggleSmtpTag = (tagName: string) => {
    if (selectedSmtpTags.includes(tagName)) {
      setSelectedSmtpTags(selectedSmtpTags.filter(t => t !== tagName));
    } else {
      setSelectedSmtpTags([...selectedSmtpTags, tagName]);
    }
  };

  const clearSmtpTagFilters = () => {
    setSelectedSmtpTags([]);
  };

  const handleToggleSmtpSelection = (id: string) => {
    if (selectedSmtpIds.includes(id)) {
      const remaining = selectedSmtpIds.filter(sId => sId !== id);
      setSelectedSmtpIds(remaining);
      if (remaining.length === 1) setSelectedSmtpId(remaining[0]);
      else if (remaining.length > 1) setSelectedSmtpId('round_robin');
      else setSelectedSmtpId('');
    } else {
      const updated = [...selectedSmtpIds, id];
      setSelectedSmtpIds(updated);
      if (updated.length === 1) setSelectedSmtpId(updated[0]);
      else setSelectedSmtpId('round_robin');
    }
  };

  const selectAllActiveSmtps = () => {
    const allIds = activeSmtps.map(s => s.id);
    setSelectedSmtpIds(allIds);
    setSelectedSmtpId('round_robin');
  };

  const selectAllMatchingTagSmtps = () => {
    const matchingIds = displayedWizardSmtps.map(s => s.id);
    setSelectedSmtpIds(Array.from(new Set([...selectedSmtpIds, ...matchingIds])));
    if (matchingIds.length === 1) setSelectedSmtpId(matchingIds[0]);
    else setSelectedSmtpId('round_robin');
  };

  const selectOnlyDisplayedSmtps = () => {
    const ids = displayedWizardSmtps.map(s => s.id);
    setSelectedSmtpIds(ids);
    if (ids.length === 1) setSelectedSmtpId(ids[0]);
    else setSelectedSmtpId('round_robin');
  };

  const deselectAllSmtps = () => {
    setSelectedSmtpIds([]);
    setSelectedSmtpId('');
  };

  // Step 3: Recipients & Manage Tag Filter (Multi-tag Selection)
  const activeLeads = useMemo(() => leads.filter(l => !l.isTrash), [leads]);
  const [recipientFilter, setRecipientFilter] = useState<'all' | '7d' | '14d' | '30d' | 'new' | 'custom'>('all');
  const [selectedLeadTags, setSelectedLeadTags] = useState<string[]>([]);
  const [wizardLeadSearch, setWizardLeadSearch] = useState<string>('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(activeLeads.map(l => l.id));

  // Tag color mapping helper
  const getLeadTagColorClass = (tagName: string) => {
    const foundTag = leadTags.find(t => t.name === tagName);
    const color = foundTag?.color || 'cyan';
    switch (color) {
      case 'cyan': return 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40';
      case 'emerald': return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
      case 'purple': return 'bg-purple-950/70 text-purple-300 border-purple-500/40';
      case 'amber': return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
      case 'blue': return 'bg-blue-950/70 text-blue-300 border-blue-500/40';
      case 'rose': return 'bg-rose-950/70 text-rose-300 border-rose-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Filtered leads displayed in Step 3
  const displayedWizardLeads = useMemo(() => {
    return activeLeads.filter(lead => {
      // Search term
      if (wizardLeadSearch.trim()) {
        const q = wizardLeadSearch.toLowerCase();
        const matches = 
          (lead.name || '').toLowerCase().includes(q) ||
          (lead.company || '').toLowerCase().includes(q) ||
          (lead.email || '').toLowerCase().includes(q) ||
          ((lead.title || '').toLowerCase().includes(q)) ||
          (lead.tags && lead.tags.some(t => (t || '').toLowerCase().includes(q)));
        if (!matches) return false;
      }

      // Cohort filter
      if (recipientFilter === '7d' && !(lead.daysAgo >= 7 && lead.status !== 'replied')) return false;
      if (recipientFilter === '14d' && !(lead.daysAgo >= 14 && lead.status !== 'replied')) return false;
      if (recipientFilter === '30d' && !(lead.daysAgo >= 30 && lead.status !== 'replied')) return false;
      if (recipientFilter === 'new' && lead.status !== 'new') return false;

      // Multi-Tag filter: if tags are selected, match any of the selected tags
      if (selectedLeadTags.length > 0) {
        const hasMatchingTag = lead.tags.some(t => selectedLeadTags.includes(t));
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [activeLeads, wizardLeadSearch, recipientFilter, selectedLeadTags]);

  const handleToggleTagFilter = (tagName: string) => {
    let nextTags: string[];
    if (selectedLeadTags.includes(tagName)) {
      nextTags = selectedLeadTags.filter(t => t !== tagName);
    } else {
      nextTags = [...selectedLeadTags, tagName];
    }
    setSelectedLeadTags(nextTags);
    if (nextTags.length > 0) {
      const matchingIds = activeLeads
        .filter(l => l.tags && l.tags.some(t => nextTags.includes(t)))
        .map(l => l.id);
      setSelectedLeadIds(matchingIds);
    } else {
      setSelectedLeadIds(activeLeads.map(l => l.id));
    }
  };

  const clearLeadTagFilters = () => {
    setSelectedLeadTags([]);
    setSelectedLeadIds(activeLeads.map(l => l.id));
  };

  const selectAllMatchingTagLeads = () => {
    if (selectedLeadTags.length === 0) {
      const ids = displayedWizardLeads.map(l => l.id);
      setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...ids])));
      return;
    }
    const matchingIds = activeLeads
      .filter(l => l.tags.some(t => selectedLeadTags.includes(t)))
      .map(l => l.id);
    setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...matchingIds])));
  };

  const selectOnlyDisplayedLeads = () => {
    const ids = displayedWizardLeads.map(l => l.id);
    setSelectedLeadIds(ids);
  };

  const selectAllActiveLeads = () => {
    setSelectedLeadIds(activeLeads.map(l => l.id));
  };

  const deselectAllLeads = () => {
    setSelectedLeadIds([]);
  };

  // Step 4: Template & Steps
  const [wizardSteps, setWizardSteps] = useState<CampaignStep[]>([
    {
      stepNumber: 1,
      delayDays: 0,
      subject: '',
      body: '',
      triggerCondition: 'all'
    }
  ]);

  // Track active loaded template for each step
  const [appliedTemplates, setAppliedTemplates] = useState<Record<number, { id: string; title: string; category: string }>>({});

  // Available unique tags from all templates
  const allTemplateTags = useMemo(() => {
    const set = new Set<string>();
    emailTemplates.forEach(t => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => set.add(tag.trim()));
      }
    });
    return Array.from(set).filter(Boolean);
  }, [emailTemplates]);

  // Filtered templates in Step 4
  const filteredTemplates = useMemo(() => {
    return emailTemplates.filter(t => {
      // Category filter
      if (selectedTemplateCat !== 'all' && t.category !== selectedTemplateCat) {
        return false;
      }
      // Tag filter
      if (selectedTemplateTag !== 'all' && (!t.tags || !t.tags.includes(selectedTemplateTag))) {
        return false;
      }
      // Search query
      if (templateSearchQuery.trim()) {
        const q = templateSearchQuery.toLowerCase();
        const matches = 
          (t.title || '').toLowerCase().includes(q) ||
          (t.subject || '').toLowerCase().includes(q) ||
          (t.body || '').toLowerCase().includes(q) ||
          (t.tags && t.tags.some(tag => (tag || '').toLowerCase().includes(q)));
        if (!matches) return false;
      }
      return true;
    });
  }, [emailTemplates, selectedTemplateCat, selectedTemplateTag, templateSearchQuery]);

  // Step 5: Schedule & Sending Delay Interval
  const [sendMode, setSendMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduleStartTime, setScheduleStartTime] = useState<string>('09:00');
  const [scheduleEndTime, setScheduleEndTime] = useState<string>('18:00');
  const [scheduleTimezone, setScheduleTimezone] = useState<string>('America/New_York (EST)');
  const [scheduleActiveDays, setScheduleActiveDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [sendingInterval, setSendingInterval] = useState<number>(15); // 5s, 10s, 15s, 30s
  const [enableJitter, setEnableJitter] = useState<boolean>(true);

  // REAL LIVE DISPATCHER EXECUTION ENGINE STATE
  const [showLiveDispatcher, setShowLiveDispatcher] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [dispatchProgress, setDispatchProgress] = useState<{
    currentLeadIndex: number;
    totalLeads: number;
    currentLeadName: string;
    currentLeadEmail: string;
    currentLeadCompany: string;
    secondsUntilNext: number;
    sentLogs: string[];
  }>({
    currentLeadIndex: 0,
    totalLeads: 0,
    currentLeadName: '',
    currentLeadEmail: '',
    currentLeadCompany: '',
    secondsUntilNext: 0,
    sentLogs: []
  });

  const abortDispatchRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Listen for global activeFollowUpCohort trigger from Navbar or Dashboard
  useEffect(() => {
    if (activeFollowUpCohort) {
      handleOpenFollowUpCohort(activeFollowUpCohort);
      setActiveFollowUpCohort(null);
    }
  }, [activeFollowUpCohort]);

  // Handle Wizard Open for new campaign
  const handleOpenWizard = () => {
    setEditingCampaignId(null);
    setWizardStep(1);
    setStepValidationError('');
    setCampaignTitle('Q3 High-Intent Outreach Sequence');
    setSenderName(currentUser.name || 'Outreach Specialist');
    setSenderEmail(currentUser.email || 'outreach@visualsky.io');
    setCampaignNiche('B2B SaaS & Technology');
    setSelectedLeadTags([]);
    setWizardLeadSearch('');
    setRecipientFilter('all');
    setSelectedLeadIds(activeLeads.map(l => l.id));
    if (activeSmtps.length > 0) {
      setSelectedSmtpIds(activeSmtps.map(s => s.id));
      setSelectedSmtpId('round_robin');
    } else {
      setSelectedSmtpIds([]);
      setSelectedSmtpId('');
    }
    setShowWizardModal(true);
  };

  // Handle Wizard Open for EDITING an existing campaign
  const handleOpenEditWizard = (camp: Campaign) => {
    setEditingCampaignId(camp.id);
    setWizardStep(1);
    setStepValidationError('');
    setCampaignTitle(camp.name);
    setSenderName(currentUser.name || 'Outreach Specialist');
    setSenderEmail(currentUser.email || 'outreach@visualsky.io');
    setCampaignNiche(camp.niche || 'B2B SaaS & Technology');
    setSelectedSmtpId(camp.assignedSmtpId || activeSmtps[0]?.id || '');
    setSelectedLeadIds(camp.leadIds || []);
    setWizardSteps(camp.steps && camp.steps.length > 0 ? camp.steps : [
      {
        stepNumber: 1,
        delayDays: 0,
        subject: 'Scaling cold outreach pipeline for {{company}}',
        body: 'Hi {{name}},\n\nLoved {{company}}\'s recent expansion! Quick question: are you managing cold email deliverability in-house or looking for automated 99% inbox placement?\n\nWould you be open to a 2-minute overview this Thursday?\n\nBest regards,\n' + (currentUser.name || 'Outreach Team'),
        triggerCondition: 'all'
      }
    ]);
    setSendMode(camp.sendMode || 'instant');
    setSendingInterval(camp.sendingIntervalSec || 15);
    setScheduleStartTime(camp.scheduleStartTime || '09:00');
    setScheduleEndTime(camp.scheduleEndTime || '18:00');
    setScheduleTimezone(camp.scheduleTimezone || 'America/New_York (EST)');
    setScheduleActiveDays(camp.scheduleActiveDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setShowWizardModal(true);
  };

  // Open 7d / 14d / 30d Cohort Follow-up Suite
  const handleOpenFollowUpCohort = (days: '7d' | '14d' | '30d') => {
    setFollowUpDays(days);
    const dayCount = days === '7d' ? 7 : days === '14d' ? 14 : 30;
    const dormant = getDormantLeads(dayCount);
    
    setFollowUpSelectedLeadIds(dormant.map(l => l.id));
    setFollowUpLeadSearch('');
    setFollowUpSmtpId(activeSmtps[0]?.id || '');
    setFollowUpInterval(15);
    setFollowUpSendMode('instant');

    if (days === '7d') {
      setFollowUpSubject('Quick follow-up regarding our conversation last week');
      setFollowUpBody(`Hi {{name}},\n\nFollowing up on my message from about a week ago regarding {{company}}'s cold outreach stack.\n\nDid you have a quick 2 minutes to review?\n\nBest regards,\n${currentUser.name || 'Outreach Specialist'}`);
    } else if (days === '14d') {
      setFollowUpSubject('Value-add metrics report for {{company}}');
      setFollowUpBody(`Hi {{name}},\n\nWanted to circle back with some updated deliverability metrics tailored for {{company}}.\n\nAre you open to checking out a quick 1-minute case study?\n\nBest,\n${currentUser.name || 'Outreach Specialist'}`);
    } else {
      setFollowUpSubject('Closing the loop on {{company}} cold outreach');
      setFollowUpBody(`Hi {{name}},\n\nClosing out my notes regarding {{company}}. If now isn't the right time, no worries at all!\n\nFeel free to reach back out whenever you're scaling outbound.\n\nBest regards,\n${currentUser.name || 'Outreach Specialist'}`);
    }
    setShowFollowUpModal(true);
  };

  // Filtered leads in the Follow-up Cohort modal
  const cohortDormantLeads = useMemo(() => {
    const dayCount = followUpDays === '7d' ? 7 : followUpDays === '14d' ? 14 : 30;
    const base = getDormantLeads(dayCount);
    if (!followUpLeadSearch.trim()) return base;
    const q = followUpLeadSearch.toLowerCase();
    return base.filter(l => 
      l.name.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [leads, followUpDays, followUpLeadSearch]);

  const toggleFollowUpLead = (id: string) => {
    if (followUpSelectedLeadIds.includes(id)) {
      setFollowUpSelectedLeadIds(followUpSelectedLeadIds.filter(lid => lid !== id));
    } else {
      setFollowUpSelectedLeadIds([...followUpSelectedLeadIds, id]);
    }
  };

  const handleExecuteFollowUpModal = () => {
    if (followUpSelectedLeadIds.length === 0) {
      addNotification({
        title: 'No Leads Selected',
        message: 'Please select at least 1 dormant lead to launch the follow-up sequence.',
        type: 'system'
      });
      return;
    }

    const newCamp = createCampaign({
      name: `${followUpDays.toUpperCase()} Follow-Up Cohort Sequence`,
      niche: 'Automated Dormant Re-engagement',
      status: followUpSendMode === 'instant' ? 'running' : 'draft',
      totalLeads: followUpSelectedLeadIds.length,
      leadIds: followUpSelectedLeadIds,
      sendMode: followUpSendMode,
      sendingIntervalSec: followUpInterval,
      assignedSmtpId: followUpSmtpId || activeSmtps[0]?.id,
      steps: [
        {
          stepNumber: 1,
          delayDays: 0,
          subject: followUpSubject,
          body: followUpBody,
          triggerCondition: 'all'
        }
      ]
    });

    // Update leads activity
    followUpSelectedLeadIds.forEach(id => {
      updateLead(id, {
        daysAgo: 0,
        lastActivityDate: new Date().toISOString()
      });
    });

    setShowFollowUpModal(false);

    if (followUpSendMode === 'instant') {
      // Launch live dispatcher for these leads
      setSelectedLeadIds(followUpSelectedLeadIds);
      setSelectedSmtpId(followUpSmtpId || activeSmtps[0]?.id);
      setWizardSteps([
        {
          stepNumber: 1,
          delayDays: 0,
          subject: followUpSubject,
          body: followUpBody,
          triggerCondition: 'all'
        }
      ]);
      setSendingInterval(followUpInterval);
      startLiveDispatcher(newCamp, followUpSelectedLeadIds, [
        {
          stepNumber: 1,
          delayDays: 0,
          subject: followUpSubject,
          body: followUpBody,
          triggerCondition: 'all'
        }
      ], followUpSmtpId || activeSmtps[0]?.id, followUpInterval);
    } else {
      addNotification({
        title: `Follow-Up Cohort Scheduled (${followUpDays.toUpperCase()}) 📅`,
        message: `Automated sequence enrolled for ${followUpSelectedLeadIds.length} recipients.`,
        type: 'campaign'
      });
    }
  };

  const handleAddStep = () => {
    const nextNum = wizardSteps.length + 1;
    const delay = nextNum === 2 ? 7 : nextNum === 3 ? 14 : 30;
    setWizardSteps([
      ...wizardSteps,
      {
        stepNumber: nextNum,
        delayDays: delay,
        subject: `Re: Scaled growth idea for {{company}} (Step ${nextNum})`,
        body: `Hi {{name}},\n\nReaching out one more time regarding {{company}}. If this isn't a priority right now, no worries at all!\n\nBest regards,\n${senderName}`,
        triggerCondition: nextNum === 3 ? 'no_reply_14d' : 'no_reply_30d'
      }
    ]);
  };

  const handleRemoveStep = (idx: number) => {
    if (wizardSteps.length <= 1) return;
    setWizardSteps(wizardSteps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const handleRecipientFilterChange = (type: 'all' | '7d' | '14d' | '30d' | 'new' | 'custom') => {
    setRecipientFilter(type);
    if (type === 'all') {
      setSelectedLeadIds(activeLeads.map(l => l.id));
    } else if (type === '7d') {
      setSelectedLeadIds(activeLeads.filter(l => l.daysAgo >= 7 && l.status !== 'replied').map(l => l.id));
    } else if (type === '14d') {
      setSelectedLeadIds(activeLeads.filter(l => l.daysAgo >= 14 && l.status !== 'replied').map(l => l.id));
    } else if (type === '30d') {
      setSelectedLeadIds(activeLeads.filter(l => l.daysAgo >= 30 && l.status !== 'replied').map(l => l.id));
    } else if (type === 'new') {
      setSelectedLeadIds(activeLeads.filter(l => l.status === 'new').map(l => l.id));
    }
  };

  const handleToggleLeadSelection = (id: string) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter(lid => lid !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const toggleScheduleActiveDay = (day: string) => {
    if (scheduleActiveDays.includes(day)) {
      if (scheduleActiveDays.length > 1) {
        setScheduleActiveDays(scheduleActiveDays.filter(d => d !== day));
      }
    } else {
      setScheduleActiveDays([...scheduleActiveDays, day]);
    }
  };

  // STEP-BY-STEP VALIDATION: Prevents moving forward if required fields are missing
  const validateCurrentStep = (step: number): boolean => {
    setStepValidationError('');

    if (step === 1) {
      const missing: string[] = [];
      if (!campaignTitle.trim()) missing.push('Campaign Name');
      if (!senderName.trim()) missing.push('Sender Display Name');
      if (!campaignNiche.trim()) missing.push('Target Industry / Niche');

      if (missing.length > 0) {
        setStepValidationError(`⚠️ Missing required fields: ${missing.join(', ')}. Please complete all fields before continuing.`);
        return false;
      }
    }

    if (step === 2) {
      if (activeSmtps.length === 0) {
        setStepValidationError('⚠️ No active SMTP relays connected. Please click "+ Connect New Relay" to connect an Outbound Relay to proceed.');
        return false;
      }
      if (!selectedSmtpId) {
        setStepValidationError('⚠️ Please select an active Outbound SMTP Relay from the list.');
        return false;
      }
    }

    if (step === 3) {
      if (selectedLeadIds.length === 0) {
        setStepValidationError('⚠️ Please select at least 1 verified lead recipient to enroll in this campaign.');
        return false;
      }
    }

    if (step === 4) {
      if (wizardSteps.length === 0) {
        setStepValidationError('⚠️ Please add at least 1 email sequence step.');
        return false;
      }
      for (const st of wizardSteps) {
        if (!st.subject.trim()) {
          setStepValidationError(`⚠️ Step ${st.stepNumber} is missing an Email Subject line.`);
          return false;
        }
        if (!st.body.trim()) {
          setStepValidationError(`⚠️ Step ${st.stepNumber} is missing the email body message.`);
          return false;
        }
      }
    }

    if (step === 5) {
      if (sendMode === 'scheduled') {
        if (!scheduleDate || !scheduleStartTime || !scheduleEndTime) {
          setStepValidationError('⚠️ Please specify a valid dispatch date, start time, and end time.');
          return false;
        }
        if (scheduleActiveDays.length === 0) {
          setStepValidationError('⚠️ Please select at least 1 active dispatch day of the week.');
          return false;
        }
      }
      if (sendingInterval < 2) {
        setStepValidationError('⚠️ Sending interval delay must be at least 2 seconds.');
        return false;
      }
    }

    return true;
  };

  // Apply template directly to chosen step in wizard
  const handleApplyTemplate = (tmpl?: EmailTemplate, targetStepIndex = 0) => {
    if (!tmpl) return;
    setAppliedTemplates(prev => ({
      ...prev,
      [targetStepIndex]: { id: tmpl.id, title: tmpl.title, category: tmpl.category }
    }));
    setWizardSteps(prev => {
      const updated = [...prev];
      if (updated.length > targetStepIndex) {
        updated[targetStepIndex] = {
          ...updated[targetStepIndex],
          subject: tmpl.subject || '',
          body: tmpl.body || ''
        };
      } else {
        updated.push({
          stepNumber: updated.length + 1,
          delayDays: updated.length === 0 ? 0 : 7,
          subject: tmpl.subject || '',
          body: tmpl.body || '',
          triggerCondition: 'no_reply_7d'
        });
      }
      return updated;
    });
    addNotification({
      title: `Template Loaded: "${tmpl.title || 'Selected Template'}" 📄`,
      message: `Subject and body applied into Sequence Step ${targetStepIndex + 1}.`,
      type: 'campaign'
    });
  };

  // Save new template from inside wizard with tags
  const handleSaveNewTemplateInWizard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTmplTitle.trim() || !newTmplSubject.trim() || !newTmplBody.trim()) return;

    const parsedTags = newTmplTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const tmpl = addEmailTemplate({
      title: newTmplTitle.trim(),
      subject: newTmplSubject.trim(),
      body: newTmplBody.trim(),
      category: newTmplCategory,
      tags: parsedTags.length > 0 ? parsedTags : ['Custom', 'Wizard']
    });

    handleApplyTemplate(tmpl);
    setNewTmplTitle('');
    setNewTmplSubject('');
    setNewTmplBody('');
    setNewTmplTags('Cold Outreach, High Intent');
    setShowCreateTemplateInWizard(false);
  };

  const handleCreateNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatLabel.trim()) return;
    const cat = addTemplateCategory({
      name: newCatLabel.toLowerCase().replace(/\s+/g, '_'),
      label: newCatLabel.trim(),
      color: 'cyan'
    });
    setSelectedTemplateCat(cat.id);
    setNewCatLabel('');
    setShowAddCategoryModal(false);
  };

  // EXECUTE LIVE REAL-TIME DISPATCH WITH CONFIGURABLE DELAY
  const startLiveDispatcher = async (
    targetCampaign: Campaign, 
    overrideLeadIds?: string[], 
    overrideSteps?: CampaignStep[],
    overrideSmtpId?: string,
    overrideInterval?: number
  ) => {
    setShowWizardModal(false);
    setShowLiveDispatcher(true); // Open live dispatcher engine modal so user sees real-time progress!
    setIsDispatching(true);
    setIsPaused(false);
    abortDispatchRef.current = false;

    // Resolve leads with full fallback safety
    const candidateLeadIds = (overrideLeadIds && overrideLeadIds.length > 0)
      ? overrideLeadIds
      : (targetCampaign?.leadIds && targetCampaign.leadIds.length > 0)
      ? targetCampaign.leadIds
      : (selectedLeadIds && selectedLeadIds.length > 0)
      ? selectedLeadIds
      : activeLeads.map(l => l.id);

    let targetLeads = leads.filter(l => !l.isTrash && candidateLeadIds.includes(l.id));

    // Fallback: If still 0, pick active non-trash leads
    if (targetLeads.length === 0) {
      targetLeads = leads.filter(l => !l.isTrash).slice(0, 20);
    }

    if (targetLeads.length === 0) {
      addNotification({
        title: 'Cannot Start Campaign: No Leads ⚠️',
        message: 'There are no active leads available. Please add or import leads in the Lead Directory.',
        type: 'lead',
        linkTab: 'leads'
      });
      setIsDispatching(false);
      setShowLiveDispatcher(false);
      return;
    }

    const useSmtpId = overrideSmtpId || targetCampaign?.assignedSmtpId || selectedSmtpId;
    const isRoundRobin = useSmtpId === 'round_robin' || !useSmtpId;
    const fixedSmtp = smtpAccounts.find(s => s.id === useSmtpId) || 
                      smtpAccounts.find(s => s.status === 'connected') || 
                      smtpAccounts[0];

    const initialStep = (overrideSteps && overrideSteps.length > 0 ? overrideSteps : (targetCampaign?.steps && targetCampaign.steps.length > 0 ? targetCampaign.steps : wizardSteps))[0] || {
      stepNumber: 1,
      delayDays: 0,
      subject: targetCampaign?.name || 'Outreach Campaign',
      body: 'Hi {{name}},\n\nReaching out regarding {{company}}.',
      triggerCondition: 'all' as const
    };
    const intervalSec = overrideInterval !== undefined ? overrideInterval : (targetCampaign?.sendingIntervalSec || sendingInterval);

    addNotification({
      title: `Campaign Started: "${targetCampaign.name}" 🚀`,
      message: `Sequenced dispatch started for ${targetLeads.length} leads in the background.`,
      type: 'campaign'
    });

    setDispatchProgress({
      currentLeadIndex: 0,
      totalLeads: targetLeads.length,
      currentLeadName: targetLeads[0]?.name || '',
      currentLeadEmail: targetLeads[0]?.email || '',
      currentLeadCompany: targetLeads[0]?.company || '',
      secondsUntilNext: 0,
      sentLogs: []
    });

    let sentSoFar = 0;

    for (let i = 0; i < targetLeads.length; i++) {
      if (abortDispatchRef.current) {
        break;
      }

      const lead = targetLeads[i];
      const activePool = selectedSmtpIds.length > 0
        ? activeSmtps.filter(s => selectedSmtpIds.includes(s.id))
        : activeSmtps;
      const smtp = isRoundRobin
        ? (activePool[i % (activePool.length || 1)] || fixedSmtp)
        : fixedSmtp;

      // Handle pause loop
      while (isPausedRef.current && !abortDispatchRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }
      if (abortDispatchRef.current) break;

      setDispatchProgress(prev => ({
        ...prev,
        currentLeadIndex: i + 1,
        currentLeadName: lead.name,
        currentLeadEmail: lead.email,
        currentLeadCompany: lead.company,
        secondsUntilNext: 0
      }));

      // Render tokens
      const rawSubject = initialStep?.subject || targetCampaign?.name || 'Cold Outreach';
      const rawBody = initialStep?.body || 'Hi {{name}},\n\nReaching out regarding {{company}}.';

      const renderedSubject = rawSubject
        .replace(/\{\{name\}\}/gi, lead.name || 'there')
        .replace(/\{\{company\}\}/gi, lead.company || 'your company')
        .replace(/\{\{title\}\}/gi, lead.title || 'Executive');

      const renderedBody = rawBody
        .replace(/\{\{name\}\}/gi, lead.name || 'there')
        .replace(/\{\{company\}\}/gi, lead.company || 'your company')
        .replace(/\{\{title\}\}/gi, lead.title || 'Executive');

      // Send via real backend SMTP relay route
      const trackingPixelId = `px-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let isSentSuccess = false;
      let sendErrorMessage = '';

      try {
        const res = await fetch('/api/smtp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lead.email,
            toName: lead.name,
            from: smtp?.fromEmail || smtp?.username || 'outreach@visualsky.io',
            fromName: senderName || smtp?.fromName || 'Visual Sky Outreach',
            subject: renderedSubject,
            text: renderedBody,
            smtpConfig: smtp,
            trackingPixelId
          })
        });
        const parsed = await safeParseResponse(res, 'SMTP relay connection failed');
        const data = parsed.data || {};
        if (parsed.ok && data.success) {
          isSentSuccess = true;
        } else {
          isSentSuccess = false;
          sendErrorMessage = data.error || `HTTP error ${res.status}`;
        }
      } catch (err: any) {
        isSentSuccess = false;
        sendErrorMessage = err?.message || 'Network error connecting to SMTP relay';
      }

      if (isSentSuccess) {
        sentSoFar++;

        // Record in sent log
        addSentEmailLog({
          campaignId: targetCampaign.id,
          campaignName: targetCampaign.name,
          recipientName: lead.name,
          recipientEmail: lead.email,
          recipientCompany: lead.company,
          subject: renderedSubject,
          body: renderedBody,
          smtpAccountName: smtp?.name || 'SMTP Relay',
          smtpHost: `${smtp?.host || 'smtp.relay'}:${smtp?.port || 587}`,
          status: 'sent',
          openCount: 0,
          trackingPixelId
        });

        // Update lead
        updateLead(lead.id, {
          status: 'contacted',
          daysAgo: 0,
          lastActivityDate: new Date().toISOString(),
          sentCampaigns: Array.from(new Set([...lead.sentCampaigns, targetCampaign.name]))
        });

        // Update campaign stats
        updateCampaign(targetCampaign.id, {
          sentCount: sentSoFar
        });

        setDispatchProgress(prev => ({
          ...prev,
          sentLogs: [
            `[DELIVERED] ✓ Dispatched to ${lead.name} (${lead.email}) via ${smtp?.name || 'Relay'} at ${new Date().toLocaleTimeString()}`,
            ...prev.sentLogs
          ]
        }));
      } else {
        // Record as failed transmission
        addSentEmailLog({
          campaignId: targetCampaign.id,
          campaignName: targetCampaign.name,
          recipientName: lead.name,
          recipientEmail: lead.email,
          recipientCompany: lead.company,
          subject: renderedSubject,
          body: renderedBody,
          smtpAccountName: smtp?.name || 'SMTP Relay',
          smtpHost: `${smtp?.host || 'smtp.relay'}:${smtp?.port || 587}`,
          status: 'failed',
          errorMessage: sendErrorMessage,
          openCount: 0,
          trackingPixelId
        });

        setDispatchProgress(prev => ({
          ...prev,
          sentLogs: [
            `[FAILED] ✗ Could not send to ${lead.name} (${lead.email}): ${sendErrorMessage}`,
            ...prev.sentLogs
          ]
        }));

        addNotification({
          title: `SMTP Relay Error: ${lead.name}`,
          message: `Failed sending to ${lead.email}: ${sendErrorMessage}`,
          type: 'smtp'
        });
      }

      // If not last lead and delay interval is configured, countdown!
      if (i < targetLeads.length - 1 && intervalSec > 0) {
        const actualInterval = enableJitter 
          ? Math.max(2, intervalSec + Math.floor(Math.random() * 5) - 2) 
          : intervalSec;

        for (let sec = actualInterval; sec > 0; sec--) {
          if (abortDispatchRef.current) break;
          while (isPausedRef.current && !abortDispatchRef.current) {
            await new Promise(r => setTimeout(r, 400));
          }
          if (abortDispatchRef.current) break;

          setDispatchProgress(prev => ({
            ...prev,
            secondsUntilNext: sec
          }));
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    setIsDispatching(false);
  };

  const handleStopDispatch = () => {
    abortDispatchRef.current = true;
    setIsDispatching(false);
    setIsPaused(false);
    addNotification({
      title: 'Dispatch Halted ⏹️',
      message: 'Email sequence transmission was stopped.',
      type: 'system'
    });
  };

  const handleLaunchCampaign = () => {
    if (!validateCurrentStep(wizardStep)) return;

    if (editingCampaignId) {
      // EDIT MODE: Update existing campaign
      updateCampaign(editingCampaignId, {
        name: campaignTitle,
        niche: campaignNiche,
        totalLeads: selectedLeadIds.length,
        leadIds: selectedLeadIds,
        steps: wizardSteps,
        sendMode,
        scheduledTime: sendMode === 'scheduled' ? `${scheduleDate}T${scheduleStartTime}:00` : undefined,
        scheduleStartTime,
        scheduleEndTime,
        scheduleTimezone,
        scheduleActiveDays,
        sendingIntervalSec: sendingInterval,
        assignedSmtpId: selectedSmtpId
      });
      setShowWizardModal(false);
      setEditingCampaignId(null);
      addNotification({
        title: `Campaign Updated: "${campaignTitle}" ✏️`,
        message: 'Campaign sequences, schedule, and lead configurations updated.',
        type: 'campaign'
      });
      return;
    }

    // CREATE MODE: Create new campaign
    const targetLeadIds = selectedLeadIds.length > 0 ? selectedLeadIds : activeLeads.map(l => l.id);
    const newCamp = createCampaign({
      name: campaignTitle,
      niche: campaignNiche,
      status: 'running',
      totalLeads: targetLeadIds.length,
      leadIds: targetLeadIds,
      steps: wizardSteps,
      sendMode,
      scheduledTime: sendMode === 'scheduled' ? `${scheduleDate}T${scheduleStartTime}:00` : undefined,
      scheduleStartTime,
      scheduleEndTime,
      scheduleTimezone,
      scheduleActiveDays,
      sendingIntervalSec: sendingInterval,
      assignedSmtpId: selectedSmtpId
    });

    // Directly start live dispatcher with the selected leads
    startLiveDispatcher(newCamp, targetLeadIds);
  };

  // Dormant counts
  const dormant7d = leads.filter(l => !l.isTrash && l.daysAgo >= 7 && l.status !== 'replied').length;
  const dormant14d = leads.filter(l => !l.isTrash && l.daysAgo >= 14 && l.status !== 'replied').length;
  const dormant30d = leads.filter(l => !l.isTrash && l.daysAgo >= 30 && l.status !== 'replied').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Send className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
              Campaign Launch Wizard & Automated Sequences
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Build high-converting multi-step cold outreach sequences with AI token personalization, tag-based audience targeting, and real-time live dispatch controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleOpenWizard}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:via-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Launch Campaign Wizard</span>
          </button>
        </div>
      </div>

      {/* ACTIVE REAL-TIME DISPATCHING BANNER */}
      {isDispatching && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-cyan-950/90 via-blue-950/90 to-slate-900 border-2 border-cyan-500/60 shadow-2xl shadow-cyan-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
              <Send className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-black text-white">Campaign Live Dispatch Active</span>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-bold animate-pulse">
                  ● Sending
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono">
                  {dispatchProgress.currentLeadIndex} of {dispatchProgress.totalLeads} leads processed
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Currently dispatching to <strong className="text-white">{dispatchProgress.currentLeadName || 'Recipient'}</strong> ({dispatchProgress.currentLeadEmail || '...'})
                {dispatchProgress.secondsUntilNext > 0 && (
                  <span className="ml-2 text-cyan-300 font-mono font-bold">
                    • Next email in {dispatchProgress.secondsUntilNext}s
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => setShowLiveDispatcher(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Activity className="w-4 h-4" />
              <span>View Dispatch Engine</span>
            </button>
            <button
              onClick={handleStopDispatch}
              className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 text-xs font-bold transition cursor-pointer"
            >
              <span>Stop Dispatch</span>
            </button>
          </div>
        </div>
      )}

      {/* 1-CLICK FOLLOW-UP COHORTS SECTION */}
      <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">1-Click Smart Follow-Up Automation Engine</h2>
              <p className="text-xs text-slate-400">Re-engage inactive leads who have not replied in 7, 14, or 30 days.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleOpenFollowUpCohort('7d')}
            className="p-4 rounded-2xl bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-400 transition text-left flex flex-col justify-between cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-purple-300">7-Day Inactive Follow-Up</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 font-mono text-[11px] font-bold">
                {dormant7d} Leads
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
              Gentle check-in touching base on initial proposal with zero friction.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-400 mt-3 group-hover:underline">
              <span>Select Leads & Launch Cohort</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenFollowUpCohort('14d')}
            className="p-4 rounded-2xl bg-blue-950/20 hover:bg-blue-950/40 border border-blue-500/30 hover:border-blue-400 transition text-left flex flex-col justify-between cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-blue-300">14-Day Value-Add Follow-Up</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 font-mono text-[11px] font-bold">
                {dormant14d} Leads
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
              Share concrete deliverability case studies and industry benchmarks.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-400 mt-3 group-hover:underline">
              <span>Select Leads & Launch Cohort</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenFollowUpCohort('30d')}
            className="p-4 rounded-2xl bg-amber-950/20 hover:bg-amber-950/40 border border-amber-500/30 hover:border-amber-400 transition text-left flex flex-col justify-between cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-amber-300">30-Day Breakup Follow-Up</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-mono text-[11px] font-bold">
                {dormant30d} Leads
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
              Clean close-out message that triggers reverse psychology replies.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 mt-3 group-hover:underline">
              <span>Select Leads & Launch Cohort</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>

      {/* ACTIVE CAMPAIGNS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Active Campaign Sequences ({activeCampaigns.length})</h2>
          </div>
        </div>

        {activeCampaigns.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
            <Send className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">No campaigns launched yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first automated cold email sequence to start booking meetings on autopilot.
            </p>
            <button
              onClick={handleOpenWizard}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Launch First Campaign</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeCampaigns.map((camp) => {
              const assignedSmtp = smtpAccounts.find(s => s.id === camp.assignedSmtpId);
              return (
                <div
                  key={camp.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        camp.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {camp.status === 'running' ? '● Running' : '⏸ Paused'}
                      </span>
                      <h3 className="font-bold text-base text-slate-100">{camp.name}</h3>
                      <span className="text-xs text-slate-400 font-mono">({camp.niche})</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <strong className="text-slate-200">{camp.totalLeads}</strong> leads enrolled
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="w-3.5 h-3.5 text-purple-400" />
                        <strong className="text-slate-200">{camp.sentCount}</strong> dispatched
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <strong className="text-slate-200">{camp.steps?.length || 1}</strong> sequence steps
                      </span>
                      {camp.sendingIntervalSec && (
                        <span className="flex items-center gap-1 font-mono text-cyan-300">
                          <Clock className="w-3.5 h-3.5" />
                          {camp.sendingIntervalSec}s interval delay
                        </span>
                      )}
                      {camp.assignedSmtpId === 'round_robin' || !camp.assignedSmtpId ? (
                        <span className="flex items-center gap-1 text-[11px] text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-lg border border-cyan-800/40 font-mono">
                          <Server className="w-3 h-3 text-cyan-400" />
                          <span>⚡ Smart Round-Robin</span>
                        </span>
                      ) : assignedSmtp ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-200 bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700 font-mono">
                          <Server className="w-3 h-3 text-cyan-400" />
                          <span>{assignedSmtp.name}</span>
                        </span>
                      ) : null}
                      {camp.sendMode === 'scheduled' && camp.scheduleStartTime && (
                        <span className="flex items-center gap-1 text-[11px] text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-500/30 font-mono">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          <span>{camp.scheduleStartTime}-{camp.scheduleEndTime}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* EDIT CAMPAIGN BUTTON (Explicit User Request) */}
                    <button
                      onClick={() => handleOpenEditWizard(camp)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                      title="Edit Campaign Sequence, Steps, Schedule & Leads"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        if (camp.status === 'running') {
                          toggleCampaignStatus(camp.id);
                          handleStopDispatch();
                        } else {
                          toggleCampaignStatus(camp.id);
                          startLiveDispatcher(camp);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {camp.status === 'running' ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{camp.status === 'running' ? 'Pause' : 'Start & Dispatch'}</span>
                    </button>

                    <button
                      onClick={() => setCampaignToDelete(camp)}
                      className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 flex items-center justify-center transition cursor-pointer"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULL-FEATURED 1-CLICK FOLLOW-UP COHORT MODAL (Explicit User Request) */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#090d16] border border-purple-500/40 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-100 text-base">
                  Launch {followUpDays.toUpperCase()} Unreplied Follow-Up Cohort Sequence
                </h3>
              </div>
              <button 
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Cohort Summary Bar */}
              <div className="p-3.5 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-purple-300 font-medium">
                  Target Cohort: Leads unreplied for &gt;= {followUpDays}
                </span>
                <span className="px-2.5 py-1 bg-purple-500/20 text-purple-200 font-mono font-extrabold rounded-lg">
                  {followUpSelectedLeadIds.length} / {cohortDormantLeads.length} Leads Selected
                </span>
              </div>

              {/* Lead Search & Select All Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-300">Enrolled Inactive Leads</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFollowUpSelectedLeadIds(cohortDormantLeads.map(l => l.id))}
                      className="text-cyan-400 hover:underline font-bold"
                    >
                      Select All ({cohortDormantLeads.length})
                    </button>
                    <span className="text-slate-700">&bull;</span>
                    <button
                      type="button"
                      onClick={() => setFollowUpSelectedLeadIds([])}
                      className="text-rose-400 hover:underline font-bold"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={followUpLeadSearch}
                    onChange={(e) => setFollowUpLeadSearch(e.target.value)}
                    placeholder="Search dormant leads by name, company, email, tag..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-400"
                  />
                </div>

                {/* Lead List Checkboxes */}
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-2xl bg-slate-900/60">
                  {cohortDormantLeads.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No dormant leads matching search criteria
                    </div>
                  ) : (
                    cohortDormantLeads.map(lead => {
                      const isSelected = followUpSelectedLeadIds.includes(lead.id);
                      return (
                        <div
                          key={lead.id}
                          onClick={() => toggleFollowUpLead(lead.id)}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-800/50 transition ${
                            isSelected ? 'bg-purple-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-700 text-purple-500 focus:ring-purple-500 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-100 truncate">{lead.name}</span>
                                <span className="text-slate-400 font-mono text-[11px] truncate">({lead.company})</span>
                                {lead.tags && lead.tags.map((t, idx) => (
                                  <span key={idx} className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getLeadTagColorClass(t)}`}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">{lead.email}</div>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                            {lead.daysAgo}d inactive
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SMTP Relay Selection */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-300">Outbound SMTP Relay</label>
                  <button
                    type="button"
                    onClick={() => setShowSmtpModalInWizard(true)}
                    className="text-cyan-400 hover:underline font-bold text-[11px]"
                  >
                    + Connect New Relay
                  </button>
                </div>
                <select
                  value={followUpSmtpId}
                  onChange={(e) => setFollowUpSmtpId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400 font-mono text-xs"
                >
                  {activeSmtps.map(smtp => (
                    <option key={smtp.id} value={smtp.id}>
                      {smtp.name} ({smtp.username} - {smtp.host}:{smtp.port})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject & Body */}
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Follow-up Subject Line</label>
                  <input
                    type="text"
                    value={followUpSubject}
                    onChange={(e) => setFollowUpSubject(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Follow-up Message Template</label>
                  <textarea
                    rows={4}
                    value={followUpBody}
                    onChange={(e) => setFollowUpBody(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-100 font-sans focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Sending Mode & Delay */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Dispatch Mode</label>
                  <select
                    value={followUpSendMode}
                    onChange={(e) => setFollowUpSendMode(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400"
                  >
                    <option value="instant">⚡ Instant Live Dispatch</option>
                    <option value="scheduled">📅 Scheduled Sequence</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Sending Interval Delay</label>
                  <select
                    value={followUpInterval}
                    onChange={(e) => setFollowUpInterval(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400 font-mono"
                  >
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds (Recommended)</option>
                    <option value="30">30 seconds</option>
                    <option value="60">60 seconds</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">Tokens: &#123;&#123;name&#125;&#125;, &#123;&#123;company&#125;&#125;</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteFollowUpModal}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-500/25 cursor-pointer"
                >
                  🚀 Launch Follow-Up Cohort ({followUpSelectedLeadIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6-STEP CAMPAIGN LAUNCH WIZARD MODAL */}
      {showWizardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-900 to-cyan-950/40 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Send className="w-5 h-5 text-cyan-400" />
                  <span>{editingCampaignId ? 'Edit Campaign Sequence' : 'Campaign Launch Wizard & Sequences'}</span>
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  Step {wizardStep} of 6: {
                    wizardStep === 1 ? 'Campaign Title & Identity' :
                    wizardStep === 2 ? 'Outbound SMTP Relay Selection' :
                    wizardStep === 3 ? 'Recipient Audience Cohort' :
                    wizardStep === 4 ? 'Sequence Steps & Templates' :
                    wizardStep === 5 ? 'Delay & Schedule Window' :
                    'Review & Final Launch'
                  }
                </div>
              </div>

              <button
                onClick={() => setShowWizardModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Progress Pills */}
            <div className="flex overflow-x-auto sm:grid sm:grid-cols-6 border-b border-slate-800 bg-slate-950/60 text-[10px] sm:text-xs font-bold text-center no-scrollbar">
              {['1. Identity', '2. SMTP Relay', '3. Recipients', '4. Templates', '5. Delay & Schedule', '6. Launch'].map((label, idx) => {
                const sNum = idx + 1;
                const isCurrent = wizardStep === sNum;
                const isDone = wizardStep > sNum;
                return (
                  <button
                    key={sNum}
                    type="button"
                    onClick={() => {
                      if (sNum < wizardStep) setWizardStep(sNum);
                      else if (validateCurrentStep(wizardStep)) setWizardStep(sNum);
                    }}
                    className={`py-2.5 px-3 sm:px-1 border-r border-slate-800/80 shrink-0 transition cursor-pointer ${
                      isCurrent ? 'bg-cyan-500/10 text-cyan-300 border-b-2 border-b-cyan-400' :
                      isDone ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isDone ? `✓ ${label.split(' ')[1]}` : label}
                  </button>
                );
              })}
            </div>

            {/* Step Validation Error Notification */}
            {stepValidationError && (
              <div className="p-3 bg-rose-950/70 border-b border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{stepValidationError}</span>
              </div>
            )}

            {/* Wizard Body Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              
              {/* STEP 1: Basic Campaign Info */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Campaign Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      placeholder="e.g. Q3 Founders Outreach Cohort"
                      className={`w-full bg-slate-900 border rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none font-semibold ${
                        !campaignTitle.trim() && stepValidationError ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-cyan-500'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-300">
                        Sender Display Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="e.g. Alex Vance | Visual Sky"
                        className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none ${
                          !senderName.trim() && stepValidationError ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-cyan-500'
                        }`}
                      />
                      <span className="text-[10px] text-slate-500">From Name displayed on outbound emails</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-300">
                        Target Industry / Niche <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={campaignNiche}
                        onChange={(e) => setCampaignNiche(e.target.value)}
                        placeholder="e.g. B2B SaaS & Tech Founders"
                        className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none ${
                          !campaignNiche.trim() && stepValidationError ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-cyan-500'
                        }`}
                      />
                      <span className="text-[10px] text-slate-500">Segment tag for campaign performance tracking</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SMTP Relay Selection + Multi-Tag Filter + Inline Connect */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Top Provider / Cohort Tabs & Action Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>SMTP Outbound Dispatchers</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-mono lowercase">
                        {selectedSmtpIds.length} / {activeSmtps.length} selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Integrated SMTP Connect Button */}
                      <button
                        type="button"
                        onClick={() => setShowSmtpModalInWizard(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-cyan-500/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Connect New Relay / Webmail</span>
                      </button>
                    </div>
                  </div>

                  {activeSmtps.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-3">
                      <Server className="w-10 h-10 text-slate-600 mx-auto" />
                      <div className="text-sm font-bold text-slate-300">No active SMTP relays connected</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        You need at least one connected domain webmail or SMTP relay account to send campaign emails.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowSmtpModalInWizard(true)}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Connect Outbound Relay Now</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Provider Filter Tabs */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                        {[
                          { id: 'all', label: `All Relays (${activeSmtps.length})` },
                          { id: 'google', label: 'Google Workspace' },
                          { id: 'cpanel', label: 'cPanel / Hostinger' },
                          { id: 'ses', label: 'Amazon SES' },
                          { id: 'webmail', label: 'Domain Webmail' },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSmtpProviderFilter(tab.id as any)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                              smtpProviderFilter === tab.id
                                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* MANAGE SMTP TAGS SELECTOR BAR */}
                      <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase text-slate-300 flex items-center gap-1.5">
                            <TagIcon className="w-3.5 h-3.5 text-cyan-400" />
                            Target / Filter Relays by SMTP Tags & Domains
                          </span>
                          {selectedSmtpTags.length > 0 && (
                            <button
                              type="button"
                              onClick={clearSmtpTagFilters}
                              className="text-[10px] text-rose-400 hover:underline font-bold cursor-pointer"
                            >
                              Clear Tag Filters ({selectedSmtpTags.length})
                            </button>
                          )}
                        </div>

                        {/* Available SMTP Tag Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {allSmtpTags.map(tagName => {
                            const isTagSelected = selectedSmtpTags.includes(tagName);
                            const count = activeSmtps.filter(s => {
                              if (tagName === 'Domain Webmail') return !!s.domainWebmailUrl;
                              if (tagName === 'Google Workspace') return s.provider.toLowerCase().includes('google') || s.host.includes('google');
                              if (tagName === 'cPanel / Hostinger') return s.provider.toLowerCase().includes('cpanel') || s.provider.toLowerCase().includes('hostinger');
                              if (tagName === 'Amazon SES') return s.provider.toLowerCase().includes('ses') || s.provider.toLowerCase().includes('amazon');
                              if (tagName === '99%+ Health') return (s.healthScore || 0) >= 99;
                              return s.host.toLowerCase().includes(tagName.toLowerCase()) || s.provider.toLowerCase().includes(tagName.toLowerCase()) || s.name.toLowerCase().includes(tagName.toLowerCase());
                            }).length;

                            return (
                              <button
                                key={tagName}
                                type="button"
                                onClick={() => handleToggleSmtpTag(tagName)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                                  isTagSelected
                                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <span>{tagName}</span>
                                {isTagSelected ? (
                                  <Check className="w-3 h-3 text-black stroke-[3]" />
                                ) : (
                                  <span className="text-[10px] text-slate-500">
                                    ({count})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-900 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllMatchingTagSmtps}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                            >
                              <CheckSquare className="w-3 h-3" />
                              <span>Select SMTPs Matching Filter</span>
                            </button>

                            <button
                              type="button"
                              onClick={selectOnlyDisplayedSmtps}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                            >
                              <span>Select Only Filtered ({displayedWizardSmtps.length})</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllActiveSmtps}
                              className="text-[11px] text-cyan-400 hover:underline font-bold cursor-pointer"
                            >
                              Select All Relays ({activeSmtps.length})
                            </button>
                            <span className="text-slate-700">&bull;</span>
                            <button
                              type="button"
                              onClick={deselectAllSmtps}
                              className="text-[11px] text-rose-400 hover:underline font-medium cursor-pointer"
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SMTP Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={smtpSearchQuery}
                          onChange={(e) => setSmtpSearchQuery(e.target.value)}
                          placeholder="Search connected relays by custom name, username, host, or provider..."
                          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                        {smtpSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSmtpSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Cluster Mode Banner */}
                      {selectedSmtpIds.length > 1 && (
                        <div className="p-3 bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            <span className="text-slate-200 font-bold">
                              ⚡ Smart Round-Robin Rotation Active across {selectedSmtpIds.length} chosen relays
                            </span>
                          </div>
                          <span className="text-[10px] text-cyan-300 font-mono font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                            Dynamic Rotation
                          </span>
                        </div>
                      )}

                      {/* Selected SMTP Relays Active Chips */}
                      {selectedSmtpIds.length > 0 && (
                        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-400">Attached ({selectedSmtpIds.length}):</span>
                          {selectedSmtpIds.map(id => {
                            const smtpAcc = activeSmtps.find(s => s.id === id);
                            if (!smtpAcc) return null;
                            return (
                              <div
                                key={id}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-950/80 text-cyan-200 border border-cyan-700/60 text-xs font-mono"
                              >
                                <span className="font-bold truncate max-w-[140px]">{smtpAcc.name}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSmtpSelection(id);
                                  }}
                                  title="Remove from campaign"
                                  className="w-3.5 h-3.5 rounded bg-cyan-900/80 hover:bg-rose-900/90 text-cyan-300 hover:text-rose-200 flex items-center justify-center transition cursor-pointer"
                                >
                                  &times;
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Individual Connected SMTP Accounts List with Checkboxes */}
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-2xl bg-slate-900/60">
                        {displayedWizardSmtps.length === 0 ? (
                          <div className="p-8 text-center space-y-2">
                            <Server className="w-8 h-8 text-slate-600 mx-auto" />
                            <div className="text-xs font-bold text-slate-400">No connected SMTP accounts match the filter</div>
                            <button
                              type="button"
                              onClick={() => {
                                setSmtpProviderFilter('all');
                                clearSmtpTagFilters();
                                setSmtpSearchQuery('');
                              }}
                              className="text-xs text-cyan-400 hover:underline font-bold"
                            >
                              Clear Filters & Show All
                            </button>
                          </div>
                        ) : (
                          displayedWizardSmtps.map((smtp) => {
                            const isSelected = selectedSmtpIds.includes(smtp.id);
                            return (
                              <div
                                key={smtp.id}
                                onClick={() => handleToggleSmtpSelection(smtp.id)}
                                className={`p-3.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-800/50 transition ${
                                  isSelected ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 shrink-0 w-4 h-4 cursor-pointer"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* CUSTOM ACCOUNT NAME GIVEN BY USER */}
                                      <span className="font-extrabold text-slate-100 text-xs truncate">
                                        {smtp.name}
                                      </span>
                                      
                                      {smtp.domainWebmailUrl ? (
                                        <span className="text-[10px] text-cyan-300 font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60">
                                          🌐 Domain Webmail
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-300 font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                          📧 {smtp.provider}
                                        </span>
                                      )}

                                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                        Connected
                                      </span>
                                    </div>

                                    <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                      <strong className="text-slate-300 font-medium">{smtp.username}</strong> &bull; {smtp.host}:{smtp.port} ({smtp.encryption})
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0 text-right">
                                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
                                    {smtp.sentToday || 0}/{smtp.dailyLimit || 500} today
                                  </span>
                                  <span className="text-xs font-bold text-emerald-400 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    {smtp.healthScore || 99.8}% Health
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Recipients Selection with Multi-Tag Filter & Direct Tag Selector */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Top Cohort & Search Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>Audience Selection</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-mono lowercase">
                        {selectedLeadIds.length} / {activeLeads.length} selected
                      </span>
                    </div>

                    {/* Status / Cohort Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'new', label: 'New' },
                        { id: '7d', label: '7d+ Inactive' },
                        { id: '14d', label: '14d+ Inactive' },
                        { id: '30d', label: '30d+ Inactive' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => handleRecipientFilterChange(tab.id as any)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                            recipientFilter === tab.id
                              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MANAGE TAGS SELECTOR BAR */}
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-300 flex items-center gap-1.5">
                        <TagIcon className="w-3.5 h-3.5 text-cyan-400" />
                        Target Audience by Lead Tags
                      </span>
                      {selectedLeadTags.length > 0 && (
                        <button
                          type="button"
                          onClick={clearLeadTagFilters}
                          className="text-[10px] text-rose-400 hover:underline font-bold cursor-pointer"
                        >
                          Clear Tag Filters ({selectedLeadTags.length})
                        </button>
                      )}
                    </div>

                    {/* Available Tag Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {leadTags.map(t => {
                        const isTagSelected = selectedLeadTags.includes(t.name);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToggleTagFilter(t.name)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                              isTagSelected
                                ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span>{t.name}</span>
                            {isTagSelected ? (
                              <Check className="w-3 h-3 text-black stroke-[3]" />
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                ({activeLeads.filter(l => l.tags.includes(t.name)).length})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllMatchingTagLeads}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <CheckSquare className="w-3 h-3" />
                          <span>Select Leads Matching Tags</span>
                        </button>

                        <button
                          type="button"
                          onClick={selectOnlyDisplayedLeads}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>Select Only Filtered ({displayedWizardLeads.length})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllActiveLeads}
                          className="text-[11px] text-slate-400 hover:text-white font-medium cursor-pointer"
                        >
                          Select All ({activeLeads.length})
                        </button>
                        <span className="text-slate-700">&bull;</span>
                        <button
                          type="button"
                          onClick={deselectAllLeads}
                          className="text-[11px] text-rose-400 hover:underline font-medium cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search Bar inside Step 3 */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={wizardLeadSearch}
                      onChange={(e) => setWizardLeadSearch(e.target.value)}
                      placeholder="Search recipients by name, company, email, or tag..."
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                    {wizardLeadSearch && (
                      <button
                        type="button"
                        onClick={() => setWizardLeadSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Recipients List with Tag Badges */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-2xl bg-slate-900/60">
                    {displayedWizardLeads.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <Users className="w-8 h-8 text-slate-600 mx-auto" />
                        <div className="text-xs font-bold text-slate-400">No leads match the active filter or tags</div>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientFilter('all');
                            clearLeadTagFilters();
                            setWizardLeadSearch('');
                          }}
                          className="text-xs text-cyan-400 hover:underline font-bold"
                        >
                          Clear Filters & Show All
                        </button>
                      </div>
                    ) : (
                      displayedWizardLeads.map(lead => {
                        const isSelected = selectedLeadIds.includes(lead.id);
                        return (
                          <div
                            key={lead.id}
                            onClick={() => handleToggleLeadSelection(lead.id)}
                            className={`p-3 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-800/50 transition ${
                              isSelected ? 'bg-cyan-950/25 border-l-2 border-l-cyan-400' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-100 truncate">{lead.name}</span>
                                  {lead.title && (
                                    <span className="text-[10px] text-slate-400 truncate">({lead.title})</span>
                                  )}
                                  
                                  {/* Lead Assigned Tags */}
                                  {lead.tags && lead.tags.map((t, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getLeadTagColorClass(t)}`}
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">
                                  {lead.email} &bull; <strong className="text-slate-300">{lead.company}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                lead.daysAgo === 0
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {lead.daysAgo === 0 ? 'Active today' : `${lead.daysAgo}d inactive`}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: Sequence Steps & Saved Category Templates with Tag Search */}
              {wizardStep === 4 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Saved Templates & Category Bar */}
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5 uppercase">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        Select Saved Template or Create New
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateTemplateInWizard(true)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ New Template</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddCategoryModal(true)}
                          className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
                        >
                          + Category
                        </button>
                      </div>
                    </div>

                    {/* Template Search Bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={templateSearchQuery}
                        onChange={(e) => setTemplateSearchQuery(e.target.value)}
                        placeholder="Search templates by title, subject, or tag..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedTemplateCat('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                          selectedTemplateCat === 'all' ? 'bg-cyan-500 text-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        All Categories ({emailTemplates.length})
                      </button>
                      {templateCategories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedTemplateCat(cat.id)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                            selectedTemplateCat === cat.id ? 'bg-cyan-500 text-black' : 'bg-slate-900 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Template Tag Filter Chips (Explicit User Request) */}
                    {allTemplateTags.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-900">
                        <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Tags:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateTag('all')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                            selectedTemplateTag === 'all' ? 'bg-cyan-500 text-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          All Tags
                        </button>
                        {allTemplateTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedTemplateTag(tag)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                              selectedTemplateTag === tag ? 'bg-cyan-500 text-black' : 'bg-slate-900 text-slate-300 border border-slate-800'
                            }`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Template Pills Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pt-1">
                      {filteredTemplates.length === 0 ? (
                        <div className="col-span-2 p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                          No email templates found matching active filters.
                        </div>
                      ) : (
                        filteredTemplates.map(tmpl => {
                          const activeStepEntry = (Object.entries(appliedTemplates) as [string, { id: string; title: string; category: string }][]).find(([_, t]) => t.id === tmpl.id);
                          const isCurrentlyActive = !!activeStepEntry;
                          const activeStepNum = activeStepEntry ? Number(activeStepEntry[0]) + 1 : null;

                          return (
                            <div
                              key={tmpl.id}
                              className={`p-3 rounded-2xl flex flex-col justify-between gap-2 transition group ${
                                isCurrentlyActive
                                  ? 'bg-cyan-950/50 border-2 border-cyan-400 shadow-lg shadow-cyan-500/20'
                                  : 'bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50'
                              }`}
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-extrabold text-xs text-slate-100 truncate group-hover:text-cyan-300 transition">
                                    {tmpl.title}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isCurrentlyActive && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-500 text-black animate-pulse">
                                        ✓ ACTIVE (STEP {activeStepNum})
                                      </span>
                                    )}
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                      {tmpl.category}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-[11px] text-cyan-400/90 truncate font-mono">
                                  Subject: {tmpl.subject}
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                  {tmpl.body}
                                </p>
                                {tmpl.tags && tmpl.tags.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {tmpl.tags.map((t, idx) => (
                                      <span key={idx} className="text-[9px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800/80">
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(tmpl, 0)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition shadow-sm ${
                                    isCurrentlyActive && activeStepNum === 1
                                      ? 'bg-cyan-500 text-black font-extrabold'
                                      : 'bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60'
                                  }`}
                                >
                                  {isCurrentlyActive && activeStepNum === 1 ? '✓ Active in Step 1' : 'Insert into Step 1'}
                                </button>
                                {wizardSteps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyTemplate(tmpl, 1)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                      isCurrentlyActive && activeStepNum === 2
                                        ? 'bg-cyan-500 text-black font-extrabold'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                    }`}
                                  >
                                    {isCurrentlyActive && activeStepNum === 2 ? '✓ Active in Step 2' : 'Insert into Step 2'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Sequence Steps */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Sequence Touchpoints ({wizardSteps.length} steps)
                      </div>
                      <button
                        type="button"
                        onClick={handleAddStep}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Follow-up Step</span>
                      </button>
                    </div>

                    {wizardSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-cyan-500 text-black font-extrabold text-[11px] flex items-center justify-center">
                              {step.stepNumber}
                            </span>
                            <span className="font-bold text-xs text-slate-200">
                              {idx === 0 ? 'Initial Outreach Email' : `Follow-up Step ${step.stepNumber} (After ${step.delayDays} days)`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Direct Template Loader Dropdown for this step */}
                            <select
                              value={appliedTemplates[idx]?.id || ''}
                              onChange={(e) => {
                                const found = emailTemplates.find(t => t.id === e.target.value);
                                if (found) {
                                  handleApplyTemplate(found, idx);
                                }
                              }}
                              className="text-[11px] font-bold bg-slate-950 text-cyan-300 border border-slate-700 rounded-lg px-2.5 py-1 cursor-pointer focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">⚡ Load Saved Template...</option>
                              {emailTemplates.filter(t => !t.isTrash).map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.title} ({t.category})
                                </option>
                              ))}
                            </select>

                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStep(idx)}
                                className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Active Attached Template Banner */}
                        {appliedTemplates[idx] && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-xs text-cyan-200 animate-in fade-in">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Active Template: <strong className="text-white font-black">{appliedTemplates[idx].title}</strong></span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/90 border border-cyan-700 text-cyan-300">
                                {appliedTemplates[idx].category}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAppliedTemplates(prev => {
                                const copy = { ...prev };
                                delete copy[idx];
                                return copy;
                              })}
                              className="text-[10px] text-rose-300 hover:text-rose-200 hover:underline font-bold cursor-pointer"
                            >
                              Detach / Custom
                            </button>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-slate-400">Subject Line *</label>
                          <input
                            type="text"
                            required
                            value={step.subject}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWizardSteps(prev => prev.map((s, i) => i === idx ? { ...s, subject: val } : s));
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-slate-400">Body Content *</label>
                          <textarea
                            rows={4}
                            required
                            value={step.body}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWizardSteps(prev => prev.map((s, i) => i === idx ? { ...s, body: val } : s));
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-sans"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 5: Delay & Schedule Window (Explicit User Request) */}
              {wizardStep === 5 && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Sending Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSendMode('instant')}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                          sendMode === 'instant'
                            ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/50 shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-cyan-400" />
                          <span>Instant Start Dispatch</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Begins dispatching queue immediately with configurable interval delay.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSendMode('scheduled')}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                          sendMode === 'scheduled'
                            ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/50 shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-purple-400" />
                          <span>Scheduled Window</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Schedule to send within specified business hours and dates.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Window Options */}
                  {sendMode === 'scheduled' && (
                    <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3 animate-in fade-in text-xs">
                      <div className="flex items-center gap-2 text-purple-300 font-bold">
                        <Timer className="w-4 h-4 text-purple-400" />
                        <span>Schedule Dispatch Window Configuration</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-300">Launch Date</label>
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-300">Window Start Time</label>
                          <input
                            type="time"
                            value={scheduleStartTime}
                            onChange={(e) => setScheduleStartTime(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-300">Window End Time</label>
                          <input
                            type="time"
                            value={scheduleEndTime}
                            onChange={(e) => setScheduleEndTime(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400 font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-300">Target Timezone</label>
                        <select
                          value={scheduleTimezone}
                          onChange={(e) => setScheduleTimezone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400"
                        >
                          <option value="America/New_York (EST)">America/New_York (EST - Eastern)</option>
                          <option value="America/Chicago (CST)">America/Chicago (CST - Central)</option>
                          <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST - Pacific)</option>
                          <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                          <option value="Asia/Dhaka (BST)">Asia/Dhaka (UTC+6)</option>
                        </select>
                      </div>

                      {/* Active Days */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-bold text-slate-300">Active Days of Week</label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                            const isDayActive = scheduleActiveDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleScheduleActiveDay(day)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  isDayActive ? 'bg-purple-500 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-800'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sending Delay (Explicit User Request) */}
                  <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
                    <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Configure Mail Sending Delay Between Leads
                    </label>
                    <p className="text-[11px] text-slate-400">
                      The live dispatcher will pause for this exact duration between each lead to guarantee zero spam-filter flags.
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[5, 10, 15, 30, 45, 60].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSendingInterval(s)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                            sendingInterval === s ? 'bg-cyan-500 text-black shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          {s}s delay
                        </button>
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={sendingInterval}
                          onChange={(e) => setSendingInterval(Number(e.target.value))}
                          className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-100 font-mono text-center"
                          min={2}
                          max={300}
                        />
                        <span className="text-xs text-slate-400 font-mono">sec</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-slate-200">Human Jitter Variation</div>
                        <div className="text-[10px] text-slate-400">Randomize delay by ±2-4s to simulate natural human activity</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableJitter}
                        onChange={(e) => setEnableJitter(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Review & Final Launch */}
              {wizardStep === 6 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                      {editingCampaignId ? 'Campaign Update Summary' : 'Campaign Summary & Launch Confirmation'}
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Campaign Title</span>
                        <span className="font-bold text-slate-200">{campaignTitle}</span>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Recipients Enrolled</span>
                        <span className="font-bold text-cyan-400">{selectedLeadIds.length} Leads</span>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Sending Delay Interval</span>
                        <span className="font-bold text-purple-400">{sendingInterval}s between emails</span>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Sequence Steps</span>
                        <span className="font-bold text-emerald-400">{wizardSteps.length} Touchpoints</span>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Sending Mode</span>
                        <span className="font-bold text-cyan-300">{sendMode === 'instant' ? '⚡ Instant Dispatch' : '📅 Scheduled Window'}</span>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Sender</span>
                        <span className="font-bold text-slate-200">{senderName} ({senderEmail})</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (wizardStep > 1) setWizardStep(wizardStep - 1);
                  else setShowWizardModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                {wizardStep === 1 ? 'Cancel' : '← Back'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (wizardStep < 6) {
                    if (validateCurrentStep(wizardStep)) setWizardStep(wizardStep + 1);
                  } else {
                    handleLaunchCampaign();
                  }
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:via-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>
                  {wizardStep === 6 
                    ? (editingCampaignId ? '💾 Save & Update Campaign' : '🚀 Launch & Start Dispatch') 
                    : 'Next Step →'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME LIVE DISPATCHER MODAL WITH COUNTDOWN */}
      {showLiveDispatcher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Live Mail Dispatch Engine</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                isDispatching ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {isDispatching ? (isPaused ? '⏸ Paused' : '● Sending') : '✓ Finished'}
              </span>
            </div>

            {/* Progress Bar & Current Lead Info */}
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300">
                  Lead {dispatchProgress.currentLeadIndex} of {dispatchProgress.totalLeads}
                </span>
                <span className="text-cyan-400 font-mono">
                  {Math.round((dispatchProgress.currentLeadIndex / (dispatchProgress.totalLeads || 1)) * 100)}% Complete
                </span>
              </div>

              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${(dispatchProgress.currentLeadIndex / (dispatchProgress.totalLeads || 1)) * 100}%` }}
                />
              </div>

              {/* Countdown Timer Display */}
              {dispatchProgress.secondsUntilNext > 0 && isDispatching && (
                <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-xl flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Next email dispatching in:</span>
                  </div>
                  <span className="font-mono font-black text-lg text-cyan-300">
                    {dispatchProgress.secondsUntilNext}s
                  </span>
                </div>
              )}
            </div>

            {/* Live Terminal Log Stream */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Live Delivery Stream</div>
              <div className="bg-black/90 rounded-xl p-3 font-mono text-[11px] text-emerald-400 max-h-44 overflow-y-auto space-y-1 border border-slate-800">
                {dispatchProgress.sentLogs.length === 0 ? (
                  <span className="text-slate-600 italic">Initiating SMTP socket handshake...</span>
                ) : (
                  dispatchProgress.sentLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {isDispatching && (
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isDispatching ? (
                  <button
                    onClick={handleStopDispatch}
                    className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Stop Dispatch</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLiveDispatcher(false)}
                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs cursor-pointer"
                  >
                    Close Dispatcher
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMTP CONNECT MODAL REUSED INSIDE WIZARD */}
      <SMTPConnectModal
        isOpen={showSmtpModalInWizard}
        onClose={() => setShowSmtpModalInWizard(false)}
        onSuccess={(acc) => {
          setSelectedSmtpIds(prev => Array.from(new Set([...prev, acc.id])));
          setSelectedSmtpId(acc.id);
          setFollowUpSmtpId(acc.id);
          setShowSmtpModalInWizard(false);
        }}
      />

      {/* CREATE NEW TEMPLATE MODAL INSIDE WIZARD */}
      {showCreateTemplateInWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-cyan-500/40 w-full max-w-lg rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Create New Template
              </h3>
              <button onClick={() => setShowCreateTemplateInWizard(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTemplateInWizard} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Template Title *</label>
                <input
                  type="text"
                  required
                  value={newTmplTitle}
                  onChange={(e) => setNewTmplTitle(e.target.value)}
                  placeholder="e.g. SaaS Founder Quick Intro"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Category</label>
                  <select
                    value={newTmplCategory}
                    onChange={(e) => setNewTmplCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {templateCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={newTmplTags}
                    onChange={(e) => setNewTmplTags(e.target.value)}
                    placeholder="e.g. SaaS, Cold, Follow-Up"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Subject Line *</label>
                <input
                  type="text"
                  required
                  value={newTmplSubject}
                  onChange={(e) => setNewTmplSubject(e.target.value)}
                  placeholder="e.g. Quick question regarding {{company}}"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Email Body *</label>
                <textarea
                  rows={4}
                  required
                  value={newTmplBody}
                  onChange={(e) => setNewTmplBody(e.target.value)}
                  placeholder="Hi {{name}},\n\n..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateInWizard(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  Save & Apply to Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TEMPLATE CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-100 text-sm">Create Template Category</h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCategory} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Category Label *</label>
                <input
                  type="text"
                  required
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="e.g. Agency Follow-Ups"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CAMPAIGN CONFIRMATION MODAL */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090d16] border border-rose-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-slate-100 text-base">Delete Campaign?</h3>
              </div>
              <button 
                onClick={() => setCampaignToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Are you sure you want to delete campaign <strong className="text-white font-bold">&quot;{campaignToDelete.name}&quot;</strong>?
              </p>
              <p className="text-slate-400 text-[11px]">
                This will halt any active queues and remove all sequence statistics for this campaign.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCampaignToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCampaign(campaignToDelete.id);
                  addNotification({
                    title: 'Campaign Deleted 🗑️',
                    message: `"${campaignToDelete.name}" was permanently removed.`,
                    type: 'system'
                  });
                  setCampaignToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Campaign</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
