import React, { useState, useEffect } from 'react';
import { dataService } from '../services/api';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Filter,
  Search,
  RefreshCw,
  Eye,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';

const DataManagement = () => {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'transactions' | 'customers' | 'accounts'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');

  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // Customers & Accounts
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'transactions') loadTransactions();
    if (activeTab === 'customers') loadCustomers();
    if (activeTab === 'accounts') loadAccounts();
  }, [activeTab, page, riskFilter]);

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const data = await dataService.getTransactions({
        search: search || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
        riskLevel: riskFilter !== 'all' ? riskFilter : undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      if (data.success) {
        setTransactions(data.transactions);
        setTxTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  };

  const loadCustomers = async () => {
    setEntityLoading(true);
    try {
      const data = await dataService.getCustomers();
      if (data.success) setCustomers(data.customers);
    } catch (err) {
      console.error(err);
    } finally {
      setEntityLoading(false);
    }
  };

  const loadAccounts = async () => {
    setEntityLoading(true);
    try {
      const data = await dataService.getAccounts();
      if (data.success) setAccounts(data.accounts);
    } catch (err) {
      console.error(err);
    } finally {
      setEntityLoading(false);
    }
  };

  const openTxDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await dataService.getTransactionDetail(id);
      if (res.success) setSelectedTx(res.transaction);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEvaluateTx = async (id) => {
    setEvaluating(true);
    try {
      await dataService.evaluateTransaction(id);
      await openTxDetail(id);
      loadTransactions();
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a CSV file first.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await dataService.uploadCSV(formData);
      setUploadResult(res);
      setFile(null);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Error uploading dataset.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Subnav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Financial Data Vault</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 2
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ingest financial feeds, inspect transaction ledgers, evaluate risk, and manage customer accounts.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'upload' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Upload Dataset
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'transactions' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Transactions ({txTotal})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'customers' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'accounts' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Accounts
          </button>
        </div>
      </div>

      {/* Tab 1: Upload Dataset */}
      {activeTab === 'upload' && (
        <div className="glass-card p-8 rounded-2xl border border-slate-800 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Upload Financial CSV Feed</h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports standard bank feeds. Automatic duplicate suppression and schema verification enabled.
            </p>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-8 text-center transition-all bg-slate-900/40">
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block">
                <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <span className="text-sm font-medium text-slate-200 block">
                  {file ? file.name : 'Choose CSV file or drag & drop here'}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">Maximum file size: 50MB</span>
              </label>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadResult && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{uploadResult.message}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 font-mono text-[11px]">
                  <div>Parsed: {uploadResult.summary?.rowsParsed}</div>
                  <div>New Txs: {uploadResult.summary?.transactionsCreated}</div>
                  <div>Duplicates: {uploadResult.summary?.duplicateRowsIgnored}</div>
                  <div>Rejected: {uploadResult.summary?.rejectedRowsCount}</div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                'Parse & Ingest Dataset'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Transactions Table with Search, Filter & Pagination */}
      {activeTab === 'transactions' && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search accounts, description, sender..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (setPage(0), loadTransactions())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value);
                  setPage(0);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">All Risk Tiers</option>
                <option value="High">High Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="Low">Low Risk</option>
                <option value="Unevaluated">Unevaluated</option>
              </select>

              <input
                type="number"
                placeholder="Min $"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="number"
                placeholder="Max $"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={() => {
                  setPage(0);
                  loadTransactions();
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>
            </div>

            <button
              onClick={loadTransactions}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Refresh transactions"
            >
              <RefreshCw className={`w-4 h-4 ${txLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">From Account</th>
                  <th className="py-3 px-4">To Account</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Type / Channel</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                      {txLoading ? 'Loading transaction records...' : 'No transactions found.'}
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400">#{tx.id}</td>
                      <td className="py-3 px-4 text-cyan-300 font-semibold">{tx.from_account || 'EXTERNAL'}</td>
                      <td className="py-3 px-4 text-indigo-300 font-semibold">{tx.to_account || 'EXTERNAL'}</td>
                      <td className="py-3 px-4 font-bold text-white">
                        ${parseFloat(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {tx.currency}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        <span className="capitalize">{tx.transaction_type}</span> • <span className="text-slate-500">{tx.channel}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{new Date(tx.transaction_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {tx.risk_level ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              tx.risk_level === 'High'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : tx.risk_level === 'Medium'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {tx.risk_level} ({Math.round(tx.risk_score)})
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unevaluated</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openTxDetail(tx.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-sans inline-flex items-center gap-1 border border-slate-700"
                        >
                          <Eye className="w-3 h-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <div>
              Showing {transactions.length > 0 ? page * pageSize + 1 : 0} to {Math.min(txTotal, (page + 1) * pageSize)} of {txTotal} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Page {page + 1} of {Math.max(1, Math.ceil(txTotal / pageSize))}</span>
              <button
                disabled={(page + 1) * pageSize >= txTotal}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Customers Table */}
      {activeTab === 'customers' && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Nationality</th>
                  <th className="py-3 px-4">Linked Accounts</th>
                  <th className="py-3 px-4">Total Outbound Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{c.id}</td>
                    <td className="py-3 px-4 font-semibold text-white">{c.first_name} {c.last_name}</td>
                    <td className="py-3 px-4 text-cyan-400 font-mono">{c.email}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{c.phone || <span className="text-slate-600">Unspecified</span>}</td>
                    <td className="py-3 px-4 text-slate-300">{c.nationality || 'Unknown'}</td>
                    <td className="py-3 px-4 font-mono text-indigo-400">{c.account_count} Account(s)</td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      ${parseFloat(c.total_outbound_volume || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Accounts Table */}
      {activeTab === 'accounts' && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4">Customer Holder</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Activity (Sent/Received)</th>
                  <th className="py-3 px-4">Open Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{acc.id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300">{acc.account_number}</td>
                    <td className="py-3 px-4 text-white">
                      {acc.first_name ? `${acc.first_name} ${acc.last_name}` : <span className="text-slate-500 italic">Unassigned Holder</span>}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-300">{acc.account_type}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">{acc.currency}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {acc.sent_count} sent / {acc.received_count} recv
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{new Date(acc.open_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedTx(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2 font-mono text-xs">
              <span className="text-slate-400">TRANSACTION #{selectedTx.id}</span>
              {selectedTx.risk_level ? (
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    selectedTx.risk_level === 'High'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : selectedTx.risk_level === 'Medium'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {selectedTx.risk_level} ({Math.round(selectedTx.risk_score)} pts)
                </span>
              ) : (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  Unevaluated
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-white mb-4">
              ${parseFloat(selectedTx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedTx.currency}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6 text-xs font-mono">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-sans">Sender / Origin</span>
                <div className="text-cyan-300 font-bold">{selectedTx.from_account || 'N/A'}</div>
                <div className="text-slate-300">{selectedTx.sender_first_name ? `${selectedTx.sender_first_name} ${selectedTx.sender_last_name}` : 'Unassigned Customer'}</div>
                <div className="text-slate-500 text-[10px]">{selectedTx.sender_email || '—'}</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-sans">Recipient / Beneficiary</span>
                <div className="text-indigo-300 font-bold">{selectedTx.to_account || 'N/A'}</div>
                <div className="text-slate-300">{selectedTx.recipient_first_name ? `${selectedTx.recipient_first_name} ${selectedTx.recipient_last_name}` : 'Unassigned Customer'}</div>
                <div className="text-slate-500 text-[10px]">{selectedTx.recipient_email || '—'}</div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1 col-span-2 font-sans">
                <span className="text-[10px] text-slate-500 uppercase block font-mono">Transmission Metadata</span>
                <div className="text-slate-300">Channel: <span className="font-mono text-white capitalize">{selectedTx.channel}</span> | Type: <span className="font-mono text-white capitalize">{selectedTx.transaction_type}</span></div>
                <div className="text-slate-300">Timestamp: <span className="font-mono text-white">{new Date(selectedTx.transaction_date).toLocaleString()}</span></div>
                <div className="text-slate-300">Description: <span className="text-slate-200">{selectedTx.description || 'N/A'}</span></div>
              </div>
            </div>

            {/* Contributing Risk Factors */}
            <div className="mb-6">
              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                <span>Detection Factors & Risk Proof</span>
                <span className="text-slate-500">({selectedTx.factors?.length || 0} factors)</span>
              </h5>
              <div className="space-y-2">
                {selectedTx.factors && selectedTx.factors.length > 0 ? (
                  selectedTx.factors.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                      <div className="flex justify-between font-semibold text-white">
                        <span>{f.factor_name}</span>
                        <span className="text-red-400 font-mono">+{f.contribution} pts</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{f.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 py-3 text-center border border-slate-800/60 rounded-xl">
                    No risk factors identified. Transaction meets clean threshold profile.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-[10px] font-mono text-slate-500">FCIP Financial Ledger ID #{selectedTx.id}</span>
              <button
                onClick={() => handleEvaluateTx(selectedTx.id)}
                disabled={evaluating}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-navy-950" />
                {evaluating ? 'Evaluating...' : 'Re-Evaluate Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;
