import { useState, useEffect, useCallback } from 'react';

// ─── Pose definitions for the panel ────────────────────────────────────────
const POSES = [
  { key: 'LEAN_IN',    label: ' Lean In',     color: '#e879f9' },
  { key: 'HEAD_TILT',  label: ' Head Tilt',   color: '#818cf8' },
  { key: 'LOOK_AWAY',  label: ' Look Away',   color: '#60a5fa' },
  { key: 'LOOK_DOWN',  label: ' Look Down',   color: '#34d399' },
  { key: 'CHEST_OUT',  label: ' Chest Out',   color: '#f59e0b' },
  { key: 'HUNCH',      label: ' Hunch',       color: '#94a3b8' },
  { key: 'SHAKE_NO',   label: ' Shake No',   color: '#f87171' },
  { key: 'NOD_YES',    label: ' Nod Yes',     color: '#4ade80' },
  { key: 'STEP_BACK',  label: ' Step Back',   color: '#fb923c' },
  { key: 'BITE_LIP',   label: ' Bite Lip',   color: '#f472b6' },
  { key: 'SMIRK',      label: ' Smirk',       color: '#a78bfa' },
] as const;

type PoseKey = typeof POSES[number]['key'];

// ─── Asterisk phrases to test full pipeline ─────────────────────────────────
const ASTERISK_TESTS = [
  { label: '*leans in*',        text: '*leans in*' },
  { label: '*tilts head*',      text: '*tilts her head curiously*' },
  { label: '*looks away*',      text: '*looks away shyly*' },
  { label: '*steps back*',      text: '*steps back startled*' },
  { label: '*shakes head*',     text: '*shakes her head no*' },
  { label: '*nods*',            text: '*nods her head yes*' },
];

// ─── Local asterisk→pose map for the panel ─────────────────────────────────
const LOCAL_ASTERISK_MAP: Array<{ keys: string[]; pose: PoseKey }> = [
  { keys: ['lean in', 'leans in', 'leans forward', 'moves closer'], pose: 'LEAN_IN' },
  { keys: ['tilt', 'tilts head', 'curious', 'head tilt'],           pose: 'HEAD_TILT' },
  { keys: ['look away', 'looks away', 'glances away', 'averts'],    pose: 'LOOK_AWAY' },
  { keys: ['look down', 'looks down', 'shy', 'bashful', 'fidget'],  pose: 'LOOK_DOWN' },
  { keys: ['step back', 'steps back', 'flinch', 'startled'],        pose: 'STEP_BACK' },
  { keys: ['shake', 'shakes head', 'no no'],                        pose: 'SHAKE_NO' },
  { keys: ['nod', 'nods', 'agrees'],                                pose: 'NOD_YES' },
  { keys: ['bite lip', 'bites lip', 'seductive', 'wink'],           pose: 'BITE_LIP' },
  { keys: ['smirk', 'cocky', 'smug'],                               pose: 'SMIRK' },
  { keys: ['hunch', 'slumps', 'defeated'],                          pose: 'HUNCH' },
  { keys: ['chest out', 'stands tall', 'proud'],                    pose: 'CHEST_OUT' },
];

// ─── Component ─────────────────────────────────────────────────────────────
export function PoseDebugPanel() {
  const [visible, setVisible]     = useState(false);
  const [activeKey, setActiveKey] = useState<PoseKey | null>(null);
  const [weight, setWeight]       = useState(0);
  const [idleScale, setIdleScale] = useState(1);
  const [log, setLog]             = useState<string[]>([]);
  const [tab, setTab]             = useState<'poses' | 'asterisk'>('poses');

  // Poll poseSystem state every 100ms for the live readout
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const ps = (window as any).poseSystem;
      if (!ps) return;
      setWeight(+(ps.poseWeight ?? 0).toFixed(3));
      setIdleScale(+(ps.idleScale ?? 1).toFixed(3));
    }, 100);
    return () => clearInterval(id);
  }, [visible]);

  const addLog = useCallback((msg: string) => {
    setLog(l => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 12));
  }, []);

  const activate = useCallback((key: PoseKey) => {
    const ps = (window as any).poseSystem;
    if (!ps) { addLog(' poseSystem not found — reload page'); return; }
    ps.activatePose(key);
    setActiveKey(key);
    addLog(` activatePose('${key}')`);
  }, [addLog]);

  const release = useCallback(() => {
    const ps = (window as any).poseSystem;
    if (!ps) return;
    ps.releasePose();
    setActiveKey(null);
    addLog(' releasePose()');
  }, [addLog]);

  const testAsterisk = useCallback((text: string) => {
    const lower = text.toLowerCase();

    // 1. Find pose from text
    let foundPose: PoseKey | null = null;
    for (const entry of LOCAL_ASTERISK_MAP) {
      if (entry.keys.some(k => lower.includes(k))) {
        foundPose = entry.pose;
        break;
      }
    }

    // 2. Activate pose directly (guaranteed to work since poseSystem works)
    const ps = (window as any).poseSystem;
    if (foundPose && ps) {
      ps.activatePose(foundPose);
      setActiveKey(foundPose);
      addLog(` "${text}" → pose: ${foundPose}`);
    } else if (!foundPose) {
      addLog(` No pose matched for: "${text}"`);
    }

    // 3. Also try controller for animation + emotion side-effect (best-effort)
    try {
      const ctrl = (window as any).currentController;
      if (ctrl && typeof ctrl.extractAndMapAsteriskAction === 'function') {
        ctrl.extractAndMapAsteriskAction(text);
      }
    } catch { /* controller not ready yet, pose still fired */ }
  }, [addLog]);

  return (
    <>
      {/* ── Toggle Button ──────────────────────────────────────────── */}
      <button
        id="pose-debug-toggle"
        onClick={() => setVisible(v => !v)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #7c3aed, #db2777)',
          border: 'none',
          borderRadius: '50px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 700,
          padding: '10px 18px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
          letterSpacing: '0.5px',
          fontFamily: 'monospace',
        }}
      >
         {visible ? 'Close' : 'Pose Debug'}
      </button>

      {/* ── Panel ──────────────────────────────────────────────────── */}
      {visible && (
        <div
          id="pose-debug-panel"
          style={{
            position: 'fixed',
            bottom: '70px',
            right: '20px',
            zIndex: 9998,
            width: '300px',
            background: 'rgba(10,10,20,0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(219,39,119,0.15)',
            fontFamily: 'monospace',
            color: '#e2e8f0',
            fontSize: '12px',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', marginBottom: '6px' }}>
               Pose Override Tester
            </div>

            {/* Live readout */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              gap: '16px',
              fontSize: '11px',
            }}>
              <div>
                <div style={{ color: '#94a3b8' }}>weight</div>
                <div style={{
                  color: weight > 0.5 ? '#4ade80' : weight > 0.01 ? '#fbbf24' : '#64748b',
                  fontWeight: 700,
                }}>
                  {weight.toFixed(3)}
                  <span style={{ marginLeft: 4, fontSize: 9 }}>
                    {'█'.repeat(Math.round(weight * 10))}{'░'.repeat(10 - Math.round(weight * 10))}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ color: '#94a3b8' }}>idleScale</div>
                <div style={{ color: '#60a5fa', fontWeight: 700 }}>{idleScale.toFixed(3)}</div>
              </div>
              <div>
                <div style={{ color: '#94a3b8' }}>active</div>
                <div style={{ color: '#e879f9', fontWeight: 700 }}>{activeKey ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {(['poses', 'asterisk'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  background: tab === t ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.05)',
                  color: tab === t ? '#e879f9' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'poses' ? ' Direct' : ' Asterisk'}
              </button>
            ))}
          </div>

          {/* ── Tab: Direct Poses ─────────────────────────────── */}
          {tab === 'poses' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                marginBottom: '8px',
              }}>
                {POSES.map(p => (
                  <button
                    key={p.key}
                    id={`pose-btn-${p.key.toLowerCase()}`}
                    onClick={() => activate(p.key)}
                    style={{
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: `1px solid ${activeKey === p.key ? p.color : 'transparent'}`,
                      background: activeKey === p.key
                        ? `${p.color}22`
                        : 'rgba(255,255,255,0.05)',
                      color: activeKey === p.key ? p.color : '#cbd5e1',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: activeKey === p.key ? 700 : 400,
                      fontFamily: 'monospace',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Release button */}
              <button
                id="pose-btn-release"
                onClick={release}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(248,113,113,0.4)',
                  background: 'rgba(248,113,113,0.1)',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  marginBottom: '8px',
                }}
              >
                 releasePose()
              </button>
            </>
          )}

          {/* ── Tab: Asterisk pipeline ────────────────────────── */}
          {tab === 'asterisk' && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '8px' }}>
                Tests the full pipeline: asterisk → pose + animation + emotion
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {ASTERISK_TESTS.map(t => (
                  <button
                    key={t.label}
                    onClick={() => testAsterisk(t.text)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(129,140,248,0.25)',
                      background: 'rgba(129,140,248,0.07)',
                      color: '#a5b4fc',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Log ──────────────────────────────────────────── */}
          {log.length > 0 && (
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '8px',
              padding: '8px',
              maxHeight: '90px',
              overflowY: 'auto',
              fontSize: '10px',
              color: '#64748b',
              lineHeight: '1.6',
            }}>
              {log.map((l, i) => (
                <div key={i} style={{ color: i === 0 ? '#94a3b8' : '#475569' }}>{l}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
