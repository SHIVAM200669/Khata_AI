import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Check,
  HelpCircle,
  ArrowRight,
  User,
  IndianRupee,
  Calendar,
  Layers,
  ShieldAlert
} from 'lucide-react';
import api from '../utils/api.js';
import PreCreditWarningModal from './PreCreditWarningModal';
import CustomerResolutionModal from './CustomerResolutionModal';

// ---------- helpers ----------

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Format timestamp to local 12-hour time (e.g., "11:34 PM" or "Today, 11:34 PM") */
function formatLocalTime(timestamp, dateStr) {
  try {
    const d = timestamp ? new Date(timestamp) : (dateStr ? new Date(dateStr) : new Date());
    if (isNaN(d.getTime())) return 'Just now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return 'Just now';
  }
}

const MAX_DURATION = 30; // seconds

const TYPE_CONFIG = {
  CASH_SALE: {
    label: 'Cash Sale',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    cashImpact: (amt) => `+ ₹${Number(amt).toLocaleString('en-IN')}`,
    cashImpactClass: 'text-emerald-400',
    description: 'Cash received at counter'
  },
  CREDIT_SALE: {
    label: 'Credit Sale (Goods)',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400',
    cashImpact: (_amt, isLoan) => isLoan ? `- ₹${Number(_amt).toLocaleString('en-IN')}` : 'No Change (₹0)',
    cashImpactClass: (isLoan) => isLoan ? 'text-rose-400' : 'text-slate-400',
    description: 'Goods on credit / Cash loan'
  },
  KHATA_REPAYMENT: {
    label: 'Khata Repayment',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    dotClass: 'bg-sky-400',
    cashImpact: (amt) => `+ ₹${Number(amt).toLocaleString('en-IN')}`,
    cashImpactClass: 'text-emerald-400',
    description: 'Past debt returned'
  },
  EXPENSE: {
    label: 'Expense / Payment',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    dotClass: 'bg-rose-400',
    cashImpact: (amt) => `- ₹${Number(amt).toLocaleString('en-IN')}`,
    cashImpactClass: 'text-rose-400',
    description: 'Supplier payout / Shop bills'
  }
};

export default function VoiceRecorder({ onTransactionConfirmed }) {
  // Recording & Transcription state
  const [recState, setRecState] = useState('idle');
  // idle | recording | recorded | transcribing | done
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [langCode, setLangCode] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Module 4: Structured Transaction state
  const [isParsing, setIsParsing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [isAmbiguous, setIsAmbiguous] = useState(false);
  const [possibleTypes, setPossibleTypes] = useState([]);
  const [clarificationQuestion, setClarificationQuestion] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForms, setEditForms] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedData, setSavedData] = useState(null);

  // Module 8 Part 2: Pre-Credit Advisory Warning State
  const [preCreditWarningData, setPreCreditWarningData] = useState(null);
  const [showPreCreditModal, setShowPreCreditModal] = useState(false);

  // Customer Entity Resolution State
  const [resolutionData, setResolutionData] = useState(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [pendingResolutionTxIndex, setPendingResolutionTxIndex] = useState(null);

  // Refs
  const mediaRecRef = useRef(null);
  const streamRef   = useRef(null);
  const chunksRef   = useRef([]);
  const blobRef     = useRef(null);
  const timerRef    = useRef(null);
  const audioElRef  = useRef(null);
  const mimeRef     = useRef('');

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-detect Pre-Credit Attention as soon as transaction is parsed or edited
  useEffect(() => {
    const creditItem = transactions.find(t => t.transaction_type === 'CREDIT_SALE' && t.customer_name?.trim());
    if (creditItem && !saveSuccess) {
      api.post('/api/customers/pre-credit-check', {
        customer_name: creditItem.customer_name.trim(),
        amount: parseFloat(creditItem.amount) || 0
      })
      .then(res => {
        if (res.data?.success && res.data.show_warning) {
          setPreCreditWarningData(res.data);
        } else {
          setPreCreditWarningData(null);
        }
      })
      .catch(err => {
        console.warn('Auto pre-credit check error:', err.message);
      });
    } else {
      setPreCreditWarningData(null);
    }
  }, [transactions, saveSuccess]);

  // ----- PARSE TRANSCRIPT (MODULE 4) -----
  const parseTranscript = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    setIsParsing(true);
    setError('');
    setIsSaving(false);
    setSaveSuccess(false);
    setSavedData(null);

    try {
      const res = await api.post('/api/transactions/parse-voice', { transcript: text });
      if (res.data?.success && Array.isArray(res.data.transactions)) {
        setTransactions(res.data.transactions);
        setIsAmbiguous(Boolean(res.data.is_ambiguous));
        setPossibleTypes(res.data.possible_types || ['CREDIT_SALE', 'KHATA_REPAYMENT']);
        setClarificationQuestion(res.data.clarification_question);

        // Initialize edit forms copy
        setEditForms(res.data.transactions.map(t => ({
          customer_name: t.customer_name || '',
          amount: t.amount || '',
          transaction_type: t.transaction_type || '',
          is_cash_loan: Boolean(t.is_cash_loan),
          description: t.description || ''
        })));
      } else {
        setError(res.data?.message || 'Could not extract financial transaction.');
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError(err.response?.data?.message || 'Could not parse financial transaction. Please try again.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  // ----- START RECORDING -----
  const startRecording = useCallback(async () => {
    setError('');
    setTranscript('');
    setLangCode('');
    setTransactions([]);
    setIsAmbiguous(false);
    setIsEditing(false);
    setSaveSuccess(false);
    setSavedData(null);
    blobRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support audio recording.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please allow microphone access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError('Could not access the microphone. Please try again.');
      }
      return;
    }

    streamRef.current = stream;
    const mime = getSupportedMimeType();
    mimeRef.current = mime;

    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mediaRecRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeRef.current || 'audio/webm',
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());

      if (blob.size === 0) {
        setError('Recording is empty. Please try again.');
        setRecState('idle');
        return;
      }

      blobRef.current = blob;
      setRecState('recorded');
    };

    recorder.start(250);
    setRecState('recording');
    setElapsed(0);

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      if (secs >= MAX_DURATION) {
        clearInterval(timerRef.current);
        recorder.stop();
      }
    }, 250);
  }, []);

  // ----- STOP RECORDING -----
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
  }, []);

  // ----- PLAY / PAUSE -----
  const togglePlay = useCallback(() => {
    if (!blobRef.current) return;
    if (!audioElRef.current) {
      audioElRef.current = new Audio(URL.createObjectURL(blobRef.current));
      audioElRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioElRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // ----- RECORD AGAIN -----
  const recordAgain = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    setIsPlaying(false);
    blobRef.current = null;
    setTranscript('');
    setLangCode('');
    setError('');
    setTransactions([]);
    setIsAmbiguous(false);
    setIsEditing(false);
    setSaveSuccess(false);
    setSavedData(null);
    setRecState('idle');
    setElapsed(0);
  }, []);

  // ----- TRANSCRIBE & AUTO-PARSE -----
  const transcribe = useCallback(async () => {
    if (!blobRef.current) return;
    setError('');
    setRecState('transcribing');

    const ext = mimeRef.current?.includes('ogg') ? '.ogg'
              : mimeRef.current?.includes('mp4') ? '.mp4'
              : '.webm';

    const formData = new FormData();
    formData.append('audio', blobRef.current, `recording${ext}`);

    try {
      const res = await api.post('/api/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (res.data?.success && res.data?.transcript) {
        setTranscript(res.data.transcript);
        setLangCode(res.data.language_code || '');
        setRecState('done');

        // Trigger Module 4 AI semantic parsing automatically!
        await parseTranscript(res.data.transcript);
      } else {
        setError(res.data?.message || 'No transcript returned. Please try again.');
        setRecState('recorded');
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED'
          ? 'Transcription timed out. Please try a shorter recording.'
          : 'Could not transcribe recording. Please try again.');
      setError(msg);
      setRecState('recorded');
    }
  }, [parseTranscript]);

  // ----- SELECT AMBIGUITY TYPE -----
  const handleSelectAmbiguityType = (txIndex, type) => {
    setTransactions(prev => {
      const copy = [...prev];
      copy[txIndex] = { ...copy[txIndex], transaction_type: type };
      return copy;
    });
    setEditForms(prev => {
      const copy = [...prev];
      copy[txIndex] = { ...copy[txIndex], transaction_type: type };
      return copy;
    });
    setIsAmbiguous(false);
  };

  // ----- EDIT FORM HANDLERS -----
  const handleEditChange = (index, field, value) => {
    setEditForms(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveEdit = (index) => {
    setTransactions(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        customer_name: editForms[index].customer_name || null,
        amount: parseFloat(editForms[index].amount) || 0,
        transaction_type: editForms[index].transaction_type || null,
        is_cash_loan: Boolean(editForms[index].is_cash_loan),
        description: editForms[index].description || ''
      };
      return copy;
    });
    setIsEditing(false);
  };

  // ----- RESOLUTION MODAL HANDLERS -----
  const handleSelectResolvedCustomer = (cand) => {
    if (pendingResolutionTxIndex === null) return;
    const updated = [...transactions];
    updated[pendingResolutionTxIndex] = {
      ...updated[pendingResolutionTxIndex],
      customer_id: cand.id,
      customer_name: cand.name
    };
    setTransactions(updated);
    setEditForms(prev => {
      const copy = [...prev];
      if (copy[pendingResolutionTxIndex]) {
        copy[pendingResolutionTxIndex].customer_name = cand.name;
      }
      return copy;
    });
    setShowResolutionModal(false);
    setResolutionData(null);
    setPendingResolutionTxIndex(null);
    // Resume confirmation flow
    confirmTransactions(false, updated);
  };

  const handleCreateNewCustomerConfirmed = (standardizedName) => {
    if (pendingResolutionTxIndex === null) return;
    const updated = [...transactions];
    updated[pendingResolutionTxIndex] = {
      ...updated[pendingResolutionTxIndex],
      customer_name: standardizedName || updated[pendingResolutionTxIndex].customer_name,
      confirm_create_customer: true
    };
    setTransactions(updated);
    setEditForms(prev => {
      const copy = [...prev];
      if (copy[pendingResolutionTxIndex]) {
        copy[pendingResolutionTxIndex].customer_name = standardizedName || copy[pendingResolutionTxIndex].customer_name;
      }
      return copy;
    });
    setShowResolutionModal(false);
    setResolutionData(null);
    setPendingResolutionTxIndex(null);
    // Resume confirmation flow
    confirmTransactions(false, updated);
  };

  // ----- CONFIRM TRANSACTIONS (SAVE TO MYSQL) -----
  const confirmTransactions = async (forceBypass = false, customTxs = null) => {
    const txList = customTxs || transactions;
    if (txList.length === 0) return;

    // 1. Validation
    for (let i = 0; i < txList.length; i++) {
      const tx = txList[i];
      if (!tx.transaction_type) {
        setError(`Please select a transaction type for ${tx.customer_name || 'entry #' + (i + 1)} before confirming.`);
        return;
      }
      if (!tx.amount || tx.amount <= 0) {
        setError(`Transaction #${i + 1} must have a valid amount.`);
        return;
      }
    }

    // 2. Customer Entity Resolution (Module Safety Rule)
    for (let i = 0; i < txList.length; i++) {
      const tx = txList[i];
      const needsCust = tx.transaction_type === 'CREDIT_SALE' || tx.transaction_type === 'KHATA_REPAYMENT' || Boolean(tx.customer_name?.trim());
      if (needsCust && tx.customer_name?.trim() && !tx.customer_id && !tx.confirm_create_customer) {
        try {
          const resRes = await api.post('/api/customers/resolve-entity', { name: tx.customer_name.trim() });
          if (resRes.data?.success) {
            if (resRes.data.status === 'AMBIGUOUS_MATCH') {
              setResolutionData(resRes.data);
              setPendingResolutionTxIndex(i);
              setShowResolutionModal(true);
              return; // PAUSE transaction ONLY when multiple candidates match
            } else if (resRes.data.status === 'EXACT_MATCH' && resRes.data.customer) {
              tx.customer_id = resRes.data.customer.id;
              tx.customer_name = resRes.data.customer.name;
            }
          }
        } catch (resErr) {
          console.warn('[VoiceRecorder] Customer resolve check error:', resErr.message);
        }
      }
    }

    // Module 8 Part 2: Pre-Credit Check
    // If giving additional credit to an existing customer and not bypassed, check for advisory warning
    if (!forceBypass) {
      const creditItem = txList.find(t => t.transaction_type === 'CREDIT_SALE' && t.customer_name?.trim());
      if (creditItem) {
        try {
          const preRes = await api.post('/api/customers/pre-credit-check', {
            customer_name: creditItem.customer_name.trim(),
            amount: creditItem.amount
          });
          if (preRes.data?.show_warning) {
            setPreCreditWarningData(preRes.data);
            setShowPreCreditModal(true);
            return;
          }
        } catch (preErr) {
          console.warn('[VoiceRecorder] Pre-credit check warning:', preErr.message);
          // If check fails, continue gracefully without blocking
        }
      }
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        transactions: txList.map(t => ({
          customer_id: t.customer_id || undefined,
          customer_name: t.customer_name,
          confirm_create_customer: Boolean(t.confirm_create_customer),
          amount: t.amount,
          transaction_type: t.transaction_type,
          is_cash_loan: Boolean(t.is_cash_loan),
          description: t.description,
          transaction_date: t.transaction_date,
          source: 'VOICE'
        }))
      };

      const res = await api.post('/api/transactions/confirm', payload);

      if (res.data?.success) {
        setSaveSuccess(true);
        setSavedData(res.data);
        setShowPreCreditModal(false);
        setShowResolutionModal(false);
        window.dispatchEvent(new CustomEvent('kirana:financial-update', { detail: res.data }));
        if (onTransactionConfirmed) {
          onTransactionConfirmed(res.data.saved_transactions, res.data.current_cash_balance);
        }
      } else {
        setError(res.data?.message || 'Failed to record transaction in database.');
      }
    } catch (err) {
      console.error('Confirm error:', err);
      const errCode = err.response?.data?.code;
      if (errCode === 'AMBIGUOUS_CUSTOMER' || errCode === 'CUSTOMER_NOT_FOUND') {
        setResolutionData(err.response?.data);
        setPendingResolutionTxIndex(0);
        setShowResolutionModal(true);
      } else {
        setError(err.response?.data?.message || 'Failed to save transaction to database. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-[#111622] border border-[#1E2638] overflow-hidden shadow-2xl">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-[#1E2638] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#162215] border border-[#23351d] flex items-center justify-center">
            <Mic className="w-4 h-4 text-[#A3E635]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Voice Transaction Hub</h2>
            <p className="text-xs text-slate-400">
              Speak in Hindi, Tamil, English or mixed Indic language.
            </p>
          </div>
        </div>

        {recState === 'done' && (
          <button
            onClick={recordAgain}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161C2C] hover:bg-[#1E2638] text-xs font-medium text-slate-300 transition-colors border border-[#1E2638]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>New Voice Note</span>
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="px-6 py-6 flex flex-col items-center gap-5">

        {/* ---- IDLE ---- */}
        {recState === 'idle' && (
          <button
            id="voice-start-recording"
            onClick={startRecording}
            className="group flex items-center gap-3 px-6 py-3.5 rounded-2xl
                       bg-[#A3E635] hover:bg-[#bef264] text-[#091002] font-semibold text-sm
                       transition-all duration-200 shadow-lg shadow-[#A3E635]/20
                       hover:scale-[1.02] active:scale-[0.98]"
          >
            <Mic className="w-5 h-5 animate-pulse" />
            <span>Start Voice Recording</span>
          </button>
        )}

        {/* ---- RECORDING ---- */}
        {recState === 'recording' && (
          <>
            <div className="relative flex items-center justify-center">
              <span className="absolute w-20 h-20 rounded-full bg-rose-500/20 animate-ping" />
              <span className="absolute w-16 h-16 rounded-full bg-rose-500/10 animate-pulse" />
              <button
                id="voice-stop-recording"
                onClick={stopRecording}
                className="relative z-10 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-400
                           flex items-center justify-center transition-colors shadow-lg shadow-rose-500/30"
              >
                <Square className="w-5 h-5 text-white fill-white" />
              </button>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-rose-400 tracking-wider uppercase animate-pulse">
                Recording…
              </p>
              <p className="text-2xl font-mono font-bold text-white mt-1">{fmtTime(elapsed)}</p>
              {elapsed >= MAX_DURATION - 5 && elapsed < MAX_DURATION && (
                <p className="text-[11px] text-amber-400 mt-1">Stopping in {MAX_DURATION - elapsed}s…</p>
              )}
            </div>
          </>
        )}

        {/* ---- RECORDED (Awaiting transcribe) ---- */}
        {recState === 'recorded' && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="w-full max-w-md flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <button
                id="voice-play-toggle"
                onClick={togglePlay}
                className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20
                           flex items-center justify-center hover:bg-violet-500/25 transition-colors"
              >
                {isPlaying
                  ? <Pause className="w-4 h-4 text-violet-400" />
                  : <Play  className="w-4 h-4 text-violet-400 ml-0.5" />}
              </button>
              <span className="text-sm font-mono text-slate-300">{fmtTime(elapsed)}</span>
              <div className="flex-1 h-4 flex items-end gap-px">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-violet-500/30"
                    style={{ height: `${Math.max(15, Math.random() * 100)}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="voice-record-again"
                onClick={recordAgain}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300
                           hover:bg-slate-700/80 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Record Again
              </button>
              <button
                id="voice-transcribe"
                onClick={transcribe}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl
                           bg-[#A3E635] hover:bg-[#bef264] text-[#091002] font-bold text-xs
                           transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Transcribe & Parse
              </button>
            </div>
          </div>
        )}

        {/* ---- TRANSCRIBING LOADER ---- */}
        {recState === 'transcribing' && (
          <div className="flex flex-col items-center gap-3 py-3">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            <p className="text-sm font-medium text-slate-300">Transcribing with Sarvam AI…</p>
            <p className="text-[11px] text-slate-500">Processing audio stream</p>
          </div>
        )}

        {/* ---- ERROR ALERT ---- */}
        {error && (
          <div className="w-full flex items-start gap-3 px-4 py-3 rounded-xl
                          bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* ---- TRANSCRIPT OUTPUT (MODULE 3) ---- */}
        {transcript && (
          <div className="w-full rounded-xl bg-slate-800/40 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Voice Transcript
              </span>
              {langCode && langCode !== 'unknown' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700">
                  {langCode}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed italic" id="voice-transcript-output">
              "{transcript}"
            </p>
          </div>
        )}

        {/* ---- PARSING LOADER ---- */}
        {isParsing && (
          <div className="flex items-center gap-3 py-2 text-violet-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-medium">Extracting transaction semantics with Sarvam AI…</span>
          </div>
        )}

        {/* ---- MODULE 4: STRUCTURED TRANSACTION DETECTED ---- */}
        {transactions.length > 0 && !isParsing && (
          <div className="w-full flex flex-col gap-4 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white tracking-wide uppercase">
                  {transactions.length > 1 ? `${transactions.length} Transactions Detected` : 'Transaction Detected'}
                </span>
              </div>

              {!isEditing && !saveSuccess && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition-colors border border-slate-700"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {/* Transactions List */}
            {transactions.map((tx, idx) => {
              const typeInfo = TYPE_CONFIG[tx.transaction_type] || {
                label: 'Unspecified Type',
                badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
                dotClass: 'bg-slate-400',
                description: 'Select transaction type'
              };

              return (
                <div
                  key={idx}
                  className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-4 transition-all"
                >
                  {isEditing ? (
                    /* Inline Edit Form */
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Customer / Party</label>
                          <input
                            type="text"
                            value={editForms[idx]?.customer_name || ''}
                            onChange={(e) => handleEditChange(idx, 'customer_name', e.target.value)}
                            placeholder="e.g. Ramesh"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            value={editForms[idx]?.amount || ''}
                            onChange={(e) => handleEditChange(idx, 'amount', e.target.value)}
                            placeholder="e.g. 500"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Transaction Type</label>
                          <select
                            value={editForms[idx]?.transaction_type || ''}
                            onChange={(e) => handleEditChange(idx, 'transaction_type', e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">-- Select Type --</option>
                            <option value="CASH_SALE">Cash Sale (Cash received: +Cash)</option>
                            <option value="CREDIT_SALE">Credit / Khata (Udhar)</option>
                            <option value="KHATA_REPAYMENT">Khata Repayment (Customer repaid: +Cash)</option>
                            <option value="EXPENSE">Expense / Payment (-Cash)</option>
                          </select>

                          {editForms[idx]?.transaction_type === 'CREDIT_SALE' && (
                            <div className="mt-2 flex items-center gap-3">
                              <label className="text-[11px] text-slate-400">Credit Nature:</label>
                              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`credit_mode_${idx}`}
                                  checked={!editForms[idx]?.is_cash_loan}
                                  onChange={() => handleEditChange(idx, 'is_cash_loan', false)}
                                  className="text-emerald-500"
                                />
                                <span>Goods (No Cash Δ)</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`credit_mode_${idx}`}
                                  checked={Boolean(editForms[idx]?.is_cash_loan)}
                                  onChange={() => handleEditChange(idx, 'is_cash_loan', true)}
                                  className="text-amber-500"
                                />
                                <span>Cash Loan (-Cash)</span>
                              </label>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Description / Note</label>
                          <input
                            type="text"
                            value={editForms[idx]?.description || ''}
                            onChange={(e) => handleEditChange(idx, 'description', e.target.value)}
                            placeholder="Optional note"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1 rounded-lg bg-slate-700 text-xs text-slate-300 hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(idx)}
                          className="px-3 py-1 rounded-lg bg-emerald-500 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-700/50">
                        {/* Transaction Type Badge + Cash Impact */}
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeInfo.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${typeInfo.dotClass}`} />
                            {tx.transaction_type === 'CREDIT_SALE' && tx.is_cash_loan
                              ? 'Cash Loan (Udhar Lent)'
                              : typeInfo.label}
                          </div>

                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700 text-slate-400">
                            Cash: <span className={typeof typeInfo.cashImpactClass === 'function' ? typeInfo.cashImpactClass(tx.is_cash_loan) : typeInfo.cashImpactClass}>
                              {typeof typeInfo.cashImpact === 'function' ? typeInfo.cashImpact(tx.amount, tx.is_cash_loan) : '—'}
                            </span>
                          </span>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <span className="text-lg font-bold font-mono text-white">
                            ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Detail row */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-400">Customer / Party:</span>
                          <span className="font-medium text-white truncate">
                            {tx.customer_name || 'None / Counter'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-400">Date:</span>
                          <span className="font-mono text-slate-300">
                            {tx.has_explicit_date ? tx.transaction_date.slice(0, 10) : `Today (${formatLocalTime(tx.timestamp, tx.transaction_date)})`}
                          </span>
                        </div>

                        <div className="col-span-2 sm:col-span-1 text-slate-400 truncate">
                          <span className="text-slate-500">Note: </span>
                          <span>{tx.description || 'Voice entry'}</span>
                        </div>
                      </div>

                      {/* Ambiguity Prompt & Selection */}
                      {(!tx.transaction_type || isAmbiguous) && (
                        <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-amber-300 text-xs">
                            <HelpCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{clarificationQuestion || 'Please specify the exact nature of this transaction:'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {possibleTypes.map((pType) => (
                              <button
                                key={pType}
                                onClick={() => handleSelectAmbiguityType(idx, pType)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  tx.transaction_type === pType
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                                    : 'bg-slate-800 text-amber-200 hover:bg-slate-700 border border-amber-500/30'
                                }`}
                              >
                                {TYPE_CONFIG[pType]?.label || pType}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Pre-Credit Repayment Attention Warning & Advisory Decision Card */}
            {preCreditWarningData?.show_warning && !saveSuccess && (
              <div className="w-full rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 p-4 text-rose-300 shadow-lg shadow-rose-950/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                        Repayment Attention Advisory
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-300 border border-rose-500/30 font-mono">
                        Repayment Rate: {preCreditWarningData.repayment_rate}%
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white mt-1">
                      {preCreditWarningData.customer?.name} already has ₹{Number(preCreditWarningData.current_outstanding).toLocaleString('en-IN')} pending
                    </p>
                    <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
                      {preCreditWarningData.warning_reason}
                    </p>

                    {/* Breakdown row */}
                    <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/20 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Current Due</span>
                        <span className="text-xs font-bold text-amber-400 font-mono">₹{Number(preCreditWarningData.current_outstanding).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">+ New Credit</span>
                        <span className="text-xs font-bold text-rose-400 font-mono">₹{Number(preCreditWarningData.new_credit_amount).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">= Projected Due</span>
                        <span className="text-xs font-bold text-white font-mono">₹{Number(preCreditWarningData.projected_outstanding).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-rose-500/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-300">
                        Would you like to give additional credit to this customer?
                      </span>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={recordAgain}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-slate-700"
                        >
                          Cancel / Reject
                        </button>
                        <button
                          onClick={() => confirmTransactions(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-rose-500/20"
                        >
                          Review & Give Credit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            {!saveSuccess ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-400">
                  Click confirm to save transaction directly to MySQL ledger.
                </span>

                <button
                  id="voice-confirm-transaction"
                  onClick={confirmTransactions}
                  disabled={isSaving || transactions.some(t => !t.transaction_type)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl
                             bg-[#A3E635] hover:bg-[#bef264] disabled:opacity-50 disabled:cursor-not-allowed
                             text-[#091002] font-bold text-xs transition-all shadow-md shadow-[#A3E635]/20"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording to MySQL…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirm Transaction</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Success Banner */
              <div className="w-full p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">
                      Transaction Confirmed & Saved to MySQL!
                    </p>
                    <p className="text-[11px] text-emerald-300">
                      Ledger and merchant cash balance updated in real-time.
                    </p>
                  </div>
                </div>

                <button
                  onClick={recordAgain}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                >
                  Record Another
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pre-Credit Advisory Warning Modal */}
        <PreCreditWarningModal
          isOpen={showPreCreditModal}
          warningData={preCreditWarningData}
          onCancel={() => setShowPreCreditModal(false)}
          onConfirm={() => {
            setShowPreCreditModal(false);
            confirmTransactions(true);
          }}
        />

        {/* Safe Customer Entity Resolution Modal (Module Safety Rule) */}
        <CustomerResolutionModal
          isOpen={showResolutionModal}
          resolutionData={resolutionData}
          onClose={() => {
            setShowResolutionModal(false);
            setResolutionData(null);
            setPendingResolutionTxIndex(null);
          }}
          onSelectCustomer={handleSelectResolvedCustomer}
          onCreateNewCustomer={handleCreateNewCustomerConfirmed}
        />
      </div>
    </div>
  );
}
