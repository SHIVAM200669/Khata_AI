import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  RotateCcw,
  Loader2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Wallet,
  Users,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Mic,
  Square,
  FileDown,
  FileText
} from 'lucide-react';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { generateCustomerStatementPDF, generateAllCustomersPDF } from '../utils/pdfGenerator.js';

export default function Copilot() {
  const { merchant, user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome_1',
      role: 'assistant',
      content:
        'Namaste! I am your **AI Financial Copilot**. I analyze your store\'s live sales, cash drawer balance, customer Khata, and 7-day cash forecast directly from MySQL.\n\nAsk me anything about your finances—like whether you can afford an upcoming supplier payment, who owes you the most Khata, or tomorrow\'s projected cash position.',
      data_cards: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef('');

  // Fetch suggested prompts on mount
  useEffect(() => {
    api.get('/api/agent/suggested-prompts')
      .then(res => {
        if (res.data?.success) {
          setSuggestions(res.data.suggestions || []);
        }
      })
      .catch(err => {
        console.warn('Could not load suggestions:', err.message);
      });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support audio recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = getSupportedMimeType();
      mimeRef.current = mime;

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || 'audio/webm',
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        if (blob.size === 0) return;

        setIsTranscribing(true);
        const ext = mimeRef.current?.includes('ogg') ? '.ogg'
                  : mimeRef.current?.includes('mp4') ? '.mp4'
                  : '.webm';
        
        const formData = new FormData();
        formData.append('audio', blob, `copilot_audio${ext}`);

        try {
          const res = await api.post('/api/voice/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (res.data?.success && res.data?.transcript) {
            handleSendMessage(res.data.transcript);
          } else {
            setError('Could not understand audio.');
          }
        } catch (err) {
          setError('Error transcribing audio.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Could not access microphone.');
    }
  };

  const [downloadingCustId, setDownloadingCustId] = useState(null);

  const handleDownloadCustomerPDF = async (customerId, fallbackName) => {
    try {
      setDownloadingCustId(customerId || fallbackName);
      let customerData = null;
      if (customerId) {
        const res = await api.get(`/api/customers/${customerId}`);
        if (res.data?.success) {
          customerData = res.data;
        }
      }

      if (!customerData && fallbackName) {
        const sRes = await api.get(`/api/customers?search=${encodeURIComponent(fallbackName)}`);
        if (sRes.data?.customers?.length > 0) {
          const matched = sRes.data.customers[0];
          const detRes = await api.get(`/api/customers/${matched.id || matched.customer_id}`);
          if (detRes.data?.success) {
            customerData = detRes.data;
          }
        }
      }

      if (customerData) {
        await generateCustomerStatementPDF({
          customer: customerData.customer,
          metrics: customerData.metrics,
          transactions: customerData.transactions,
          merchant: customerData.merchant
        });
      }
    } catch (err) {
      console.error('Failed to download PDF in Copilot:', err);
      setError('Could not generate PDF statement for customer.');
    } finally {
      setDownloadingCustId(null);
    }
  };

  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);

  const handleDownloadAllCustomersPDF = async () => {
    try {
      setDownloadingAllPdf(true);
      const [custRes, intelRes] = await Promise.all([
        api.get('/api/customers'),
        api.get('/api/customers/intelligence')
      ]);

      const customers = custRes.data?.customers || [];
      const intelligenceList = intelRes.data?.customers || [];
      const summary = intelRes.data?.summary || custRes.data?.summary || {};

      await generateAllCustomersPDF({
        customers,
        intelligenceList,
        summary,
        merchant: merchant || { name: user?.displayName || 'KhataAI Merchant' }
      });
    } catch (err) {
      console.error('Failed to download all customers PDF in Copilot:', err);
      setError('Could not generate all customers PDF directory.');
    } finally {
      setDownloadingAllPdf(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || inputValue).trim();
    if (!queryText || isLoading) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setError('');

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post('/api/agent/chat', {
        message: queryText,
        conversation_history: history
      });

      if (res.data?.success) {
        const assistantMsg = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: res.data.answer,
          intent: res.data.intent,
          data_cards: res.data.data_cards || [],
          target_customer: res.data.target_customer || null,
          source: res.data.source,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setError(res.data?.message || 'Failed to generate financial analysis.');
      }
    } catch (err) {
      console.error('[Copilot] Chat error:', err);
      setError(err.response?.data?.message || 'Could not connect to the AI Financial Agent.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content:
          'Chat history reset. How can I help you check your store\'s finances today?',
        data_cards: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setError('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-5xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-[#111622] border border-[#1E2638] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635]">
            <Bot className="w-5 h-5 stroke-[2.4]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                AI Financial Copilot
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#162215] text-[#A3E635] border border-[#2B4328] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-[#8E9CAE] mt-0.5">
              Conversational intelligence for drawer cash, 7-day forecast, and Khata recovery.
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161C2C] hover:bg-[#1E273D] text-xs font-semibold text-slate-300 transition-all border border-[#242F46]"
          title="Reset Conversation"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#8E9CAE]" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Main Conversation Container */}
      <div className="flex-1 rounded-3xl bg-[#111622] border border-[#1E2638] p-4 sm:p-6 overflow-y-auto space-y-5 flex flex-col">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isUser
                    ? 'bg-[#A3E635] text-[#091002] font-black'
                    : 'bg-[#162215] border border-[#2B4328] text-[#A3E635]'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="flex flex-col gap-2 flex-1">
                <div
                  className={`p-4 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#A3E635] text-[#091002] font-semibold rounded-tr-none shadow-sm'
                      : 'bg-[#0B0E14] text-white border border-[#1E2638] rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {msg.content.split('\n').map((line, lIdx) => {
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return (
                        <p key={lIdx} className={line.trim() === '' ? 'h-2' : 'my-0.5'}>
                          {parts.map((p, pIdx) => {
                            if (p.startsWith('**') && p.endsWith('**')) {
                              return (
                                <strong
                                  key={pIdx}
                                  className={isUser ? 'text-[#091002] font-black' : 'text-white font-black'}
                                >
                                  {p.slice(2, -2)}
                                </strong>
                              );
                            }
                            return p;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  <span
                    className={`block text-[10px] mt-2 font-mono text-right ${
                      isUser ? 'text-[#091002]/70 font-semibold' : 'text-[#64748B]'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {/* Supporting Visual Data Cards */}
                {msg.data_cards && msg.data_cards.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-1">
                    {msg.data_cards.map((card, cIdx) => {
                      const isWarn = card.type === 'warning';
                      const isCash = card.type === 'cash';

                      return (
                        <div
                          key={cIdx}
                          className={`p-3 rounded-2xl border ${
                            isWarn
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : isCash
                              ? 'bg-[#162215] border-[#2B4328] text-[#A3E635]'
                              : 'bg-[#0B0E14] border-[#1E2638] text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1">
                            <span className="truncate">{card.label}</span>
                            {isWarn ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ) : isCash ? (
                              <Wallet className="w-3.5 h-3.5 text-[#A3E635] shrink-0" />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                            )}
                          </div>
                          <p className="text-base font-black font-mono text-white">
                            {card.value}
                          </p>
                          {card.subtitle && (
                            <span className="text-[10px] text-[#64748B] block mt-0.5 truncate">
                              {card.subtitle}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Customer Statement Download Action Card (if customer target is resolved) */}
                {msg.target_customer && (
                  <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#1E2638] flex flex-col sm:flex-row items-center justify-between gap-3 mt-2 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{msg.target_customer.name} Statement</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#241A0E] text-[#FBBF24] border border-[#483318] font-mono">
                            Due: ₹{Number(msg.target_customer.outstanding || 0).toLocaleString('en-IN')}
                          </span>
                        </h4>
                        <p className="text-[11px] text-[#64748B]">Official MySQL Khata statement ready to download</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadCustomerPDF(msg.target_customer.customer_id || msg.target_customer.id, msg.target_customer.name)}
                      disabled={downloadingCustId === (msg.target_customer.customer_id || msg.target_customer.id || msg.target_customer.name)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#A3E635] hover:bg-[#BEF264] disabled:opacity-50 text-[#091002] text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>{downloadingCustId === (msg.target_customer.customer_id || msg.target_customer.id || msg.target_customer.name) ? 'Generating PDF…' : 'Download PDF Statement'}</span>
                    </button>
                  </div>
                )}

                {/* All Customers Directory Download Card */}
                {(msg.target_all_customers || (msg.role === 'assistant' && (msg.content?.toLowerCase().includes('all customer') || msg.content?.toLowerCase().includes('customer list') || msg.content?.toLowerCase().includes('khata directory') || msg.content?.toLowerCase().includes('customers list')))) && (
                  <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#1E2638] flex flex-col sm:flex-row items-center justify-between gap-3 mt-2 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635] shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>Complete Customer Directory &amp; Ledger</span>
                        </h4>
                        <p className="text-[11px] text-[#64748B]">Full PDF list with outstanding balances, credit, and repayment rates</p>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadAllCustomersPDF}
                      disabled={downloadingAllPdf}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#A3E635] hover:bg-[#BEF264] disabled:opacity-50 text-[#091002] text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                      {downloadingAllPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5" />
                      )}
                      <span>{downloadingAllPdf ? 'Generating PDF…' : 'Download All Customers PDF'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-[#162215] border border-[#2B4328] text-[#A3E635] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-3xl rounded-tl-none bg-[#0B0E14] border border-[#1E2638] text-xs text-[#8E9CAE] flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#A3E635]" />
              <span>Analyzing live store records &amp; calculating projections…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs max-w-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {suggestions.length > 0 && (
        <div className="shrink-0 space-y-1.5">
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-[#8E9CAE] uppercase tracking-wider">
            <Lightbulb className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>Suggested Questions</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {suggestions.flatMap(cat => cat.prompts).slice(0, 5).map((p, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSendMessage(p.text)}
                disabled={isLoading}
                className="shrink-0 px-3.5 py-2 rounded-2xl bg-[#111622] border border-[#1E2638] hover:border-[#2E3B54] text-xs text-slate-300 transition-all text-left flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                <span>{p.text}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#A3E635]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="shrink-0 flex items-center gap-2 p-2 rounded-3xl bg-[#111622] border border-[#1E2638] focus-within:border-[#A3E635]/60 transition-all shadow-sm"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask in English, Hindi, or Hinglish (e.g. Can I pay ₹50,000 supplier bill tomorrow?)..."
          disabled={isLoading}
          className="flex-1 bg-transparent px-3.5 py-2 text-xs sm:text-sm text-white placeholder:#5A687D focus:outline-none"
        />

        <button
          type="button"
          onClick={toggleRecording}
          disabled={isLoading || isTranscribing}
          className={`shrink-0 flex items-center justify-center p-2.5 rounded-2xl transition-all ${
            isRecording 
              ? 'bg-rose-500 text-white animate-pulse' 
              : 'bg-[#0B0E14] border border-[#1E2638] text-[#A3E635] hover:bg-[#161C2C]'
          }`}
          title="Voice Ask"
        >
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#A3E635]" />
          ) : isRecording ? (
            <Square className="w-4 h-4 fill-current" />
          ) : (
            <Mic className="w-4 h-4 text-[#A3E635]" />
          )}
        </button>

        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] disabled:opacity-40 disabled:cursor-not-allowed text-[#091002] text-xs font-black transition-all shadow-sm active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Ask Copilot</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
