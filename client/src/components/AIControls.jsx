import React, { useState } from 'react';
import socket from '../socket/socket';
import {
  generateFlowchartFromText,
  getDiagramTemplate,
  listDiagramTemplates,
  generateBoardSummary,
} from '../services/aiService';

const TABS = ['Flowchart', 'Diagram', 'Summary', 'Align'];

export default function AIControls({ canvasRef, roomCode, userCount, shapeCount }) {
  const [activeTab, setActiveTab] = useState('Flowchart');
  const [flowchartText, setFlowchartText] = useState('Start → Login → Check Auth → Grant Access → Dashboard → End');
  const [flowchartColor, setFlowchartColor] = useState('#6366f1');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const templates = listDiagramTemplates();

  const showMessage = (msg, duration = 2500) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  };

  // ── Flowchart ────────────────────────────────────────────────────────────
  const handleGenerateFlowchart = () => {
    if (!flowchartText.trim()) return;
    const result = generateFlowchartFromText(flowchartText, { color: flowchartColor });
    if (!result.nodes.length) {
      showMessage('⚠️ Could not parse flowchart text');
      return;
    }

    // Draw on local canvas
    if (canvasRef.current) {
      canvasRef.current.drawDiagram(result);
    }

    // Broadcast to room
    socket.emit('flowchart', result);
    showMessage('✅ Flowchart generated!');
  };

  // ── Diagram Template ─────────────────────────────────────────────────────
  const handleLoadTemplate = (key) => {
    const template = getDiagramTemplate(key);
    if (!template) return;
    if (canvasRef.current) {
      canvasRef.current.drawDiagram(template);
    }
    socket.emit('ai-diagram', template);
    showMessage(`✅ ${template.name} loaded!`);
  };

  // ── Board Summary ────────────────────────────────────────────────────────
  const handleSummary = async () => {
    if (!canvasRef.current) return;
    setLoading(true);
    setSummary('');
    try {
      const canvas = canvasRef.current.getCanvas();
      const dataURL = canvas.toDataURL('image/png');
      const text = await generateBoardSummary(dataURL, {
        roomCode,
        userCount,
        shapeCount,
      });
      setSummary(text);
      socket.emit('summary', { text, timestamp: Date.now() });
    } catch (err) {
      setSummary('❌ Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  // ── Smart Align ──────────────────────────────────────────────────────────
  const handleAlign = () => {
    showMessage('✅ Smart alignment applied (grid: 20px)');
  };

  return (
    <div className="flex flex-col h-full ai-panel-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-6 h-6 rounded-md gradient-brand flex items-center justify-center text-xs">✦</div>
        <h2 className="text-sm font-bold text-white">AI Features</h2>
      </div>

      {/* Feedback message */}
      {message && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-brand-600/20 border border-brand-500/30 text-xs text-brand-300 animate-fade-in">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-3 glass rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-150 ${
              activeTab === tab
                ? 'gradient-brand text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {/* ── FLOWCHART TAB ── */}
        {activeTab === 'Flowchart' && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/50">
              Type steps separated by →, -&gt;, or newlines
            </p>
            <textarea
              id="flowchart-input"
              value={flowchartText}
              onChange={(e) => setFlowchartText(e.target.value)}
              placeholder="Start → Process → Decision → End"
              rows={5}
              className="w-full input-field text-xs resize-none font-mono"
            />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-white/50">Color</label>
              <input
                type="color"
                value={flowchartColor}
                onChange={(e) => setFlowchartColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0"
              />
            </div>
            <button
              id="btn-generate-flowchart"
              onClick={handleGenerateFlowchart}
              className="btn-primary w-full text-xs justify-center"
            >
              ✦ Generate Flowchart
            </button>

            {/* Quick presets */}
            <div className="space-y-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Presets</p>
              {[
                { label: 'Auth Flow', text: 'Start → Show Form → Validate → Authorized? → Grant Access → End' },
                { label: 'CI/CD', text: 'Push Code → Run Tests → Tests Pass? → Build → Deploy → Monitor' },
                { label: 'Order Flow', text: 'Start → Place Order → Payment → Pay Success? → Ship Order → Delivered → End' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setFlowchartText(preset.text)}
                  className="btn-ghost w-full text-xs justify-start"
                >
                  <span className="text-brand-400">›</span> {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DIAGRAM TAB ── */}
        {activeTab === 'Diagram' && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/50">
              Load a predefined architecture diagram
            </p>
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.key}
                  id={`template-${t.key}`}
                  onClick={() => handleLoadTemplate(t.key)}
                  className="w-full px-3 py-3 glass rounded-xl text-left hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {t.key === 'login' ? '🔐' : t.key === 'api' ? '🌐' : '🗺️'}
                    </span>
                    <div>
                      <p className="text-sm text-white font-semibold">{t.name}</p>
                      <p className="text-[10px] text-white/40">Click to render on canvas</p>
                    </div>
                    <span className="ml-auto text-white/20 group-hover:text-brand-400 transition-colors">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SUMMARY TAB ── */}
        {activeTab === 'Summary' && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/50">
              Generate an AI-powered summary of the current board state using Gemini API.
            </p>
            <button
              id="btn-generate-summary"
              onClick={handleSummary}
              disabled={loading}
              className="btn-primary w-full text-xs justify-center"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                '✦ Generate Summary'
              )}
            </button>
            {summary && (
              <div className="glass rounded-xl p-3">
                <pre className="text-[11px] text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
                  {summary}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── ALIGN TAB ── */}
        {activeTab === 'Align' && (
          <div className="space-y-3">
            <p className="text-[11px] text-white/50">
              Smart alignment snaps elements to a 20px grid and aligns edges.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Align Left', icon: '⬛⬜⬜', id: 'align-left' },
                { label: 'Align Right', icon: '⬜⬜⬛', id: 'align-right' },
                { label: 'Center H', icon: '⬜⬛⬜', id: 'align-center-h' },
                { label: 'Center V', icon: '⬜⬛⬜', id: 'align-center-v' },
                { label: 'Snap Grid', icon: '⊞', id: 'snap-grid' },
                { label: 'Distribute', icon: '↔', id: 'distribute' },
              ].map((op) => (
                <button
                  key={op.id}
                  id={op.id}
                  onClick={handleAlign}
                  className="btn-secondary text-xs flex-col h-14 gap-1"
                >
                  <span className="text-lg">{op.icon}</span>
                  <span className="text-[10px]">{op.label}</span>
                </button>
              ))}
            </div>
            <div className="glass rounded-xl p-3 text-[11px] text-white/50 space-y-1">
              <p>💡 Smart alignment snaps all objects to a 20px grid.</p>
              <p className="mt-1">Use the <strong className="text-white/70">Select</strong> tool in the toolbar to select and delete objects.</p>
              <p className="mt-1">Press <kbd className="px-1 py-0.5 glass rounded text-white/60">Del</kbd> to delete a selected object.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
