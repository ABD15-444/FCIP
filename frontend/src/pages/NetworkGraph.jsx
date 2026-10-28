import React, { useState, useEffect, useRef } from 'react';
import { networkService, dataService } from '../services/api';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  ArrowRight,
  ShieldAlert,
  Info,
  Layers,
  Repeat,
  Database,
  Table,
  Key,
  RefreshCw,
  Search,
  Share2,
  FileText,
  Sliders,
  CheckCircle2,
  Activity
} from 'lucide-react';

const NetworkGraph = () => {
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'erd'

  // Network Graph State
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(1);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [moneyFlows, setMoneyFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [highlightCycles, setHighlightCycles] = useState(true);

  // Zoom and Pan Transform State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const nodePositionsRef = useRef(new Map());

  // ERD State
  const [erdData, setErdData] = useState(null);
  const [erdLoading, setErdLoading] = useState(false);
  const [erdSearch, setErdSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [erdDomain, setErdDomain] = useState('all');

  useEffect(() => {
    dataService.getAccounts().then((res) => {
      if (res.success && res.accounts.length > 0) {
        setAccounts(res.accounts);
        setSelectedAccountId(res.accounts[0].id);
        fetchGraph(res.accounts[0].id);
      }
    });
  }, []);

  const fetchGraph = async (accId) => {
    setLoading(true);
    setSelectedNode(null);
    setSelectedEdge(null);
    try {
      const gRes = await networkService.getGraph(accId);
      const fRes = await networkService.getMoneyFlow(accId);
      if (gRes.success) {
        setGraphData({ nodes: gRes.nodes, links: gRes.links });
        const center = gRes.nodes.find((n) => n.isCenter);
        if (center) setSelectedNode(center);
      }
      if (fRes.success) setMoneyFlows(fRes.flows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchERD = async () => {
    try {
      setErdLoading(true);
      const res = await networkService.getERD();
      if (res.success) {
        setErdData(res);
        if (!selectedTable && res.tables.length > 0) {
          setSelectedTable(res.tables[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching ERD:', err);
    } finally {
      setErdLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'erd' && !erdData) {
      fetchERD();
    }
  }, [activeTab]);

  const handleSelectAccount = (e) => {
    const accId = parseInt(e.target.value, 10);
    setSelectedAccountId(accId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    fetchGraph(accId);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Identify circular edge sequences in current graph
  const isCircularEdge = (link) => {
    return moneyFlows.some(
      (f) =>
        f.from_account_id === parseInt(link.source.replace('acc_', ''), 10) &&
        f.to_account_id === parseInt(link.target.replace('acc_', ''), 10) &&
        f.visited_accounts?.includes(f.to_account_id)
    );
  };

  // Interactive Canvas Render for Network Graph
  useEffect(() => {
    if (activeTab !== 'graph') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = 480);

    ctx.clearRect(0, 0, width, height);
    if (graphData.nodes.length === 0) return;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const nodeCoords = new Map();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const otherNodes = graphData.nodes.filter((n) => !n.isCenter);
    const angleStep = otherNodes.length > 0 ? (2 * Math.PI) / otherNodes.length : 0;

    const centerNode = graphData.nodes.find((n) => n.isCenter) || graphData.nodes[0];
    nodeCoords.set(centerNode.id, { x: centerX, y: centerY, node: centerNode });

    otherNodes.forEach((node, idx) => {
      const angle = idx * angleStep;
      nodeCoords.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });

    nodePositionsRef.current = nodeCoords;

    // Draw Directed Links
    graphData.links.forEach((link) => {
      const s = nodeCoords.get(link.source);
      const t = nodeCoords.get(link.target);
      if (s && t) {
        const isCycle = highlightCycles && isCircularEdge(link);
        const isSelected = selectedEdge && selectedEdge.id === link.id;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 4;
        } else if (isCycle) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.lineWidth = 3.5;
        } else {
          ctx.strokeStyle = link.amount > 50000 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(6, 182, 212, 0.4)';
          ctx.lineWidth = Math.min(5, Math.max(1.5, link.amount / 30000));
        }
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(t.y - s.y, t.x - s.x);
        const arrowDist = 20;
        const arrowX = t.x - arrowDist * Math.cos(angle);
        const arrowY = t.y - arrowDist * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        // Edge label
        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        ctx.fillStyle = isSelected ? '#38bdf8' : isCycle ? '#f87171' : '#94a3b8';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.fillText(`$${(link.amount / 1000).toFixed(0)}k`, midX, midY - 6);
      }
    });

    // Draw Nodes
    nodeCoords.forEach(({ x, y, node }) => {
      const isSelected = selectedNode && selectedNode.id === node.id;
      const isHigh = node.riskLevel === 'High' || node.riskScore >= 70;
      const isMed = node.riskLevel === 'Medium';
      const nodeColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#10b981';

      ctx.beginPath();
      ctx.arc(x, y, node.isCenter ? 26 : 20, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.35)' : nodeColor + '33';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, node.isCenter ? 14 : 11, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.lineWidth = isSelected ? 3 : node.isCenter ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#38bdf8' : '#f8fafc';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, x, y + (node.isCenter ? 36 : 28));

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`Score: ${node.riskScore}`, x, y + (node.isCenter ? 48 : 40));
    });

    ctx.restore();
  }, [graphData, zoom, pan, selectedNode, selectedEdge, highlightCycles, activeTab]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    for (const [, { x, y, node }] of nodePositionsRef.current.entries()) {
      const dist = Math.hypot(mouseX - x, mouseY - y);
      if (dist <= 24) {
        setSelectedNode(node);
        setSelectedEdge(null);
        return;
      }
    }

    for (const link of graphData.links) {
      const s = nodePositionsRef.current.get(link.source);
      const t = nodePositionsRef.current.get(link.target);
      if (s && t) {
        const dist = distToSegment({ x: mouseX, y: mouseY }, s, t);
        if (dist <= 8) {
          setSelectedEdge(link);
          setSelectedNode(null);
          return;
        }
      }
    }

    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const distToSegment = (p, v, w) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // ERD helper classifications
  const tableDomains = {
    customers: 'core',
    accounts: 'core',
    transactions: 'core',
    detection_rules: 'detection',
    alerts: 'detection',
    risk_scores: 'detection',
    cases: 'governance',
    case_notes: 'governance',
    case_history: 'governance',
    reports: 'governance',
    compliance_reviews: 'governance',
    audit_logs: 'governance',
    users: 'governance',
  };

  const filteredTables = (erdData?.tables || []).filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(erdSearch.toLowerCase());
    const matchesDomain = erdDomain === 'all' || tableDomains[t.name] === erdDomain;
    return matchesSearch && matchesDomain;
  });

  return (
    <div className="space-y-6">
      {/* Header and Mode Selector */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Entity Relationship & Network Graph Flow</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Live Architecture
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visual intelligence hub for transactional money flow topologies and live PostgreSQL relational schemas.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
              activeTab === 'graph'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Transaction Graph
          </button>
          <button
            onClick={() => setActiveTab('erd')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
              activeTab === 'erd'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Database Schema (ERD)
          </button>
        </div>
      </div>

      {/* VIEW 1: TRANSACTION NETWORK GRAPH */}
      {activeTab === 'graph' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-mono text-slate-400">Target Pivot Account:</label>
              <select
                value={selectedAccountId}
                onChange={handleSelectAccount}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-mono text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500/50"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_number} ({acc.first_name || 'Holder'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setHighlightCycles(!highlightCycles)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
                  highlightCycles
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                Highlight Circular Loops
              </button>
              <button
                onClick={() => fetchGraph(selectedAccountId)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
                title="Refresh Graph"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 glass-card rounded-2xl border border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between">
              {/* Toolbar & Legend */}
              <div className="flex flex-wrap items-center justify-between mb-2 px-2 text-xs font-mono text-slate-400 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> High Risk</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 bg-red-500" /> Circular Loop</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))} className="p-1 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))} className="p-1 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
                  <button onClick={resetView} className="p-1 hover:text-white"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Canvas Viewport */}
              <div className="relative border border-slate-800/80 rounded-xl bg-slate-950/70 overflow-hidden cursor-crosshair h-[480px]">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="w-full h-full block"
                />
              </div>

              {/* Bottom Inspection Card */}
              <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono min-h-[46px] flex items-center">
                {selectedNode ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                    <span className="text-slate-300">
                      Entity: <strong className="text-white">{selectedNode.label}</strong>
                    </span>
                    <span className="text-slate-400">
                      Composite Risk: <strong className={selectedNode.riskScore >= 70 ? 'text-red-400' : 'text-amber-400'}>{selectedNode.riskScore}/100</strong>
                    </span>
                    <span className="text-cyan-400">Status: Active</span>
                  </div>
                ) : selectedEdge ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-slate-300">
                      Transfer: <strong className="text-white">${selectedEdge.amount.toLocaleString()} {selectedEdge.currency}</strong> from {selectedEdge.source.replace('acc_', 'Acc #')} &rarr; {selectedEdge.target.replace('acc_', 'Acc #')}
                    </span>
                    <span className="text-slate-500">{new Date(selectedEdge.date).toLocaleString()}</span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Click any node or transaction edge to inspect its entity details. Drag to pan.</span>
                )}
              </div>
            </div>

            {/* Hop Sequence Trace */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  Hop Sequence Trace
                </span>
                <span className="text-[11px] text-slate-500">{moneyFlows.length} Hops</span>
              </h3>

              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {moneyFlows.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No secondary hops recorded from this node.</p>
                ) : (
                  moneyFlows.map((flow, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          HOP {flow.hop_level}
                        </span>
                        <span>{new Date(flow.transaction_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center justify-between font-bold text-white pt-1">
                        <span className="text-cyan-300">{flow.from_account}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-indigo-300">{flow.to_account}</span>
                      </div>
                      <div className="text-right text-emerald-400 font-bold">
                        ${parseFloat(flow.amount).toLocaleString()} {flow.currency}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: POSTGRESQL ENTITY RELATIONSHIP DIAGRAM (ERD) */}
      {activeTab === 'erd' && (
        <div className="space-y-6">
          {/* ERD Toolbar */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-400 mr-1">Domain Scope:</span>
              <button
                onClick={() => setErdDomain('all')}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  erdDomain === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                All (13 Tables)
              </button>
              <button
                onClick={() => setErdDomain('core')}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  erdDomain === 'core'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                Banking & Ingestion
              </button>
              <button
                onClick={() => setErdDomain('detection')}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  erdDomain === 'detection'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                Detection & Risk
              </button>
              <button
                onClick={() => setErdDomain('governance')}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  erdDomain === 'governance'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                Cases & Compliance
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter table name..."
                  value={erdSearch}
                  onChange={(e) => setErdSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <button
                onClick={fetchERD}
                disabled={erdLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-mono"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${erdLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Counts</span>
              </button>
            </div>
          </div>

          {/* Canonical Relationships Visualizer Bar */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs font-mono space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              Canonical Foreign Key Graph Topology
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {(erdData?.relationships || []).map((rel, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5"
                >
                  <strong className="text-cyan-400">{rel.from}</strong>
                  <span className="text-slate-500">──({rel.type})──&gt;</span>
                  <strong className="text-indigo-400">{rel.to}</strong>
                  <span className="text-[9px] text-slate-500 font-normal">[{rel.label}]</span>
                </span>
              ))}
            </div>
          </div>

          {/* Live Schema Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTables.map((table) => {
              const isSelected = selectedTable === table.name;
              return (
                <div
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className={`rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900/90 border-cyan-500/50 ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Table Card Header */}
                  <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-mono text-xs font-bold text-white uppercase">{table.name}</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {table.rowCount} rows
                    </span>
                  </div>

                  {/* Columns List */}
                  <div className="p-3 text-[11px] font-mono max-h-56 overflow-y-auto space-y-1">
                    {table.columns.map((col) => {
                      const isPk = table.keys.some((k) => k.column_name === col.column_name && k.constraint_type === 'PRIMARY KEY');
                      const isFk = table.keys.some((k) => k.column_name === col.column_name && k.constraint_type === 'FOREIGN KEY');
                      const fkInfo = table.keys.find((k) => k.column_name === col.column_name && k.constraint_type === 'FOREIGN KEY');

                      return (
                        <div
                          key={col.column_name}
                          className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-800/40"
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                            {isPk && (
                              <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                                PK
                              </span>
                            )}
                            {isFk && (
                              <span
                                className="px-1 py-0.2 rounded text-[9px] bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30"
                                title={`References ${fkInfo?.foreign_table_name}.${fkInfo?.foreign_column_name}`}
                              >
                                FK
                              </span>
                            )}
                            <span className={isPk ? 'text-white font-bold' : isFk ? 'text-indigo-300' : 'text-slate-300'}>
                              {col.column_name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 lowercase">{col.data_type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;
