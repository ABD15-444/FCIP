import React, { useState, useEffect, useRef } from 'react';
import { networkService, dataService } from '../services/api';
import { Network, Search, ZoomIn, ZoomOut, Compass, ArrowRight, ShieldAlert, DollarSign } from 'lucide-react';

const NetworkGraph = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(1);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [moneyFlows, setMoneyFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const canvasRef = useRef(null);

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
    try {
      const gRes = await networkService.getGraph(accId);
      const fRes = await networkService.getMoneyFlow(accId);
      if (gRes.success) setGraphData({ nodes: gRes.nodes, links: gRes.links });
      if (fRes.success) setMoneyFlows(fRes.flows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (e) => {
    const accId = parseInt(e.target.value, 10);
    setSelectedAccountId(accId);
    fetchGraph(accId);
  };

  // Render high-performance custom canvas for network nodes and directed money flow edges
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = 480);

    ctx.clearRect(0, 0, width, height);

    if (graphData.nodes.length === 0) return;

    // Distribute nodes in a polar arrangement around center node
    const nodeCoords = new Map();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const otherNodes = graphData.nodes.filter((n) => !n.isCenter);
    const angleStep = otherNodes.length > 0 ? (2 * Math.PI) / otherNodes.length : 0;

    // Position Center
    const centerNode = graphData.nodes.find((n) => n.isCenter) || graphData.nodes[0];
    nodeCoords.set(centerNode.id, { x: centerX, y: centerY, node: centerNode });

    // Position Perimeter
    otherNodes.forEach((node, idx) => {
      const angle = idx * angleStep;
      nodeCoords.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });

    // Draw Links
    graphData.links.forEach((link) => {
      const s = nodeCoords.get(link.source);
      const t = nodeCoords.get(link.target);
      if (s && t) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = link.amount > 50000 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(6, 182, 212, 0.4)';
        ctx.lineWidth = Math.min(6, Math.max(1.5, link.amount / 25000));
        ctx.stroke();

        // Edge label
        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`$${(link.amount / 1000).toFixed(0)}k`, midX, midY - 4);
      }
    });

    // Draw Nodes
    nodeCoords.forEach(({ x, y, node }) => {
      const isHigh = node.riskLevel === 'High' || node.riskScore >= 70;
      const isMed = node.riskLevel === 'Medium';
      const nodeColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#10b981';

      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, node.isCenter ? 24 : 18, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor + '33';
      ctx.fill();

      // Node core
      ctx.beginPath();
      ctx.arc(x, y, node.isCenter ? 14 : 10, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = node.isCenter ? 2.5 : 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, x, y + (node.isCenter ? 36 : 28));

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`Risk: ${node.riskScore}`, x, y + (node.isCenter ? 48 : 40));
    });
  }, [graphData]);

  return (
    <div className="space-y-6">
      {/* Header and Account Centering Bar */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Entity Relationship & Network Graph</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 5
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Interactive topology showing money flows and multi-hop transactional paths between target accounts.
          </p>
        </div>

        {/* Center Account Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-slate-400">Pivot Account:</label>
          <select
            value={selectedAccountId}
            onChange={handleSelectAccount}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-300 font-semibold"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_number} ({acc.first_name || 'Holder'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Graph Workspace & Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-card rounded-2xl border border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2 px-2 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> High Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low Risk</span>
            </div>
            <span>{graphData.nodes.length} Connected Nodes • {graphData.links.length} Fund Flows</span>
          </div>

          <canvas ref={canvasRef} className="w-full h-[480px] bg-navy-950/60 rounded-xl border border-slate-850 cursor-crosshair" />
        </div>

        {/* Multi-Hop Money Flow Trace */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            Money Flow Hops
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
  );
};

export default NetworkGraph;
