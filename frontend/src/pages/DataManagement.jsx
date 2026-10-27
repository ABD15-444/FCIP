import React, { useState, useEffect } from 'react';
import { dataService } from '../services/api';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Filter, Search, ArrowUpDown, RefreshCw } from 'lucide-react';

const DataManagement = () => {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'transactions' | 'customers' | 'accounts'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');

  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Customers & Accounts
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'transactions') loadTransactions();
    if (activeTab === 'customers') loadCustomers();
    if (activeTab === 'accounts') loadAccounts();
  }, [activeTab]);

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const data = await dataService.getTransactions({
        search: search || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
      });
      if (data.success) setTransactions(data.transactions);
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
            Ingest financial feeds, inspect transaction ledgers, and manage customer accounts.
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
            Transactions
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
              Supports standard bank transaction exports (Customer Name, Email, Accounts, Amount, Timestamp).
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
                <AlertCircle className="w-4 h-4" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadResult && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{uploadResult.message}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-emerald-500/20 font-mono">
                  <div>Rows: {uploadResult.summary?.rowsParsed}</div>
                  <div>Customers: {uploadResult.summary?.customersCreated}</div>
                  <div>Transactions: {uploadResult.summary?.transactionsCreated}</div>
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

      {/* Tab 2: Transactions Table with Search & Filter */}
      {activeTab === 'transactions' && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by account number, description, or sender..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTransactions()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
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
                onClick={loadTransactions}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>
            </div>

            <button
              onClick={loadTransactions}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Refresh"
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
                  <th className="py-3 px-4">Risk Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      {txLoading ? 'Loading transaction records...' : 'No transactions found. Upload a CSV to get started.'}
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
                            {tx.risk_level} ({tx.risk_score})
                          </span>
                        ) : (
                          <span className="text-slate-500">Unevaluated</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Nationality</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Accounts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{c.id}</td>
                    <td className="py-3 px-4 font-semibold text-white">{c.first_name} {c.last_name}</td>
                    <td className="py-3 px-4 text-cyan-400 font-mono">{c.email}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{c.phone || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-300">{c.nationality || 'US'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-400">{c.account_count || 1} Linked</td>
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
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Open Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{acc.id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300">{acc.account_number}</td>
                    <td className="py-3 px-4 text-white">
                      {acc.first_name ? `${acc.first_name} ${acc.last_name}` : <span className="text-slate-500">Unassigned Holder</span>}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-300">{acc.account_type}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">{acc.currency}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">
                        {acc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{new Date(acc.open_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;
