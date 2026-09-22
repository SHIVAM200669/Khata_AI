import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Camera,
  X,
  RefreshCw,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import api from '../utils/api.js';
import OcrTransactionReview from './OcrTransactionReview';

export default function LedgerScanner() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [languageCode, setLanguageCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Please select a JPG, PNG, WEBP image or PDF document.');
      return;
    }

    // Validate size (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds 15 MB. Please select a smaller image.');
      return;
    }

    setError('');
    setSelectedFile(file);
    setExtractedText('');
    setBlocks([]);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl('pdf');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedText('');
    setBlocks([]);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please select or capture a ledger image first.');
      return;
    }

    setIsScanning(true);
    setError('');
    setExtractedText('');
    setBlocks([]);

    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      const res = await api.post('/api/ocr/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      if (res.data?.success && res.data?.text) {
        setExtractedText(res.data.text);
        setBlocks(res.data.blocks || []);
        setLanguageCode(res.data.language_code || 'unknown');
      } else {
        setError(res.data?.message || 'No text could be extracted from this document.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      const msg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED'
          ? 'Scanning timed out. Please try with a clearer or smaller image.'
          : 'Failed to scan document. Please ensure good lighting and try again.');
      setError(msg);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopyText = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl bg-[#111726]/80 backdrop-blur-xl border border-white/[0.07] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-6 py-4.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#00E599]/15 border border-[#00E599]/25 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-[#00E599]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Scan Handwritten Ledger</h2>
            <p className="text-xs text-slate-400">
              Upload or photograph a handwritten khata to digitize it.
            </p>
          </div>
        </div>

        {selectedFile && (
          <button
            onClick={handleRemoveFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 border border-white/[0.08] transition-all"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6 flex flex-col gap-5">
        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          id="ledger-file-upload"
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          accept="image/*"
          capture="environment"
          className="hidden"
          id="ledger-camera-capture"
        />

        {/* Upload / Capture Trigger Zone */}
        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-white/[0.1] bg-[#080B11]/50 hover:bg-[#080B11]/80 hover:border-[#00E599]/40 transition-all">
            <div className="w-14 h-14 rounded-3xl bg-[#00E599]/10 border border-[#00E599]/20 flex items-center justify-center mb-3.5 shadow-lg shadow-[#00E599]/10">
              <Upload className="w-7 h-7 text-[#00E599]" />
            </div>

            <p className="text-sm sm:text-base font-bold text-white mb-1">
              Select or Take a Photo of Ledger Page
            </p>
            <p className="text-xs text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
              Supports handwritten Khatabook pages, notebook registers, diary bills, or distributor receipts in Hindi, Tamil, English, and Indic scripts.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-white border border-white/[0.08] transition-all shadow-sm active:scale-95"
              >
                <Upload className="w-4 h-4 text-[#00E599]" />
                <span>Upload Image / PDF</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#10B981] hover:brightness-110 text-xs font-bold text-slate-950 transition-all shadow-lg shadow-[#00E599]/20 active:scale-95"
              >
                <Camera className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Take Photo</span>
              </button>
            </div>
          </div>
        ) : (
          /* File Preview Card */
          <div className="flex flex-col sm:flex-row gap-5 p-4.5 rounded-3xl bg-[#080B11]/70 border border-white/[0.06]">
            {/* Image Preview */}
            <div className="w-full sm:w-48 h-48 rounded-2xl bg-[#111726] border border-white/[0.08] overflow-hidden flex items-center justify-center flex-shrink-0 relative group">
              {previewUrl === 'pdf' ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <FileText className="w-10 h-10 text-[#00E599]" />
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[140px]">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-slate-500">PDF Document</span>
                </div>
              ) : (
                <img
                  src={previewUrl}
                  alt="Ledger Preview"
                  className="w-full h-full object-contain"
                />
              )}

              <button
                onClick={handleRemoveFile}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-950/80 text-slate-400 hover:text-white flex items-center justify-center border border-white/[0.1] transition-colors"
                title="Remove File"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Info and Actions */}
            <div className="flex-1 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[220px]">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Ready to scan with Sarvam Document AI. High-precision extraction for handwritten Indic text and table lines.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 border border-white/[0.08] transition-colors"
                >
                  Replace Image
                </button>

                <button
                  id="ledger-scan-button"
                  onClick={handleScan}
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#10B981] hover:brightness-110 disabled:opacity-50 text-xs font-bold text-slate-950 transition-all shadow-md shadow-[#00E599]/20"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Scanning with Sarvam AI…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                      <span>Scan Ledger</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Loader */}
        {isScanning && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-[#00E599]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-bold text-white">Digitizing Handwritten Ledger…</p>
            <p className="text-xs text-slate-400">
              Sarvam Vision OCR is analyzing handwriting, line breaks, and numbers
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="w-full flex items-start gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Extracted Ledger Text Result Panel */}
        {extractedText && (
          <div className="w-full rounded-3xl bg-[#080B11]/90 border border-[#00E599]/30 p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00E599]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Extracted Ledger Text
                </span>
                {blocks.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-300 border border-white/[0.08] font-mono">
                    {blocks.length} block{blocks.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <button
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 transition-colors border border-white/[0.08]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00E599]" />
                    <span className="text-[#00E599]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            {/* Preserved Formatted Text */}
            <div className="bg-[#111726]/90 rounded-2xl p-4 border border-white/[0.06] overflow-x-auto max-h-96 overflow-y-auto">
              <pre
                id="ocr-extracted-text-output"
                className="text-xs sm:text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed select-text"
              >
                {extractedText}
              </pre>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * OCR text preserved exactly as extracted from handwritten ledger. Preserves original Hindi, Tamil, English scripts, names, and numbers.
            </p>

            {/* Structured Transactions Review & Confirmation */}
            <div className="pt-3 border-t border-white/[0.06]">
              <OcrTransactionReview
                ocrText={extractedText}
                onTransactionsSaved={() => {
                  // Notification or event trigger
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
