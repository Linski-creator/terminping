import React, { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://tvxsarcqrqoqmsajnbtb.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eHNhcmNxcnFvcW1zYWpuYnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTA5MDcsImV4cCI6MjA5NTIyNjkwN30.nIQvUoIbN-a5xjIrSzBrmTAdkNBrg8KddVSqYqeUCaA';

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: 'return=representation',
};

const statusConfig = {
  ausstehend: {
    label: 'Ausstehend',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
  },
  abgesagt: { label: 'Abgesagt', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  abgeschlossen: {
    label: 'Abgeschlossen',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
  },
  nicht_erschienen: {
    label: 'Nicht erschienen',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
  },
};

export default function App() {
  const [termine, setTermine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('alle');
  const [form, setForm] = useState({
    name: '',
    telefon: '',
    datum: '',
    uhrzeit: '',
  });
  const [saving, setSaving] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch alle Termine
  const fetchTermine = async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/termine?select=*&order=datum.asc,uhrzeit.asc`,
        { headers }
      );
      const data = await res.json();
      setTermine(data);
    } catch (e) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto Status Update – wenn Termin vorbei ist → abgeschlossen
  const checkAutoStatus = async (alleTermine) => {
    const now = new Date();
    for (const t of alleTermine) {
      if (t.status === 'ausstehend') {
        const terminZeit = new Date(`${t.datum}T${t.uhrzeit}`);
        if (terminZeit < now) {
          await fetch(`${SUPABASE_URL}/rest/v1/termine?id=eq.${t.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'abgeschlossen' }),
          });
        }
      }
    }
  };

  useEffect(() => {
    fetchTermine();
    // Jede Minute checken ob SMS gesendet werden muss oder Status sich ändert
    const interval = setInterval(async () => {
      await fetchTermine();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (termine.length > 0) checkAutoStatus(termine);
  }, [termine]);

  // Neuen Termin hinzufügen
  const addTermin = async () => {
    if (!form.name || !form.telefon || !form.datum || !form.uhrzeit) {
      showToast('Bitte alle Felder ausfüllen', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/termine`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          status: 'ausstehend',
          sms_gesendet: false,
        }),
      });
      if (res.ok) {
        showToast(`Termin für ${form.name} gespeichert ✓`);
        setForm({ name: '', telefon: '', datum: '', uhrzeit: '' });
        setShowForm(false);
        fetchTermine();
      }
    } catch (e) {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Status manuell ändern
  const updateStatus = async (id, status) => {
    await fetch(`${SUPABASE_URL}/rest/v1/termine?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    fetchTermine();
    showToast('Status aktualisiert ✓');
  };

  // Termin löschen
  const deleteTermin = async (id, name) => {
    await fetch(`${SUPABASE_URL}/rest/v1/termine?id=eq.${id}`, {
      method: 'DELETE',
      headers,
    });
    fetchTermine();
    showToast(`${name} gelöscht`, 'error');
  };

  const filtered =
    activeTab === 'alle'
      ? termine
      : termine.filter((t) => t.status === activeTab);

  const stats = {
    gesamt: termine.length,
    ausstehend: termine.filter((t) => t.status === 'ausstehend').length,
    abgeschlossen: termine.filter((t) => t.status === 'abgeschlossen').length,
    abgesagt: termine.filter((t) => t.status === 'abgesagt').length,
  };

  // SMS Zeit berechnen
  const getSMSZeit = (datum, uhrzeit) => {
    const terminZeit = new Date(`${datum}T${uhrzeit}`);
    const smsZeit = new Date(terminZeit.getTime() - 24 * 60 * 60 * 1000);
    return smsZeit.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={s.root}>
      <div style={s.bg} />
      <div style={s.glow1} />
      <div style={s.glow2} />

      {toast && (
        <div
          style={{
            ...s.toast,
            background: toast.type === 'error' ? '#EF4444' : '#10B981',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>✂ TerminPing</div>
            <div style={s.sub}>
              Automatische SMS-Erinnerungen · 24h vor dem Termin
            </div>
          </div>
          <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Schließen' : '+ Termin'}
          </button>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          {[
            { label: 'Gesamt', value: stats.gesamt, color: '#94A3B8' },
            { label: 'Ausstehend', value: stats.ausstehend, color: '#F59E0B' },
            {
              label: 'Abgeschlossen',
              value: stats.abgeschlossen,
              color: '#10B981',
            },
            { label: 'Abgesagt', value: stats.abgesagt, color: '#EF4444' },
          ].map((s2) => (
            <div key={s2.label} style={s.statCard}>
              <div style={{ ...s.statVal, color: s2.color }}>{s2.value}</div>
              <div style={s.statLabel}>{s2.label}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div style={s.formCard}>
            <div style={s.formTitle}>Neuer Termin</div>
            <div style={s.formGrid}>
              {[
                { key: 'name', placeholder: 'Name des Kunden' },
                { key: 'telefon', placeholder: 'Telefon (+49...)' },
                { key: 'datum', placeholder: 'Datum', type: 'date' },
                { key: 'uhrzeit', placeholder: 'Uhrzeit', type: 'time' },
              ].map((f) => (
                <input
                  key={f.key}
                  style={s.input}
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: e.target.value })
                  }
                />
              ))}
            </div>
            <button style={s.saveBtn} onClick={addTermin} disabled={saving}>
              {saving ? 'Speichern...' : 'Termin speichern'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={s.tabs}>
          {[
            { key: 'alle', label: 'Alle' },
            { key: 'ausstehend', label: 'Ausstehend' },
            { key: 'abgeschlossen', label: 'Abgeschlossen' },
            { key: 'abgesagt', label: 'Abgesagt' },
            { key: 'nicht_erschienen', label: 'Nicht erschienen' },
          ].map((tab) => (
            <button
              key={tab.key}
              style={{
                ...s.tab,
                ...(activeTab === tab.key ? s.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={s.list}>
          {loading && <div style={s.empty}>Laden...</div>}
          {!loading && filtered.length === 0 && (
            <div style={s.empty}>Keine Termine gefunden</div>
          )}
          {filtered.map((t, i) => {
            const sc = statusConfig[t.status] || statusConfig.ausstehend;
            return (
              <div key={t.id} style={s.card}>
                <div style={s.cardLeft}>
                  <div style={s.avatar}>{t.name[0].toUpperCase()}</div>
                  <div>
                    <div style={s.name}>{t.name}</div>
                    <div style={s.meta}>📞 {t.telefon}</div>
                    <div style={s.meta}>
                      🗓 {t.datum} um {t.uhrzeit} Uhr
                    </div>
                    {t.sms_gesendet ? (
                      <div style={s.smsSent}>
                        📱 SMS gesendet am {getSMSZeit(t.datum, t.uhrzeit)}
                      </div>
                    ) : (
                      <div style={s.smsPending}>
                        ⏳ SMS wird gesendet am {getSMSZeit(t.datum, t.uhrzeit)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={s.cardRight}>
                  <div
                    style={{ ...s.badge, color: sc.color, background: sc.bg }}
                  >
                    {sc.label}
                  </div>
                  <select
                    style={s.select}
                    value={t.status}
                    onChange={(e) => updateStatus(t.id, e.target.value)}
                  >
                    <option value="ausstehend">Ausstehend</option>
                    <option value="abgeschlossen">Abgeschlossen</option>
                    <option value="abgesagt">Abgesagt</option>
                    <option value="nicht_erschienen">Nicht erschienen</option>
                  </select>
                  <button
                    style={s.deleteBtn}
                    onClick={() => deleteTermin(t.id, t.name)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={s.footer}>
          TerminPing · Alle Termine werden sicher in der Datenbank gespeichert
        </div>
      </div>
    </div>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    background: '#0A0F1E',
    fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 60,
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background:
      'radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.06) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  glow1: {
    position: 'fixed',
    top: -200,
    left: -200,
    width: 600,
    height: 600,
    background:
      'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  glow2: {
    position: 'fixed',
    bottom: -200,
    right: -200,
    width: 500,
    height: 500,
    background:
      'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  toast: {
    position: 'fixed',
    top: 24,
    right: 24,
    zIndex: 1000,
    padding: '12px 20px',
    borderRadius: 10,
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 20px',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    color: '#F8FAFC',
    letterSpacing: '-0.5px',
    marginBottom: 4,
  },
  sub: { fontSize: 13, color: '#64748B' },
  addBtn: {
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '20px 16px',
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
  },
  statVal: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: 500 },
  formCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    backdropFilter: 'blur(10px)',
  },
  formTitle: {
    color: '#F8FAFC',
    fontWeight: 700,
    fontSize: 16,
    marginBottom: 16,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#F8FAFC',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#64748B',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.4)',
    color: '#A5B4FC',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { textAlign: 'center', color: '#475569', padding: 40, fontSize: 14 },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    flexShrink: 0,
  },
  name: { color: '#F8FAFC', fontWeight: 600, fontSize: 15, marginBottom: 4 },
  meta: { color: '#64748B', fontSize: 12, marginBottom: 2 },
  smsSent: { color: '#10B981', fontSize: 11, marginTop: 4, fontWeight: 500 },
  smsPending: { color: '#F59E0B', fontSize: 11, marginTop: 4, fontWeight: 500 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  badge: {
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  select: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '7px 10px',
    color: '#F8FAFC',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
  },
  deleteBtn: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    color: '#EF4444',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  footer: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 12,
    marginTop: 40,
  },
};
