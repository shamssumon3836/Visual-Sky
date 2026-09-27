import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { safeParseResponse } from '../../lib/safeFetch';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Copy, 
  Check, 
  Trash2, 
  Flame, 
  Lightbulb, 
  ShieldAlert, 
  RefreshCw, 
  Zap,
  MessageSquareCode,
  FileCheck,
  Plus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  Download,
  Share2,
  Sliders,
  ChevronDown,
  Layers,
  FileText,
  Users,
  CheckCircle2,
  Cpu,
  BookmarkPlus,
  ArrowRight,
  Maximize2,
  Minimize2,
  Edit2
} from 'lucide-react';
import confetti from 'canvas-confetti';

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

export const GeminiAssistant: React.FC = () => {
  const { currentUser, leads, emailTemplates, campaigns, addEmailTemplate, addNotification, playNotificationSound, deductAiTokens } = useApp();

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('visualsky_ai_chat_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    return [
      {
        id: 'session-default',
        title: 'High-Converting Cold Outreach',
        createdAt: 'Today',
        messages: [
          {
            id: 'msg-init',
            role: 'assistant',
            content: `Hello ${currentUser.name || 'Friend'}! I am your **Visual Sky AI Outreach Copilot** (powered by Google Gemini 2.0 Flash).

### What I can engineer for you today:
1. 🎯 **Hyper-Personalized Icebreakers**: Generate tailor-made 1-to-1 hooks using your leads' company and niche data.
2. ✍️ **3-Step High-Velocity Sequences**: Craft short, punchy cold emails with 60%+ open rates and 20%+ reply rates.
3. 🛡️ **Spam Word & Deliverability Audit**: Strip out blacklisted spam trigger words for 100% primary inbox landing.
4. 🧠 **Objection Busters**: Turn *"No budget"*, *"Not interested"*, or *"Send more info"* into booked demo calls.
5. 📊 **A/B Subject Line Testing**: Predict open rates and pick executive-level hooks.

You can also **attach CRM Leads**, **select AI Models**, or **voice dictate** prompts below!`,
            timestamp: 'Just now',
            modelUsed: 'Gemini 2.0 Flash',
            tokensUsed: 180
          }
        ]
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('visualsky_ai_active_session_id');
      if (savedId) return savedId;
    } catch {}
    return 'session-default';
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedTemplateMsgId, setSavedTemplateMsgId] = useState<string | null>(null);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('visualsky_ai_chat_sessions', JSON.stringify(sessions));
      localStorage.setItem('visualsky_ai_active_session_id', activeSessionId);
    } catch {}
  }, [sessions, activeSessionId]);

  // Selected AI Model
  const [selectedModel, setSelectedModel] = useState<string>('Gemini 2.0 Flash');
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);

  // Selected System Persona
  const [selectedPersona, setSelectedPersona] = useState<string>('copywriter');

  // Context Attachments
  const [attachLeadsContext, setAttachLeadsContext] = useState<boolean>(false);
  const [attachTemplatesContext, setAttachTemplatesContext] = useState<boolean>(false);

  // Voice Speech Recognition
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);

  // Sidebar toggle on mobile
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  // Speech Recognition setup
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice dictation is not supported in this browser. Please use Google Chrome or Edge.');
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
    // Clean markdown symbols for natural speech
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
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Outreach Session',
      createdAt: 'Just now',
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `New session started with **${selectedModel}**. How can I help you scale your outbound pipeline today?`,
          timestamp: 'Just now',
          modelUsed: selectedModel
        }
      ]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      handleNewChat();
    }
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setActiveSessionId(remaining[0]?.id || 'session-default');
    }
  };

  // Prompt Templates Library
  const promptLibrary = [
    {
      title: '🔥 3-Step High-Reply Sequence',
      prompt: 'Write a compelling 3-step cold outreach email sequence for B2B tech founders. Keep Step 1 under 60 words with a low-friction CTA.'
    },
    {
      title: '🛡️ Spam Audit & Rewriter',
      prompt: 'Review this email copy for spam trigger words, deliverability risks, and rewrite it for 100% primary inbox landing.'
    },
    {
      title: '💡 5 A/B Subject Lines',
      prompt: 'Generate 5 high-converting cold email subject lines for VP of Sales & Marketing with predicted open rates and curiosity hooks.'
    },
    {
      title: '💬 "No Budget" Objection Buster',
      prompt: 'How do I reply to a lead who says "We have no budget right now" to pivot toward a 5-minute video walkthrough?'
    }
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: 'Just now'
    };

    // Update active session messages
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isFirstUserMsg = s.messages.filter(m => m.role === 'user').length === 0;
        const newTitle = isFirstMsgTitle(query, s.title, isFirstUserMsg);
        return {
          ...s,
          title: newTitle,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    }));

    setInputPrompt('');
    setIsLoading(true);

    // Build context injection if checked
    let contextAttachmentStr = '';
    if (attachLeadsContext && leads.length > 0) {
      const sampleLeads = leads.slice(0, 15).map(l => `${l.name} (${l.title} at ${l.company}, Niche: ${l.niche}, Website: ${l.website || 'N/A'}, Status: ${l.status})`).join(';\n- ');
      contextAttachmentStr += `\n\n[Active CRM Leads Context (${leads.length} total leads available, sample of top target leads)]:\n- ${sampleLeads}`;
    }
    if (attachTemplatesContext && emailTemplates.length > 0) {
      const sampleTmpls = emailTemplates.map(t => `"${t.title}" (Category: ${t.category}):\nSubject: ${t.subject}\nBody: ${t.body}`).join('\n---\n');
      contextAttachmentStr += `\n\n[User's Saved Email Templates Library]:\n${sampleTmpls}`;
    }

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...activeSession.messages,
            { role: 'user', content: userMsg.content + contextAttachmentStr }
          ].map(m => ({ role: m.role, content: m.content })),
          systemInstruction: `You are Visual Sky Copilot, an elite Cold Outreach Engineer & Deliverability Architect operating with ${selectedModel} intelligence. 
Persona: ${selectedPersona === 'copywriter' ? 'Direct, punchy, persuasive copywriter' : selectedPersona === 'deliverability' ? 'Technical deliverability & DNS auditor' : 'B2B Sales closer and objection expert'}.
Format with clean Markdown, clear sections, bullet points, and ready-to-use email templates with subject lines and body copy.`
        })
      });

      const parsed = await safeParseResponse(response, 'Failed to get AI assistant reply');
      const data = parsed.data || {};
      const replyContent = data.reply || 'Here is the outreach strategy crafted for your campaign.';
      const usedTokens = data?.usage?.totalTokens || 240;
      const actualModelUsed = data?.modelUsed || selectedModel;

      // Dynamic token usage deduction
      deductAiTokens(usedTokens);

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: 'Just now',
        modelUsed: actualModelUsed,
        tokensUsed: usedTokens
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, assistantMsg]
          };
        }
        return s;
      }));

      addNotification({
        title: 'AI Copilot Strategy Ready 🤖',
        message: `Generated outbound copy using ${actualModelUsed} (Used ${usedTokens} tokens).`,
        type: 'system',
        linkTab: 'ai_copilot'
      });
    } catch {
      const fallbackTokens = 180;
      deductAiTokens(fallbackTokens);

      const fallbackMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `### High-Converting Cold Email Template:\n\n**Subject**: Quick question about {{company}}'s outbound\n\nHi {{name}},\n\nSaw your team is scaling {{niche}} operations. Most leaders we speak with struggle with email deliverability and spam box landing.\n\nWe built an automated multi-relay routing engine that guarantees 99% primary inbox placement.\n\nOpen to a 2-minute video preview?\n\nBest,\n${currentUser.name}`,
        timestamp: 'Just now',
        modelUsed: selectedModel,
        tokensUsed: fallbackTokens
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, fallbackMsg]
          };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const isFirstMsgTitle = (query: string, currentTitle: string, isFirst: boolean) => {
    if (!isFirst && currentTitle !== 'New Outreach Session') return currentTitle;
    const clean = query.slice(0, 28).trim();
    return clean ? `${clean}...` : currentTitle;
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsTemplate = (msgId: string, content: string) => {
    // Extract Subject and Body if formatted, or use raw
    const subjectMatch = content.match(/Subject[:* ]+([^\n]+)/i);
    const subject = subjectMatch ? subjectMatch[1].replace(/[*_#]/g, '').trim() : 'Cold Outreach Hook';
    
    // Clean body
    const body = content.replace(/Subject[:* ]+[^\n]+/i, '').trim();

    addEmailTemplate({
      title: `AI Draft: ${subject.slice(0, 24)}`,
      subject: subject,
      body: body,
      category: 'Cold Outreach',
      tags: ['AI Generated', 'Gemini Copilot']
    });

    setSavedTemplateMsgId(msgId);
    setTimeout(() => setSavedTemplateMsgId(null), 3000);
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto h-[calc(100vh-5.5rem)] flex gap-4 animate-in fade-in">
      
      {/* LEFT SIDEBAR: Session History & Prompt Presets */}
      <div className={`w-72 bg-slate-900/95 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between shrink-0 shadow-2xl transition-all ${
        showSidebar ? 'flex' : 'hidden md:flex'
      }`}>
        <div className="space-y-4 overflow-hidden flex flex-col h-full">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Outreach Chat</span>
          </button>

          {/* Session History List */}
          <div className="space-y-1 overflow-y-auto flex-1 pr-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 py-1">
              Recent Conversations
            </div>
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between group cursor-pointer ${
                  activeSessionId === s.id
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
              <span>Prompt Library</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {promptLibrary.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(p.prompt)}
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
      <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl relative">
        
        {/* Top Chat Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-blue-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-md shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-100">{activeSession.title}</h2>
                <span className="px-2 py-0.5 text-[10px] font-black bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/40">
                  {selectedModel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Google Gemini Outreach & Deliverability Specialist</p>
            </div>
          </div>

          {/* Controls: Model Selector & Clear */}
          <div className="flex items-center gap-2">
            
            {/* Model Selector Dropdown */}
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
                    { id: 'Gemini 2.0 Flash', desc: 'Fastest real-time cold email & sequence generator' },
                    { id: 'Gemini 1.5 Flash', desc: 'Ultra-low latency outreach intelligence' },
                    { id: 'Gemini 2.5 Flash', desc: 'Next-gen reasoning & multi-step campaign logic' },
                    { id: 'Gemini Flash Pro', desc: 'Deep research & enterprise sequence architect' },
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
              title="Clear & New Chat"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {activeSession.messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSpeaking = isSpeakingId === msg.id;
            const isSaved = savedTemplateMsgId === msg.id;

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
                  {isUser ? (currentUser.name ? currentUser.name[0] : 'U') : <Bot className="w-4 h-4 text-slate-950" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-2 max-w-[85%] sm:max-w-[90%]">
                  <div className={`p-4 rounded-3xl text-xs md:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg font-medium rounded-tr-sm'
                      : 'bg-slate-950/90 border border-slate-800 text-slate-200 shadow-xl rounded-tl-sm'
                  }`}>
                    {/* Rich Markdown Output */}
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>
                  </div>

                  {/* Actions bar under Assistant Message */}
                  {!isUser && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 px-2 flex-wrap">
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
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-cyan-300 flex items-center gap-2 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                <span>Engineering high-converting outreach copy...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom Input Composer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3">
          
          {/* CRM Context Attachment Toggles */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Inject Context:</span>
            
            <button
              type="button"
              onClick={() => {
                const nextState = !attachLeadsContext;
                setAttachLeadsContext(nextState);
                if (nextState) {
                  addNotification({
                    title: 'CRM Leads Context Attached 📎',
                    message: `${Math.min(leads.length, 10)} active leads will be referenced in your next AI prompt.`,
                    type: 'system'
                  });
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-2 shadow-sm ${
                attachLeadsContext
                  ? 'bg-cyan-500 text-black border-cyan-400 font-extrabold shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${attachLeadsContext ? 'text-black' : 'text-cyan-400'}`} />
              <span>Attach CRM Leads ({leads.length})</span>
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-2 shadow-sm ${
                attachTemplatesContext
                  ? 'bg-cyan-500 text-black border-cyan-400 font-extrabold shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${attachTemplatesContext ? 'text-black' : 'text-cyan-400'}`} />
              <span>Attach Saved Templates ({emailTemplates.length})</span>
              {attachTemplatesContext && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
            </button>
          </div>

          {/* Text Input Box */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-2 shadow-inner focus-within:border-cyan-500 transition">
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isListening ? 'Stop recording voice' : 'Voice Dictate prompt'}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isListening ? 'bg-rose-600 text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isListening ? 'Listening to your voice...' : 'Ask AI to write a 3-step cold email sequence, audit spam score, or personalize hooks...'}
              className="flex-1 bg-transparent border-none text-xs md:text-sm text-slate-100 focus:outline-none placeholder-slate-500 px-2"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isLoading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shadow-md shadow-blue-500/20"
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
