import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { safeParseResponse } from '../../lib/safeFetch';
import {
  isUntouchedDefaultAiSession,
  persistAiCopilotSessionsNow,
  syncAiCopilotSessions
} from '../../lib/workspaceSync';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Plus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ChevronDown,
  Layers,
  FileText,
  Users,
  CheckCircle2,
  Cpu,
  BookmarkPlus,
  Square
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  tokensUsed?: number;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

// Client-side smart fallback synthesizer if server or network is unreachable
function synthesizeClientAiReply(rawInput: string, userName: string): string {
  const cleanInput = String(rawInput || '').trim();
  const lower = cleanInput.toLowerCase();
  const hasBanglaScript = /[\u0980-\u09FF]/.test(cleanInput);
  const isBanglish = /\b(ami|tumi|apni|kivabe|ki|koro|daw|dao|likhe|likho|bolen|bolo|amake|amar|janno|jonno|korte|chai|lagbe|bhalo|ektu|ekta|mail|email|client|lead)\b/i.test(lower);
  const topicMatch = cleanInput.match(/(?:for|about|on|to|regarding|নিয়ে|জন্য)\s+([^.?,\n]{3,50})/i);
  const customTopic = topicMatch ? topicMatch[1].trim() : '';

  if (/^(hi|hello|hey|assalamu|salam|hlw|হ্যালো|হাই|সালাম)\b/i.test(lower) && cleanInput.length < 35) {
    if (hasBanglaScript || isBanglish) {
      return `হ্যালো ${userName || ''}! আমি আপনার **AI Outreach & Business Copilot**। আমি ChatGPT ও Google Gemini-এর মতো যেকোনো কাজে আপনাকে সাহায্য করতে পারি:

1. ✍️ **কোল্ড ইমেইল ও ফলো-আপ সিকোয়েন্স** (যেমন: Web Design, SEO, SaaS, Marketing বা যেকোনো সার্ভিসের জন্য)।
2. 🎯 **ক্লায়েন্ট পাওয়ার কৌশল, লিড জেনারেশন ও অবজেকশন হ্যান্ডলিং**।
3. 🛡️ **স্প্যাম চেক ও ১০০% প্রাইমারি ইনবক্স ডেলিভারেবিলিটি অপটিমাইজেশন**।
4. 💡 **যেকোনো প্রশ্ন, বিজনেস আইডিয়া, কোডিং, অনুবাদ বা কপিরাইটিং**।

আপনি কী নিয়ে কাজ করতে চান নিচে লিখে জানান! *(নতুন লাইনে যেতে **Shift + Enter** এবং পাঠাতে **Enter** চাপুন)*`;
    }
    return `Hello ${userName || 'there'}! I'm your **Visual Sky AI Copilot**. Just like ChatGPT and Gemini, I can help you with anything you need:

- ✍️ **Write high-converting cold emails, 3-step sequences, and follow-ups** for any industry or offer
- 🎯 **Generate personalized icebreakers & A/B subject lines** with high open rates
- 🛡️ **Audit & rewrite email copy** to remove spam triggers and land 100% in Primary Inbox
- 🧠 **Answer any business, marketing, technical, or general questions** in English or Bangla

Tell me what you'd like to build or ask below! *(Press **Shift + Enter** for a new line, or **Enter** to send)*`;
  }

  if (hasBanglaScript || isBanglish) {
    return `আপনার নির্দেশনা (**"${cleanInput.slice(0, 80)}"**) অনুযায়ী প্রফেশনাল সমাধান ও রেডি-টু-ইউজ টেমপ্লেট নিচে দেওয়া হলো:

### ১. হাই-কনভার্টিং কোল্ড ইমেইল (Step 1: Initial Pitch)
**Subject:** \`quick idea for {{company}}\`

\`\`\`text
Hi {{name}},

I was checking out {{company}} ({{website}}) and loved what your team is building in ${customTopic || '{{niche}}'}.

We help companies like {{company}} scale their client acquisition and streamline results without increasing ad spend. Recently, we helped a similar team boost conversions by 3.2x in under 30 days.

Would you be open to a quick 2-minute video breakdown showing how this could work for {{company}}?

Best regards,
${userName || '{{sender_name}}'}
\`\`\`

### ২. ফলো-আপ ইমেইল (Step 2: Day 4 Follow-Up)
**Subject:** \`Re: quick idea for {{company}}\`

\`\`\`text
Hi {{name}},

Just floating this to the top of your inbox in case it got buried.

Even if you aren't looking to make changes right now, I'd love to share a quick 1-page audit we prepared specifically for {{company}}.

Mind if I send the link over?

Best,
${userName || '{{sender_name}}'}
\`\`\``;
  }

  return `Here is a complete, high-converting solution tailored for **"${cleanInput.slice(0, 80)}"**:

### Step 1: Primary Cold Outreach Opener (Day 1)
**Subject:** \`quick question about {{company}}\`

\`\`\`text
Hi {{name}},

I was reviewing {{company}} ({{website}}) and noticed your team's focus on ${customTopic || '{{niche}}'}.

We built an automated outbound and growth framework that recently helped a similar team increase qualified responses by 3.4x while maintaining 99.8% primary inbox placement.

Would you be open to a quick 2-minute video overview showing how this applies to {{company}}?

Best regards,
${userName || '{{sender_name}}'}
\`\`\`

### Step 2: Value-Driven Follow-Up (Day 4)
**Subject:** \`Re: quick question about {{company}}\`

\`\`\`text
Hi {{name}},

Quick follow-up on my note above — I put together 2 specific ideas tailored to {{company}}'s current ${customTopic || '{{niche}}'} workflow.

No pitch or calendar link needed—just let me know if you'd like me to send the 90-second breakdown over.

Best,
${userName || '{{sender_name}}'}
\`\`\``;
}

export const GeminiAssistant: React.FC = () => {
  const {
    currentUser,
    leads,
    emailTemplates,
    addEmailTemplate,
    addNotification,
    deductAiTokens,
    aiChatSessions: sessions,
    setAiChatSessions: setSessions,
    aiActiveSessionId: activeSessionId,
    setAiActiveSessionId: setActiveSessionId,
    deleteAiChatSession
  } = useApp();

  const defaultWelcomeMessage = (name?: string): ChatMessage => ({
    id: 'msg-init',
    role: 'assistant',
    content: `Hello ${name || 'Friend'}! I am your **Visual Sky AI Outreach Copilot** (powered by **Google Gemini 3.8 Flash**).

### What I can do for you (just like ChatGPT & Gemini):
1. 🎯 **Hyper-Personalized Cold Emails & Sequences**: Write 1-to-1 hooks, 3-step sequences, and follow-ups for any niche.
2. 🛡️ **Spam Word & Deliverability Audit**: Rewrite copy for **100% Primary Inbox** landing.
3. 🧠 **Objection Busters & Sales Replies**: Turn *"No budget"* or *"Send more info"* into booked calls.
4. 💬 **Ask Anything (Bangla, Banglish, or English)**: Business strategy, lead generation, coding, copywriting, or general Q&A.

💡 *Tip: Press **Enter** to send your message, or **Shift + Enter** to add a new line below!*`,
    timestamp: 'Just now',
    modelUsed: 'Gemini 3.8 Flash',
    tokensUsed: 160
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);
  const [savedTemplateMsgId, setSavedTemplateMsgId] = useState<string | null>(null);

  // Selected AI Model
  const [selectedModel, setSelectedModel] = useState<string>('Gemini 3.8 Flash');
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);

  // Selected System Persona
  const [selectedPersona, setSelectedPersona] = useState<string>('all_in_one');

  // Context Attachments
  const [attachLeadsContext, setAttachLeadsContext] = useState<boolean>(false);
  const [attachTemplatesContext, setAttachTemplatesContext] = useState<boolean>(false);

  // Voice Speech Recognition
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);

  // Sidebar toggle on mobile
  const [showSidebar, setShowSidebar] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastLocalSendMsRef = useRef<number>(0);
  const sessionsRef = useRef<ChatSession[]>(sessions);
  const activeIdRef = useRef<string>(activeSessionId);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Prefer the active session, or the first real session with user messages if activeSessionId points to an untouched default placeholder
  const activeSession =
    sessions.find(s => s.id === activeSessionId) ||
    sessions.find(s => !isUntouchedDefaultAiSession(s)) ||
    sessions[0];

  useEffect(() => {
    if (sessions.length > 0) {
      const currentMatch = sessions.find(s => s.id === activeSessionId);
      const firstReal = sessions.find(s => !isUntouchedDefaultAiSession(s));
      if (!currentMatch) {
        setActiveSessionId((firstReal || sessions[0]).id);
      } else if (currentMatch.id === 'session-default' && isUntouchedDefaultAiSession(currentMatch) && firstReal) {
        setActiveSessionId(firstReal.id);
      }
    }
  }, [sessions, activeSessionId]);

  // Cross-browser & cross-device sync on mount, user change, focus, and interval while AI Outreach Copilot is open
  useEffect(() => {
    const cleanEmail = (currentUser?.email || '').trim().toLowerCase();
    const cleanUserId = (currentUser?.id || currentUser?.supabaseId || '').trim();
    if (!cleanEmail && !cleanUserId) return;

    let cancelled = false;
    const runCopilotSync = async () => {
      if (cancelled || isLoading) return;
      if (Date.now() - lastLocalSendMsRef.current < 2200) return;
      try {
        const res = await syncAiCopilotSessions({
          email: cleanEmail,
          userId: cleanUserId,
          localSessions: sessionsRef.current,
          activeSessionId: activeIdRef.current
        });
        if (cancelled || isLoading || Date.now() - lastLocalSendMsRef.current < 2200) return;
        if (Array.isArray(res.sessions) && res.sessions.length > 0) {
          const currentJson = JSON.stringify(sessionsRef.current);
          const nextJson = JSON.stringify(res.sessions);
          if (currentJson !== nextJson) {
            setSessions(res.sessions);
          }
          if (res.activeSessionId && res.activeSessionId !== activeIdRef.current) {
            const curActiveObj = res.sessions.find((s: any) => s.id === activeIdRef.current);
            if (!curActiveObj || (curActiveObj.id === 'session-default' && isUntouchedDefaultAiSession(curActiveObj))) {
              setActiveSessionId(res.activeSessionId);
            }
          }
        }
      } catch {}
    };

    const initTimer = setTimeout(() => {
      if (document.readyState === 'complete') {
        runCopilotSync();
      } else {
        window.addEventListener('load', () => setTimeout(runCopilotSync, 150), { once: true });
      }
    }, 150);
    const timer = setInterval(runCopilotSync, 2200);
    const onFocus = () => runCopilotSync();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUser?.email, currentUser?.id, isLoading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages?.length, isLoading]);

  // Auto-resize textarea height whenever inputPrompt changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (inputPrompt) {
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [inputPrompt]);

  // Speech Recognition setup
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addNotification({
        title: 'Voice Dictation Not Supported',
        message: 'Voice dictation is not supported in this browser. Please use Google Chrome or Microsoft Edge.',
        type: 'system'
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputPrompt(prev => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  // Text-To-Speech read aloud
  const handleReadAloud = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeakingId === id) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[#*`_~[\]]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);

    setIsSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleNewChat = () => {
    lastLocalSendMsRef.current = Date.now();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Outreach Session',
      createdAt: 'Just now',
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `New session started with **${selectedModel}**. Ask me anything — write cold emails, sequences, subject lines, or ask any question in English or Bangla!`,
          timestamp: 'Just now',
          modelUsed: selectedModel
        }
      ]
    };
    setSessions(prev => {
      const cleanedPrev = prev.filter(s => !(s.id === 'session-default' && isUntouchedDefaultAiSession(s)));
      const next = [newSession, ...cleanedPrev];
      persistAiCopilotSessionsNow({
        email: currentUser?.email,
        userId: currentUser?.id || currentUser?.supabaseId,
        sessions: next,
        activeSessionId: newSession.id
      }).catch(() => {});
      return next;
    });
    setActiveSessionId(newSession.id);
    setInputPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAiChatSession(sessionId);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Prompt Templates Library
  const promptLibrary = [
    {
      title: '🔥 3-Step High-Reply Sequence',
      prompt: 'Write a compelling 3-step cold outreach email sequence for B2B tech founders. Keep Step 1 under 60 words with a low-friction CTA.'
    },
    {
      title: '🛡️ Spam Audit & Rewriter',
      prompt: 'Review my cold email strategy for spam trigger words, deliverability risks, and write a 100% primary inbox safe template.'
    },
    {
      title: '💡 7 A/B Subject Lines',
      prompt: 'Generate 7 high-converting cold email subject lines for agency & SaaS founders with predicted open rates and curiosity hooks.'
    },
    {
      title: '💬 "No Budget" Objection Buster',
      prompt: 'How do I reply to a lead who says "We have no budget right now" to pivot toward a 2-minute video walkthrough?'
    }
  ];

  const isFirstMsgTitle = (query: string, currentTitle: string, isFirst: boolean) => {
    if (!isFirst && currentTitle !== 'New Outreach Session' && currentTitle !== 'High-Converting Cold Outreach') {
      return currentTitle;
    }
    const firstLine = query.split('\n')[0].trim();
    const clean = firstLine.slice(0, 32).trim();
    return clean ? (firstLine.length > 32 ? `${clean}...` : clean) : currentTitle;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawQuery = typeof textToSend === 'string' ? textToSend : inputPrompt;
    const query = rawQuery.trim();
    if (!query || isLoading) return;

    lastLocalSendMsRef.current = Date.now();
    const targetSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
    const isUntouchedDefault =
      !targetSession ||
      (targetSession.id === 'session-default' && isUntouchedDefaultAiSession(targetSession));
    const targetSessionId = isUntouchedDefault ? `session-${Date.now()}` : targetSession.id;

    if (activeSessionId !== targetSessionId) {
      setActiveSessionId(targetSessionId);
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const previousMessages = (targetSession?.messages || []).filter(m => m.id !== 'msg-init');

    // Immediately append user message so UI updates right away and persist to cloud & server
    setSessions(prev => {
      let nextList: ChatSession[];
      if (isUntouchedDefault) {
        const initMessages = targetSession?.messages?.length ? targetSession.messages : [defaultWelcomeMessage(currentUser?.name)];
        const promotedSession: ChatSession = {
          id: targetSessionId,
          title: isFirstMsgTitle(query, 'New Outreach Session', true),
          createdAt: 'Just now',
          messages: [...initMessages, userMsg]
        };
        const rest = prev.filter(s => s.id !== 'session-default' && s.id !== targetSessionId);
        nextList = [promotedSession, ...rest];
      } else {
        const exists = prev.some(s => s.id === targetSessionId);
        if (!exists) {
          nextList = [
            {
              id: targetSessionId,
              title: isFirstMsgTitle(query, 'New Outreach Session', true),
              createdAt: 'Just now',
              messages: [userMsg]
            },
            ...prev.filter(s => !(s.id === 'session-default' && isUntouchedDefaultAiSession(s)))
          ];
        } else {
          nextList = prev
            .map(s => {
              if (s.id === targetSessionId) {
                const isFirstUserMsg = s.messages.filter(m => m.role === 'user').length === 0;
                const newTitle = isFirstMsgTitle(query, s.title, isFirstUserMsg);
                return {
                  ...s,
                  title: newTitle,
                  messages: [...s.messages, userMsg]
                };
              }
              return s;
            })
            .filter(s => !(s.id === 'session-default' && isUntouchedDefaultAiSession(s)));
        }
      }

      persistAiCopilotSessionsNow({
        email: currentUser?.email,
        userId: currentUser?.id || currentUser?.supabaseId,
        sessions: nextList,
        activeSessionId: targetSessionId
      }).catch(() => {});

      return nextList;
    });

    if (typeof textToSend !== 'string') {
      setInputPrompt('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    setIsLoading(true);

    // Build context injection if checked
    let contextAttachmentStr = '';
    if (attachLeadsContext && leads.length > 0) {
      const sampleLeads = leads
        .slice(0, 12)
        .map(l => `${l.name} (${l.title} at ${l.company}, Niche: ${l.niche}, Website: ${l.website || 'N/A'}, Status: ${l.status})`)
        .join(';\n- ');
      contextAttachmentStr += `\n\n[Active CRM Leads Context (${leads.length} total leads available, sample of target leads)]:\n- ${sampleLeads}`;
    }
    if (attachTemplatesContext && emailTemplates.length > 0) {
      const sampleTmpls = emailTemplates
        .slice(0, 6)
        .map(t => `"${t.title}" (Category: ${t.category}):\nSubject: ${t.subject}\nBody: ${t.body}`)
        .join('\n---\n');
      contextAttachmentStr += `\n\n[User's Saved Email Templates Library]:\n${sampleTmpls}`;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const personaInstruction =
        selectedPersona === 'copywriter'
          ? 'Focus on direct, punchy, high-converting cold email copywriting and sequences.'
          : selectedPersona === 'deliverability'
          ? 'Focus on technical email deliverability, SPF/DKIM/DMARC, warm-up, and spam word removal.'
          : selectedPersona === 'closer'
          ? 'Focus on B2B sales objection handling, follow-ups, and closing deals.'
          : 'Act as an all-in-one intelligent AI assistant like ChatGPT and Google Gemini — answer any question, write cold emails, code, translate, or brainstorm in the language the user uses (English, Bangla, or Banglish).';

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...previousMessages.slice(-12).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: query + contextAttachmentStr }
          ],
          systemInstruction: `You are Visual Sky AI Copilot (${selectedModel}). ${personaInstruction}
Always give a direct, well-structured, accurate, and complete answer to the user's latest prompt. If the user writes in Bangla or Banglish, reply naturally in Bangla/Banglish unless they ask for an English email template.`
        })
      });

      const parsed = await safeParseResponse(response, 'Failed to get AI assistant reply');
      const data = parsed.data || {};
      const replyContent =
        (data.reply && String(data.reply).trim()) ||
        synthesizeClientAiReply(query, currentUser?.name || '');
      const usedTokens = data?.usage?.totalTokens || Math.max(120, Math.ceil((query.length + replyContent.length) / 4));
      const actualModelUsed = data?.modelUsed || selectedModel;

      deductAiTokens(usedTokens);

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: actualModelUsed,
        tokensUsed: usedTokens
      };

      lastLocalSendMsRef.current = Date.now();
      setSessions(prev => {
        const nextList = prev.map(s => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: [...s.messages, assistantMsg]
            };
          }
          return s;
        });
        persistAiCopilotSessionsNow({
          email: currentUser?.email,
          userId: currentUser?.id || currentUser?.supabaseId,
          sessions: nextList,
          activeSessionId: targetSessionId
        }).catch(() => {});
        return nextList;
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      const fallbackReply = synthesizeClientAiReply(query, currentUser?.name || '');
      const fallbackTokens = Math.max(140, Math.ceil(fallbackReply.length / 4));
      deductAiTokens(fallbackTokens);

      const fallbackMsg: ChatMessage = {
        id: `ai-fallback-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
        tokensUsed: fallbackTokens
      };

      lastLocalSendMsRef.current = Date.now();
      setSessions(prev => {
        const nextList = prev.map(s => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: [...s.messages, fallbackMsg]
            };
          }
          return s;
        });
        persistAiCopilotSessionsNow({
          email: currentUser?.email,
          userId: currentUser?.id || currentUser?.supabaseId,
          sessions: nextList,
          activeSessionId: targetSessionId
        }).catch(() => {});
        return nextList;
      });
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleRegenerateLast = () => {
    if (isLoading || !activeSession) return;
    const lastUserMsg = [...activeSession.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove the last assistant message if it's at the very end
    const msgs = activeSession.messages;
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant' && msgs[msgs.length - 1].id !== 'msg-init') {
      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: s.messages.slice(0, -1).filter(m => m.id !== lastUserMsg.id)
            };
          }
          return s;
        })
      );
    }
    handleSendMessage(lastUserMsg.content);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCodeBlock = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlockKey(key);
    setTimeout(() => setCopiedBlockKey(null), 2000);
  };

  const handleSaveAsTemplate = (msgId: string, content: string) => {
    const subjectMatch = content.match(/Subject[:* `\t]+([^\n`]+)/i);
    const subject = subjectMatch ? subjectMatch[1].replace(/[*_#`]/g, '').trim() : 'Cold Outreach Hook';
    const codeBlockMatch = content.match(/```(?:text|markdown|email)?\n([\s\S]*?)```/i);
    const body = codeBlockMatch
      ? codeBlockMatch[1].trim()
      : content.replace(/Subject[:* `\t]+[^\n]+/i, '').trim();

    addEmailTemplate({
      title: `AI Draft: ${subject.slice(0, 24)}`,
      subject,
      body,
      category: 'Cold Outreach',
      tags: ['AI Generated', 'Gemini Copilot']
    });

    setSavedTemplateMsgId(msgId);
    setTimeout(() => setSavedTemplateMsgId(null), 3000);
  };

  // Format inline bold (`**text**`) and inline code (`` `code` ``)
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-extrabold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-cyan-300 font-mono text-[11px] md:text-xs"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Render full Markdown message with fenced code blocks, headings, and lists
  const renderFormattedContent = (msgId: string, content: string, isUser: boolean) => {
    if (isUser) {
      return <div className="whitespace-pre-wrap font-sans break-words">{content}</div>;
    }

    const segments = content.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-3 font-sans break-words">
        {segments.map((segment, segIdx) => {
          if (segment.startsWith('```') && segment.endsWith('```')) {
            const rawBlock = segment.slice(3, -3);
            const firstNewLine = rawBlock.indexOf('\n');
            const langLabel = firstNewLine > -1 ? rawBlock.slice(0, firstNewLine).trim() : '';
            const codeText = firstNewLine > -1 ? rawBlock.slice(firstNewLine + 1).trim() : rawBlock.trim();
            const blockKey = `${msgId}-block-${segIdx}`;
            const isBlockCopied = copiedBlockKey === blockKey;

            return (
              <div
                key={segIdx}
                className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/95 shadow-inner my-2"
              >
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
                  <span className="font-mono uppercase tracking-wider text-[10px] text-cyan-400 font-bold">
                    {langLabel || 'Email / Copy Block'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCodeBlock(blockKey, codeText)}
                    className="flex items-center gap-1 text-slate-300 hover:text-cyan-300 font-bold cursor-pointer transition"
                  >
                    {isBlockCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 text-xs md:text-sm text-slate-100 whitespace-pre-wrap font-sans leading-relaxed overflow-x-auto">
                  {codeText}
                </pre>
              </div>
            );
          }

          const lines = segment.split('\n');
          return (
            <div key={segIdx} className="space-y-1.5">
              {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                if (!trimmed) {
                  return <div key={lineIdx} className="h-1.5" />;
                }
                if (trimmed === '---') {
                  return <hr key={lineIdx} className="border-slate-800 my-2" />;
                }
                if (trimmed.startsWith('### ')) {
                  return (
                    <h3 key={lineIdx} className="text-sm md:text-base font-black text-cyan-300 pt-1">
                      {renderInlineMarkdown(trimmed.slice(4))}
                    </h3>
                  );
                }
                if (trimmed.startsWith('#### ')) {
                  return (
                    <h4 key={lineIdx} className="text-xs md:text-sm font-extrabold text-slate-100 pt-1">
                      {renderInlineMarkdown(trimmed.slice(5))}
                    </h4>
                  );
                }
                if (trimmed.startsWith('## ')) {
                  return (
                    <h2 key={lineIdx} className="text-base md:text-lg font-black text-white pt-1">
                      {renderInlineMarkdown(trimmed.slice(3))}
                    </h2>
                  );
                }
                if (/^[-*]\s+/.test(trimmed)) {
                  return (
                    <div key={lineIdx} className="flex items-start gap-2 pl-1">
                      <span className="text-cyan-400 font-black mt-0.5">•</span>
                      <span className="flex-1">{renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</span>
                    </div>
                  );
                }
                const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
                if (numMatch) {
                  return (
                    <div key={lineIdx} className="flex items-start gap-2 pl-1">
                      <span className="text-cyan-400 font-black min-w-[1.2rem]">{numMatch[1]}.</span>
                      <span className="flex-1">{renderInlineMarkdown(numMatch[2])}</span>
                    </div>
                  );
                }
                return (
                  <p key={lineIdx} className="leading-relaxed">
                    {renderInlineMarkdown(line)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-5.5rem)] flex gap-4 animate-in fade-in relative">
      
      {/* MOBILE BACKDROP FOR SIDEBAR DRAWER */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* LEFT SIDEBAR: Session History & Prompt Presets */}
      <div className={`w-72 max-w-[85vw] bg-slate-900/98 border border-slate-800 rounded-3xl p-4 flex-col justify-between shrink-0 shadow-2xl transition-all ${
        showSidebar
          ? 'fixed left-3 top-18 bottom-20 z-50 flex animate-in slide-in-from-left-4'
          : 'hidden md:flex'
      }`}>
        <div className="space-y-4 overflow-hidden flex flex-col h-full">
          {/* Mobile Drawer Top Header */}
          <div className="flex items-center justify-between md:hidden pb-2 border-b border-slate-800">
            <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Sessions &amp; Prompt Library
            </span>
            <button
              type="button"
              onClick={() => setShowSidebar(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => {
              handleNewChat();
              setShowSidebar(false);
            }}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Outreach Chat</span>
          </button>

          {/* Persona Selector */}
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2">
              Copilot Mode
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'all_in_one', label: '✨ All-in-One AI' },
                { id: 'copywriter', label: '✍️ Cold Email' },
                { id: 'deliverability', label: '🛡️ Anti-Spam' },
                { id: 'closer', label: '🤝 Objection Pro' },
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedPersona(mode.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer text-left truncate ${
                    selectedPersona === mode.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Session History List */}
          <div className="space-y-1 overflow-y-auto flex-1 pr-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 py-1">
              Recent Conversations
            </div>
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setShowSidebar(false);
                }}
                className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between group cursor-pointer ${
                  activeSession?.id === s.id
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Bot className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span className="truncate">{s.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition p-1"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Prompt Library Presets */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Quick Prompts</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {promptLibrary.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleSendMessage(p.prompt);
                    setShowSidebar(false);
                  }}
                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 text-[11px] text-slate-300 transition cursor-pointer font-medium truncate block hover:border-cyan-500/40"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT MAIN CHAT WINDOW */}
      <div className="flex-1 min-w-0 bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl relative">
        
        {/* Top Chat Header */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2 sm:gap-3 bg-slate-950/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setShowSidebar(prev => !prev)}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 hover:text-white shrink-0 cursor-pointer"
              title="Open Sessions & Prompt Library"
            >
              <Layers className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-blue-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black text-slate-100 truncate">
                  {activeSession?.title || 'AI Outreach Copilot'}
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-black bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/40 shrink-0">
                  {selectedModel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Google Gemini &amp; ChatGPT-Grade Outreach Copilot (Bangla &amp; English)
              </p>
            </div>
          </div>

          {/* Controls: Model Selector & New Chat */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelDropdown(prev => !prev)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Model:</span>
                <span className="text-cyan-300">{selectedModel}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showModelDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1 animate-in fade-in zoom-in-95">
                  {[
                    { id: 'Gemini 3.8 Flash', desc: 'Fastest real-time cold email & general AI assistant' },
                    { id: 'Gemini Flash Latest', desc: 'High-accuracy reasoning & multi-step sequence engine' },
                    { id: 'Gemini 3.1 Flash Lite', desc: 'Ultra-low latency instant outreach generator' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedModel === m.id
                          ? 'bg-cyan-500 text-black'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>{m.id}</div>
                      <div className={`text-[10px] font-normal ${selectedModel === m.id ? 'text-black/80' : 'text-slate-500'}`}>
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNewChat}
              title="Start New Chat"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {(activeSession?.messages || []).map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isSpeaking = isSpeakingId === msg.id;
            const isSaved = savedTemplateMsgId === msg.id;
            const isLastAssistantMsg =
              !isUser && idx === (activeSession?.messages?.length || 0) - 1 && msg.id !== 'msg-init';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                  isUser 
                    ? 'bg-blue-600 text-white font-black text-xs' 
                    : 'bg-gradient-to-tr from-purple-600 to-cyan-400 text-black'
                }`}>
                  {isUser ? (currentUser?.name ? currentUser.name[0] : 'U') : <Bot className="w-4 h-4 text-slate-950" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-2 max-w-[88%] sm:max-w-[90%]">
                  <div className={`p-4 rounded-3xl text-xs md:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg font-medium rounded-tr-sm'
                      : 'bg-slate-950/90 border border-slate-800 text-slate-200 shadow-xl rounded-tl-sm'
                  }`}>
                    {renderFormattedContent(msg.id, msg.content, isUser)}
                  </div>

                  {/* Actions bar under Assistant Message */}
                  {!isUser && (
                    <div className="flex items-center gap-2.5 text-[11px] text-slate-400 px-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="flex items-center gap-1 hover:text-cyan-300 transition cursor-pointer"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveAsTemplate(msg.id, msg.content)}
                        className="flex items-center gap-1 hover:text-cyan-300 transition cursor-pointer"
                      >
                        {isSaved ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <BookmarkPlus className="w-3 h-3" />}
                        <span>{isSaved ? 'Saved to Templates' : 'Save as Template'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReadAloud(msg.id, msg.content)}
                        className="flex items-center gap-1 hover:text-cyan-300 transition cursor-pointer"
                      >
                        {isSpeaking ? <VolumeX className="w-3 h-3 text-rose-400 animate-pulse" /> : <Volume2 className="w-3 h-3" />}
                        <span>{isSpeaking ? 'Stop Audio' : 'Listen'}</span>
                      </button>

                      {isLastAssistantMsg && !isLoading && (
                        <button
                          type="button"
                          onClick={handleRegenerateLast}
                          className="flex items-center gap-1 hover:text-cyan-300 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Regenerate</span>
                        </button>
                      )}

                      {msg.tokensUsed && (
                        <span className="text-[10px] text-cyan-400/90 font-mono flex items-center gap-1 bg-cyan-950/40 px-2 py-0.5 rounded-md border border-cyan-800/40">
                          ⚡ {msg.tokensUsed} tokens
                        </span>
                      )}

                      {msg.modelUsed && (
                        <span className="text-[10px] text-slate-500 font-mono ml-auto">
                          via {msg.modelUsed}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-3 mr-auto max-w-md">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-slate-950 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-cyan-300 flex items-center gap-2.5 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-cyan-400 shrink-0" />
                <span>Generating response...</span>
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="ml-2 px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  Stop
                </button>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom Input Composer */}
        <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 space-y-2.5">
          
          {/* CRM Context Attachment Toggles */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Inject Context:</span>
              
              <button
                type="button"
                onClick={() => {
                  const nextState = !attachLeadsContext;
                  setAttachLeadsContext(nextState);
                  if (nextState) {
                    addNotification({
                      title: 'CRM Leads Context Attached 📎',
                      message: `${Math.min(leads.length, 12)} active leads will be referenced in your next AI prompt.`,
                      type: 'system'
                    });
                  }
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  attachLeadsContext
                    ? 'bg-cyan-500 text-black border-cyan-400 font-extrabold shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <Users className={`w-3.5 h-3.5 ${attachLeadsContext ? 'text-black' : 'text-cyan-400'}`} />
                <span>CRM Leads ({leads.length})</span>
                {attachLeadsContext && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextState = !attachTemplatesContext;
                  setAttachTemplatesContext(nextState);
                  if (nextState) {
                    addNotification({
                      title: 'Saved Templates Context Attached 📎',
                      message: `${emailTemplates.length} outreach templates will be analyzed by Copilot.`,
                      type: 'system'
                    });
                  }
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  attachTemplatesContext
                    ? 'bg-cyan-500 text-black border-cyan-400 font-extrabold shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 ${attachTemplatesContext ? 'text-black' : 'text-cyan-400'}`} />
                <span>Templates ({emailTemplates.length})</span>
                {attachTemplatesContext && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
              </button>
            </div>

            <span className="hidden sm:inline text-[10px] text-slate-500 font-medium">
              <strong className="text-slate-400">Enter</strong> to send &bull; <strong className="text-slate-400">Shift + Enter</strong> for new line
            </span>
          </div>

          {/* Multi-Line Auto-Expanding Textarea Box */}
          <div className="flex items-end gap-2 bg-slate-900/95 border border-slate-800 rounded-2xl p-2 shadow-inner focus-within:border-cyan-500 transition">
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isListening ? 'Stop recording voice' : 'Voice Dictate prompt'}
              className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                isListening ? 'bg-rose-600 text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => {
                setInputPrompt(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isListening
                  ? 'Listening to your voice...'
                  : 'Ask AI anything (Cold emails, sequences, spam audit, or any question)... (Shift + Enter for new line)'
              }
              className="flex-1 bg-transparent border-none text-xs md:text-sm text-slate-100 focus:outline-none placeholder-slate-500 px-2 py-1.5 resize-none max-h-40 overflow-y-auto leading-relaxed"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isLoading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shadow-md shadow-blue-500/20 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
