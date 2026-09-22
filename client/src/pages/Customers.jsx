import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Phone,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  TrendingUp,
  RefreshCw,
  X,
  Plus,
  ArrowLeft,
  FileText,
  FileDown,
  Mic,
  FileSpreadsheet,
  Info,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Brain,
  Layers,
  Percent,
  History,
  Sparkles,
  CreditCard,
  UserCheck
} from 'lucide-react';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { generateCustomerStatementPDF, generateAllCustomersPDF } from '../utils/pdfGenerator.js';

export default function Customers() {
  const { merchant, user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [intelligenceList, setIntelligenceList] = useState([]);
  const [intelligenceSummary, setIntelligenceSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('intelligence'); // 'intelligence' | 'ledger'
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'attention' | 'outstanding' | 'fully_paid'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Customer Detail Drawer / Modal State
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Add Customer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Fetch customers & intelligence data
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [custRes, intelRes] = await Promise.all([
        api.get('/api/customers', {
          params: {
            search: search || undefined,
            filter: filter === 'attention' ? undefined : (filter !== 'all' ? filter : undefined)
          }
        }),
        api.get('/api/customers/intelligence')
      ]);

      if (custRes.data?.success) {
        setCustomers(custRes.data.customers || []);
        setSummary(custRes.data.summary || null);
      }

      if (intelRes.data?.success) {
        setIntelligenceList(intelRes.data.customers || []);
        setIntelligenceSummary(intelRes.data.summary || null);
      }
    } catch (err) {
      console.error('Fetch customers error:', err);
      setError(err.response?.data?.message || 'Could not connect to customers database.');
    } finally {
      setIsLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    fetchCustomers();

    const handleUpdate = () => fetchCustomers();
    window.addEventListener('kirana:financial-update', handleUpdate);
    return () => window.removeEventListener('kirana:financial-update', handleUpdate);
  }, [fetchCustomers]);

  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);

  // Download complete customer ledger directory PDF
  const handleDownloadAllCustomersPDF = async () => {
    try {
      setDownloadingAllPdf(true);
      await generateAllCustomersPDF({
        customers,
        intelligenceList,
        summary: intelligenceSummary || summary,
        merchant: merchant || { name: user?.displayName || 'Kirana Merchant' }
      });
    } catch (err) {
      console.error('Download all customers PDF error:', err);
    } finally {
      setDownloadingAllPdf(false);
    }
  };

  // Fetch single customer detail and optionally download PDF
  const fetchCustomerDetail = async (id, autoDownload = false) => {
    setSelectedCustomerId(id);
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await api.get(`/api/customers/${id}`);
      if (res.data?.success) {
        setCustomerDetail(res.data);
        if (autoDownload) {
          await generateCustomerStatementPDF({
            customer: res.data.customer,
            metrics: res.data.metrics,
            transactions: res.data.transactions,
            merchant: res.data.merchant
          });
        }
      } else {
        setDetailError(res.data?.message || 'Failed to load customer details.');
      }
    } catch (err) {
      console.error('Fetch customer detail error:', err);
      setDetailError(err.response?.data?.message || 'Could not load customer ledger.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadPDF = async (id, existingDetail = null) => {
    try {
      setDownloadingPdfId(id);
      let detail = existingDetail;
      if (!detail || detail.customer?.id !== id) {
        const res = await api.get(`/api/customers/${id}`);
        if (res.data?.success) {
          detail = res.data;
        }
      }
      if (detail) {
        await generateCustomerStatementPDF({
          customer: detail.customer,
          metrics: detail.metrics,
          transactions: detail.transactions,
          merchant: detail.merchant
        });
      }
    } catch (err) {
      console.error('Download PDF error:', err);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const closeDetail = () => {
    setSelectedCustomerId(null);
    setCustomerDetail(null);
    setDetailError('');
  };

  // Add new customer handler
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      setAddError('Please enter a customer name.');
      return;
    }

    setAddLoading(true);
    setAddError('');
    try {
      const res = await api.post('/api/customers', {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined
      });

      if (res.data?.success) {
        setIsAddModalOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        await fetchCustomers();
        if (res.data.customer?.id) {
          fetchCustomerDetail(res.data.customer.id);
        }
      } else {
        setAddError(res.data?.message || 'Failed to create customer.');
      }
    } catch (err) {
      console.error('Add customer error:', err);
      setAddError(err.response?.data?.message || 'Failed to create customer in database.');
    } finally {
      setAddLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  // Filtered Intelligence List
  const filteredIntelligence = intelligenceList.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = item.name?.toLowerCase().includes(q);
      const matchPhone = item.phone?.toLowerCase().includes(q);
      if (!matchName && !matchPhone) return false;
    }
    if (filter === 'attention') return item.attention_flag;
    if (filter === 'outstanding') return item.outstanding > 0;
    if (filter === 'fully_paid') return item.outstanding === 0 && item.total_credit > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              Khata Ledger Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Khata &amp; Customer Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-[#8E9CAE] mt-0.5">
            Real-time digital khata balances and factual repayment analytics derived dynamically from MySQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadAllCustomersPDF}
            disabled={downloadingAllPdf || customers.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#162215] hover:bg-[#1f301d] border border-[#2B4328] text-xs font-bold text-[#A3E635] transition-all active:scale-95 shadow-sm disabled:opacity-50"
            title="Download Full Customer Directory PDF"
          >
            {downloadingAllPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>Download All PDF</span>
          </button>

          <button
            onClick={fetchCustomers}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#111622] hover:bg-[#161C2A] border border-[#1E2638] text-xs font-semibold text-slate-300 transition-all active:scale-95"
            title="Refresh Khata Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#A3E635] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            id="btn-add-customer"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-slate-950 font-black text-xs sm:text-sm transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
          <div className="flex items-center justify-between text-[#8E9CAE] mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Accounts</span>
            <div className="w-7 h-7 rounded-lg bg-[#0B0E14] flex items-center justify-center text-slate-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono tracking-tight">
            {summary?.total_customers || 0}
          </p>
          <span className="text-[11px] text-[#64748B] mt-1 block">Active merchant accounts</span>
        </div>

        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
          <div className="flex items-center justify-between text-[#FBBF24] mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding Khata</span>
            <div className="w-7 h-7 rounded-lg bg-[#241A0E] flex items-center justify-center text-[#FBBF24]">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#FBBF24] font-mono tracking-tight">
            ₹{Number(summary?.total_outstanding_khata || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-[#8E9CAE] mt-1 block">Receivable from customers</span>
        </div>

        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
          <div className="flex items-center justify-between text-[#8E9CAE] mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Credit Given</span>
            <div className="w-7 h-7 rounded-lg bg-[#0B0E14] flex items-center justify-center text-slate-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono tracking-tight">
            ₹{Number(summary?.total_credit_given || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-[#64748B] mt-1 block">All-time credit sales</span>
        </div>

        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Attention Required</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-300 font-mono tracking-tight">
            {intelligenceSummary?.attention_count || 0}
          </p>
          <span className="text-[11px] text-[#8E9CAE] mt-1 block">Unsettled credit patterns</span>
        </div>
      </div>

      {/* Main View Toggle & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-[#111622] border border-[#1E2638]">
        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 bg-[#0B0E14] rounded-xl border border-[#1E2638]">
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'intelligence'
                ? 'bg-[#A3E635] text-[#091002]'
                : 'text-[#8E9CAE] hover:text-white hover:bg-[#161C2A]'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Repayment Intelligence</span>
            {intelligenceSummary?.attention_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] text-white font-black">
                {intelligenceSummary.attention_count}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ledger'
                ? 'bg-[#A3E635] text-[#091002]'
                : 'text-[#8E9CAE] hover:text-white hover:bg-[#161C2A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Customer Khata Cards</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filter === 'all'
                ? 'bg-[#1C2436] text-white border border-[#2E3B54]'
                : 'bg-transparent text-[#8E9CAE] hover:text-white'
            }`}
          >
            All ({summary?.total_customers || 0})
          </button>

          <button
            onClick={() => setFilter('attention')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filter === 'attention'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-transparent text-rose-400 hover:text-rose-300'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Attention ({intelligenceSummary?.attention_count || 0})</span>
          </button>

          <button
            onClick={() => setFilter('outstanding')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filter === 'outstanding'
                ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                : 'bg-transparent text-[#FBBF24] hover:text-amber-300'
            }`}
          >
            Outstanding ({intelligenceSummary?.customers_with_outstanding || 0})
          </button>

          <button
            onClick={() => setFilter('fully_paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filter === 'fully_paid'
                ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                : 'bg-transparent text-[#8E9CAE] hover:text-white'
            }`}
          >
            Fully Paid
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 rounded-2xl bg-[#111622] border border-[#1E2638] flex items-center gap-3">
        <Search className="w-4 h-4 text-[#5A687D] ml-2" />
        <input
          id="customer-search-input"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer name or phone..."
          className="flex-1 bg-transparent border-none text-xs sm:text-sm text-white placeholder-[#5A687D] focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-[#161C2C]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: REPAYMENT INTELLIGENCE VIEW */}
      {activeTab === 'intelligence' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#8E9CAE] rounded-3xl bg-[#111622] border border-[#1E2638]">
              <RefreshCw className="w-8 h-8 animate-spin text-[#A3E635]" />
              <p className="text-sm font-semibold text-white">Analyzing Repayment Intelligence…</p>
            </div>
          ) : filteredIntelligence.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col items-center justify-center gap-3">
              <Brain className="w-10 h-10 text-[#5A687D]" />
              <p className="text-sm font-semibold text-white">No Customers Found</p>
              <p className="text-xs text-[#8E9CAE] max-w-sm">
                {search ? `No customer matching "${search}"` : 'No customers or credit transactions recorded in MySQL yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredIntelligence.map((cust) => (
                <div
                  key={cust.customer_id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                    cust.attention_flag
                      ? 'bg-[#111622] border-rose-500/40'
                      : 'bg-[#111622] border-[#1E2638]'
                  }`}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#1C2436]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635] font-bold text-sm">
                          {cust.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white tracking-tight">
                              {cust.name}
                            </h3>
                            {cust.attention_flag ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <ShieldAlert className="w-3 h-3" />
                                Attention
                              </span>
                            ) : cust.outstanding > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#241A0E] text-[#FBBF24] border border-[#483318]">
                                Outstanding
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#162215] text-[#A3E635] border border-[#2B4328]">
                                <CheckCircle2 className="w-3 h-3" />
                                Settled
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8E9CAE] flex items-center gap-2 mt-0.5">
                            <Phone className="w-3 h-3 text-[#5A687D]" />
                            <span>{cust.phone || 'No phone recorded'}</span>
                            <span className="text-[#3A485C]">&bull;</span>
                            <span className="font-mono">ID #{cust.customer_id}</span>
                          </p>
                        </div>
                      </div>

                      {/* Outstanding Badge */}
                      <div className="text-right">
                        <span className="text-[11px] text-[#8E9CAE] block font-medium">Outstanding Balance</span>
                        <span className={`text-xl font-black font-mono tracking-tight ${
                          cust.outstanding > 0 ? 'text-[#FBBF24]' : 'text-[#A3E635]'
                        }`}>
                          ₹{Number(cust.outstanding).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Attention Reason Banner */}
                    {cust.attention_flag && cust.attention_reason && (
                      <div className="mt-3.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                        <span className="font-medium">{cust.attention_reason}</span>
                      </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                      <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
                        <span className="text-[10px] text-[#8E9CAE] block font-bold uppercase tracking-wider">Total Credit Given</span>
                        <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                          ₹{Number(cust.total_credit).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#64748B] mt-0.5 block">
                          {cust.credit_transactions} credit sale(s)
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
                        <span className="text-[10px] text-[#8E9CAE] block font-bold uppercase tracking-wider">Total Repaid</span>
                        <span className="text-sm font-bold text-[#A3E635] font-mono mt-0.5 block">
                          ₹{Number(cust.total_repaid).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#64748B] mt-0.5 block">
                          {cust.repayment_transactions} payment(s)
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
                        <span className="text-[10px] text-[#8E9CAE] block font-bold uppercase tracking-wider">Repayment Rate</span>
                        {cust.total_credit > 0 ? (
                          <>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className={`text-sm font-black font-mono ${
                                cust.repayment_rate >= 70
                                  ? 'text-[#A3E635]'
                                  : cust.repayment_rate >= 40
                                  ? 'text-[#FBBF24]'
                                  : 'text-rose-400'
                              }`}>
                                {cust.repayment_rate}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#1C2436] rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  cust.repayment_rate >= 70
                                    ? 'bg-[#A3E635]'
                                    : cust.repayment_rate >= 40
                                    ? 'bg-[#FBBF24]'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${cust.repayment_rate}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-[#64748B] mt-1 block font-mono">No credit history</span>
                        )}
                      </div>

                      <div className="p-3 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
                        <span className="text-[10px] text-[#8E9CAE] block font-bold uppercase tracking-wider">Last Repayment</span>
                        {cust.last_repayment_date ? (
                          <>
                            <span className="text-xs font-bold text-white mt-0.5 block font-mono">
                              {formatDate(cust.last_repayment_date)}
                            </span>
                            <span className="text-[10px] text-[#8E9CAE]">
                              {cust.days_since_last_repayment === 0
                                ? 'Today'
                                : `${cust.days_since_last_repayment}d ago`}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-[#8E9CAE] mt-1 block">
                            No repayment recorded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3.5 border-t border-[#1C2436] flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-mono">
                      Dynamic MySQL Transaction Analysis
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        id={`btn-download-customer-pdf-${cust.customer_id}`}
                        onClick={() => handleDownloadPDF(cust.customer_id)}
                        disabled={downloadingPdfId === cust.customer_id}
                        className="px-3 py-1.5 rounded-xl bg-[#0B0E14] hover:bg-[#161C2C] text-xs font-semibold text-slate-300 transition-all inline-flex items-center gap-1.5 border border-[#1E2638] disabled:opacity-50"
                        title="Download PDF Statement"
                      >
                        <FileDown className="w-3.5 h-3.5 text-[#A3E635]" />
                        <span>{downloadingPdfId === cust.customer_id ? 'Generating…' : 'PDF'}</span>
                      </button>

                      <button
                        id={`btn-view-customer-intel-${cust.customer_id}`}
                        onClick={() => fetchCustomerDetail(cust.customer_id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#161C2C] hover:bg-[#1E273D] text-xs font-bold text-white transition-all inline-flex items-center gap-1.5 border border-[#242F46]"
                      >
                        <span>View Statement</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#A3E635]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOMER KHATA CARDS VIEW */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#8E9CAE] rounded-3xl bg-[#111622] border border-[#1E2638]">
              <RefreshCw className="w-8 h-8 animate-spin text-[#A3E635]" />
              <p className="text-sm font-semibold text-white">Loading Khata Ledger…</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col items-center justify-center gap-3">
              <Users className="w-10 h-10 text-[#5A687D]" />
              <p className="text-sm font-semibold text-white">No Customers Found</p>
              <p className="text-xs text-[#8E9CAE] max-w-sm">
                {search ? `No customer matching "${search}"` : 'No khata transactions recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635] font-bold text-xs">
                          {c.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white">
                            {c.name}
                          </h3>
                          <p className="text-[11px] text-[#8E9CAE] flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-[#5A687D]" />
                            <span>{c.phone || 'No phone'}</span>
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'Fully Paid'
                            ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                            : c.status === 'Inconsistency'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#0B0E14] border border-[#1E2638] mb-4 space-y-2">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-[#8E9CAE]">Outstanding:</span>
                        <span className={`text-base font-black font-mono ${
                          c.outstanding_amount > 0 ? 'text-[#FBBF24]' : 'text-[#A3E635]'
                        }`}>
                          ₹{Number(c.outstanding_amount).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs pt-1.5 border-t border-[#1C2436]">
                        <span className="text-[#8E9CAE]">Total Credit:</span>
                        <span className="font-semibold text-white font-mono">
                          ₹{Number(c.total_credit_sales).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs">
                        <span className="text-[#8E9CAE]">Total Repaid:</span>
                        <span className="font-semibold text-[#A3E635] font-mono">
                          ₹{Number(c.total_khata_repayments).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px] pt-1.5 border-t border-[#1C2436] text-[#8E9CAE]">
                        <span>Last Payment:</span>
                        <span className="text-white font-mono font-medium">
                          {formatDate(c.last_payment_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-download-customer-pdf-tab2-${c.id}`}
                      onClick={() => handleDownloadPDF(c.id)}
                      disabled={downloadingPdfId === c.id}
                      className="px-3 py-2.5 rounded-xl bg-[#0B0E14] hover:bg-[#161C2C] text-xs font-semibold text-slate-300 transition-all inline-flex items-center gap-1.5 border border-[#1E2638] disabled:opacity-50"
                      title="Download PDF Statement"
                    >
                      <FileDown className="w-3.5 h-3.5 text-[#A3E635]" />
                      <span>{downloadingPdfId === c.id ? '…' : 'PDF'}</span>
                    </button>

                    <button
                      id={`btn-view-customer-${c.id}`}
                      onClick={() => fetchCustomerDetail(c.id)}
                      className="flex-1 py-2.5 rounded-xl bg-[#161C2C] hover:bg-[#1E273D] text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 border border-[#242F46]"
                    >
                      <span>View Statement</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#A3E635]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER DETAIL MODAL */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[90vh] bg-[#111622] border border-[#1E2638] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4.5 border-b border-[#1C2436] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {customerDetail?.customer?.name || 'Customer Statement'}
                  </h2>
                  <p className="text-xs text-[#8E9CAE] flex items-center gap-2 mt-0.5">
                    <span>{customerDetail?.customer?.phone || 'No phone recorded'}</span>
                    <span className="text-[#3A485C]">&bull;</span>
                    <span className="font-mono">ID: #{selectedCustomerId}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {customerDetail && (
                  <button
                    onClick={() => handleDownloadPDF(selectedCustomerId, customerDetail)}
                    disabled={downloadingPdfId === selectedCustomerId}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#A3E635] hover:bg-[#BEF264] text-[#091002] text-xs font-bold transition-all shadow-sm"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{downloadingPdfId === selectedCustomerId ? 'Generating PDF…' : 'Download PDF'}</span>
                  </button>
                )}

                <button
                  onClick={closeDetail}
                  className="w-8 h-8 rounded-full bg-[#161C2C] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#A3E635]" />
                  <p className="text-sm font-semibold text-white">Loading Customer Ledger…</p>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {detailError}
                </div>
              ) : customerDetail ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[#241A0E] border border-[#483318]">
                      <span className="text-[10px] uppercase font-bold text-[#FBBF24]">Outstanding Due</span>
                      <p className="text-xl font-extrabold text-[#FBBF24] font-mono mt-0.5">
                        ₹{Number(customerDetail.metrics?.outstanding_amount || 0).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
                      <span className="text-[10px] uppercase font-bold text-[#8E9CAE]">Total Credit</span>
                      <p className="text-xl font-extrabold text-white font-mono mt-0.5">
                        ₹{Number(customerDetail.metrics?.total_credit || 0).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#162215] border border-[#2B4328]">
                      <span className="text-[10px] uppercase font-bold text-[#A3E635]">Total Repaid</span>
                      <p className="text-xl font-extrabold text-[#A3E635] font-mono mt-0.5">
                        ₹{Number(customerDetail.metrics?.total_repaid || 0).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
                      <span className="text-[10px] uppercase font-bold text-[#8E9CAE]">Transactions</span>
                      <p className="text-xl font-extrabold text-white font-mono mt-0.5">
                        {customerDetail.transactions?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Transaction History */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">Transaction History</h3>
                    <div className="rounded-2xl border border-[#1E2638] overflow-x-auto bg-[#0B0E14]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#111622] text-[#8E9CAE] text-[11px] uppercase tracking-wider border-b border-[#1E2638]">
                          <tr>
                            <th className="py-3 px-3.5">Date</th>
                            <th className="py-3 px-3.5">Description</th>
                            <th className="py-3 px-3.5">Type</th>
                            <th className="py-3 px-3.5">Source</th>
                            <th className="py-3 px-3.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1C2436]">
                          {customerDetail.transactions.map((t) => (
                            <tr key={t.id} className="hover:bg-[#141A28]">
                              <td className="py-3 px-3.5 text-[#8E9CAE] font-mono whitespace-nowrap">
                                {formatDate(t.transaction_date)}
                              </td>
                              <td className="py-3 px-3.5 text-white max-w-[200px] truncate">
                                {t.description || '—'}
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    t.transaction_type === 'CREDIT_SALE'
                                      ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                                      : t.transaction_type === 'KHATA_REPAYMENT'
                                      ? 'bg-[#101D2E] text-[#38BDF8] border border-[#1E3A5F]'
                                      : 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                                  }`}
                                >
                                  {t.transaction_type}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#111622] text-slate-300 border border-[#1E2638]">
                                  {t.source}
                                </span>
                              </td>
                              <td className={`py-3 px-3.5 text-right font-mono font-bold ${
                                t.transaction_type === 'KHATA_REPAYMENT'
                                  ? 'text-[#A3E635]'
                                  : t.transaction_type === 'CREDIT_SALE'
                                  ? 'text-[#FBBF24]'
                                  : 'text-white'
                              }`}>
                                {t.transaction_type === 'KHATA_REPAYMENT' ? '-' : '+'}₹{Number(t.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-6 py-3.5 border-t border-[#1C2436] flex items-center justify-between">
              {customerDetail ? (
                <button
                  onClick={() => handleDownloadPDF(selectedCustomerId, customerDetail)}
                  disabled={downloadingPdfId === selectedCustomerId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#A3E635] hover:bg-[#BEF264] text-[#091002] text-xs font-bold transition-all shadow-sm"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download Statement PDF</span>
                </button>
              ) : <div />}

              <button
                onClick={closeDetail}
                className="px-4 py-2 rounded-xl bg-[#161C2C] hover:bg-[#1E273D] text-xs font-bold text-white transition-colors"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#111622] border border-[#1E2638] rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C2436] pb-3.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#A3E635]" />
                <span>Add New Customer</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              {addError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {addError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#1C2436]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#161C2C] hover:bg-[#1E273D] text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#A3E635] hover:bg-[#BEF264] disabled:opacity-50 text-xs font-bold text-slate-950 transition-all shadow-sm"
                >
                  {addLoading ? 'Creating…' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
