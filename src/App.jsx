import React, { useState, useEffect, useRef } from 'react';

const SUPABASE_URL = 'https://tvxsarcqrqoqmsajnbtb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eHNhcmNxcnFvcW1zYWpuYnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTA5MDcsImV4cCI6MjA5NTIyNjkwN30.nIQvUoIbN-a5xjIrSzBrmTAdkNBrg8KddVSqYqeUCaA';

const h = (token) => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
  Prefer: 'return=representation',
});

const statusConfig = {
  ausstehend: { label: 'Ausstehend', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  abgesagt: { label: 'Abgesagt', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  abgeschlossen: { label: 'Abgeschlossen', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  nicht_erschienen: { label: 'Nicht erschienen', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
};

const DEFAULT_SMS = 'Hallo {name}, wir erinnern dich an deinen Termin morgen um {uhrzeit} Uhr. Bis dann! ✂️';
const DEFAULT_BEWERTUNG = 'Hey {name}, schön dass du heute da warst! Falls du kurz Zeit hast: {link} 😊';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [termine, setTermine] = useState([]);
  const [kunden, setKunden] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('alle');
  const [saving, setSaving] = useState(false);
  const [kundenSearch, setKundenSearch] = useState('');
  const [showKundenList, setShowKundenList] = useState(false);
  const [selectedKunde, setSelectedKunde] = useState(null);
  const [settings, setSettings] = useState({
    smsTemplate: DEFAULT_SMS,
    bewertungAktiv: false,
    bewertungTemplate: DEFAULT_BEWERTUNG,
    googleLink: '',
  });
  const [form, setForm] = useState({ name: '', telefon: '', datum: '', uhrzeit: '' });
  const searchRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // AUTH
  const handleAuth = async () => {
    setAuthLoading(true);
    const endpoint = authMode === 'login' ? 'token?grant_type=password' : 'signup';
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.access_token) {
        setUser({ token: data.access_token, email: data.user.email, id: data.user.id });
        showToast('Willkommen! ✓');
      } else {
        showToast(data.error_description || data.msg || 'Fehler', 'error');
      }
    } catch (e) {
      showToast('Fehler beim Login', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => { setUser(null); setTermine([]); setKunden([]); };

  // FETCH
  const fetchTermine = async () => {
    if (!user) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/termine?select=*&order=datum.asc,uhrzeit.asc`, { headers: h(user.token) });
    const data = await res.json();
    setTermine(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchKunden = async () => {
    if (!user) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kunden?select=*&order=name.asc`, { headers: h(user.token) });
    const data = await res.json();
    setKunden(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchTermine();
      fetchKunden();
      const interval = setInterval(() => { fetchTermine(); fetchKunden(); }, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // AUTO STATUS
  useEffect(() => {
    const now = new Date();
    termine.forEach(async (t) => {
      if (t.status === 'ausstehend') {
        const terminZeit = new Date(`${t.datum}T${t.uhrzeit}`);
        if (terminZeit < now) {
          await fetch(`${SUPABASE_URL}/rest/v1/termine?id=eq.${t.id}`, {
            method: 'PATCH',
            headers: h(user.token),
            body: JSON.stringify({ status: 'abgeschlossen' }),
          });
          fetchTermine();
        }
      }
    });
  }, [termine]);

  // KUNDE AUSWÄHLEN
  const selectKunde = (kunde) => {
    setSelectedKunde(kunde);
    setForm({ ...form, name: kunde.name, telefon: kunde.telefon });
    setKundenSearch(kunde.name);
    setShowKundenList(false);
  };

  const filteredKunden = kunden.filter(k =>
    k.name.toLowerCase().includes(kundenSearch.toLowerCase()) ||
    k.telefon.includes(kundenSearch)
  );

  // TERMIN HINZUFÜGEN
  const addTermin = async () => {
    if (!form.name || !form.telefon || !form.datum || !form.uhrzeit) {
      showToast('Bitte alle Felder ausfüllen', 'error');
      return;
    }
    setSaving(true);
    try {
      // Kunde anlegen oder finden
      let kundeId = selectedKunde?.id;
      if (!kundeId) {
        const existing = kunden.find(k => k.telefon === form.telefon);
        if (existing) {
          kundeId = existing.id;
        } else {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/kunden`, {
            method: 'POST',
            headers: h(user.token),
            body: JSON.stringify({ name: form.name, telefon: form.telefon, user_id: user.id }),
          });
          const data = await res.json();
          kundeId = data[0]?.id;
        }
      }

      // Besuchszähler erhöhen
      if (kundeId) {
        const kunde = kunden.find(k => k.id === kundeId);
        await fetch(`${SUPABASE_URL}/rest/v1/kunden?id=eq.${kundeId}`, {
          method: 'PATCH',
          headers: h(user.token),
          body: JSON.stringify({ besuche: (kunde?.besuche || 0) + 1 }),
        });
      }

      // Termin speichern
      await fetch(`${SUPABASE_URL}/rest/v1/termine`, {
        method: 'POST',
        headers: h(user.token),
        body: JSON.stringify({
          name: form.name,
          telefon: form.telefon,
          datum: form.datum,
          uhrzeit: form.uhrzeit,
          status: 'ausstehend',
          sms_gesendet: false,
          user_id: user.id,
          kunde_id: kundeId,
        }),
      });

      showToast(`Termin für ${form.name} gespeichert ✓`);
      setForm({ name: '', telefon: '', datum: '', uhrzeit: '' });
      setKundenSearch('');
      setSelectedKunde(null);
      setShowForm(false);
      fetchTermine();
      fetchKunden();
    } catch (e) {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    await fetch(`${SUPABASE_URL}/rest/v1/termine?id=eq.${id}`, {
      method: 'PATCH',
      headers: h(user.token),
      body: JSON.stringify({ status }),
    });
    fetchTermine();
    showToast('Status aktualisiert ✓');
  };

  const deleteTermin = async (id, name) => {
    await fetch(`${SUPABASE_URL}/rest/v1/termine?id=eq.${id}`, { method: 'DELETE', headers: h(user.token) });
    fetchTermine();
    showToast(`${name} gelöscht`, 'error');
  };

  const getSMSZeit = (datum, uhrzeit) => {
    const terminZeit = new Date(`${datum}T${uhrzeit}`);
    const smsZeit = new Date(terminZeit.getTime() - 24 * 60 * 60 * 1000);
    return smsZeit.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = activeTab === 'alle' ? termine : termine.filter(t => t.status === activeTab);
  const stats = {
    gesamt: termine.length,
    ausstehend: termine.filter(t => t.status === 'ausstehend').length,
    abgeschlossen: termine.filter(t => t.status === 'abgeschlossen').length,
    abgesagt: termine.filter(t => t.status === 'abgesagt').length,
  };

  // LOGIN
  if (!user) {
    return (
      <div style={s.root}>
        <div style={s.bg} /><div style={s.glow1} /><div style={s.glow2} />
        {toast && <div style={{ ...s.toast, background: toast.type === 'error' ? '#EF4444' : '#10B981' }}>{toast.msg}</div>}
        <div style={s.loginWrap}>
          <div style={s.loginCard}>
            <div style={s.logo}>✂ TerminPing</div>
            <div style={s.loginSub}>{authMode === 'login' ? 'Einloggen' : 'Account erstellen'}</div>
            <input style={s.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input style={{ ...s.input, marginTop: 12 }} type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} />
            <button style={s.saveBtn} onClick={handleAuth} disabled={authLoading}>
              {authLoading ? 'Laden...' : authMode === 'login' ? 'Einloggen' : 'Registrieren'}
            </button>
            <div style={s.switchAuth} onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
              {authMode === 'login' ? 'Noch kein Account? Registrieren' : 'Bereits registriert? Einloggen'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SETTINGS
  if (showSettings) {
    return (
      <div style={s.root}>
        <div style={s.bg} /><div style={s.glow1} /><div style={s.glow2} />
        {toast && <div style={{ ...s.toast, background: toast.type === 'error' ? '#EF4444' : '#10B981' }}>{toast.msg}</div>}
        <div style={s.container}>
          <div style={s.header}>
            <div>
              <div style={s.logo}>✂ TerminPing</div>
              <div style={s.sub}>Einstellungen</div>
            </div>
            <button style={s.logoutBtn} onClick={() => setShowSettings(false)}>← Zurück</button>
          </div>

          <div style={s.formCard}>
            <div style={s.formTitle}>📱 SMS Erinnerungstext</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              Verfügbare Platzhalter: {'{name}'}, {'{datum}'}, {'{uhrzeit}'}
            </div>
            <textarea
              style={{ ...s.input, height: 80, resize: 'vertical', fontFamily: 'inherit' }}
              value={settings.smsTemplate}
              maxLength={160}
              onChange={e => setSettings({ ...settings, smsTemplate: e.target.value })}
            />
            <div style={{ fontSize: 11, color: settings.smsTemplate.length > 140 ? '#EF4444' : '#64748B', marginTop: 6 }}>
              {settings.smsTemplate.length}/160 Zeichen {settings.smsTemplate.length > 160 ? '⚠️ Zu lang!' : ''}
            </div>
          </div>

          <div style={s.formCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.formTitle}>⭐ Bewertungsanfrage</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>{settings.bewertungAktiv ? 'Aktiv' : 'Inaktiv'}</span>
                <div
                  onClick={() => setSettings({ ...settings, bewertungAktiv: !settings.bewertungAktiv })}
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
                    background: settings.bewertungAktiv ? '#10B981' : '#374151', position: 'relative',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: settings.bewertungAktiv ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              Wird 2 Stunden nach dem Termin einmalig pro Kunde gesendet.
              Platzhalter: {'{name}'}, {'{link}'}
            </div>
            <input
              style={{ ...s.input, marginBottom: 12 }}
              placeholder="Google Bewertungslink (https://g.page/...)"
              value={settings.googleLink}
              onChange={e => setSettings({ ...settings, googleLink: e.target.value })}
            />
            <textarea
              style={{ ...s.input, height: 80, resize: 'vertical', fontFamily: 'inherit' }}
              value={settings.bewertungTemplate}
              maxLength={160}
              onChange={e => setSettings({ ...settings, bewertungTemplate: e.target.value })}
              disabled={!settings.bewertungAktiv}
            />
            <div style={{ fontSize: 11, color: settings.bewertungTemplate.length > 140 ? '#EF4444' : '#64748B', marginTop: 6 }}>
              {settings.bewertungTemplate.length}/160 Zeichen
            </div>
          </div>

          <button style={s.saveBtn} onClick={() => { showToast('Einstellungen gespeichert ✓'); setShowSettings(false); }}>
            Einstellungen speichern
          </button>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div style={s.root}>
      <div style={s.bg} /><div style={s.glow1} /><div style={s.glow2} />
      {toast && <div style={{ ...s.toast, background: toast.type === 'error' ? '#EF4444' : '#10B981' }}>{toast.msg}</div>}
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>✂ TerminPing</div>
            <div style={s.sub}>Automatische SMS-Erinnerungen · 24h vor dem Termin</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={s.userEmail}>{user.email}</div>
            <button style={s.settingsBtn} onClick={() => setShowSettings(true)}>⚙️ Einstellungen</button>
            <button style={s.logoutBtn} onClick={logout}>Logout</button>
            <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
              {showForm ? '✕ Schließen' : '+ Termin'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          {[
            { label: 'Gesamt', value: stats.gesamt, color: '#94A3B8' },
            { label: 'Ausstehend', value: stats.ausstehend, color: '#F59E0B' },
            { label: 'Abgeschlossen', value: stats.abgeschlossen, color: '#10B981' },
            { label: 'Abgesagt', value: stats.abgesagt, color: '#EF4444' },
          ].map(s2 => (
            <div key={s2.label} style={s.statCard}>
              <div style={{ ...s.statVal, color: s2.color }}>{s2.value}</div>
              <div style={s.statLabel}>{s2.label}</div>
            </div>
          ))}
        </div>

        {/* Kunden Stats */}
        {kunden.length > 0 && (
          <div style={{ ...s.formCard, marginBottom: 20, padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                👥 <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{kunden.length}</span> Kunden gespeichert
              </div>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                ⭐ Bewertungs-SMS: <span style={{ color: settings.bewertungAktiv ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                  {settings.bewertungAktiv ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div style={s.formCard}>
            <div style={s.formTitle}>Neuer Termin</div>

            {/* Kundensuche */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                ref={searchRef}
                style={s.input}
                placeholder="Kunde suchen oder neu eingeben..."
                value={kundenSearch}
                onChange={e => {
                  setKundenSearch(e.target.value);
                  setForm({ ...form, name: e.target.value });
                  setSelectedKunde(null);
                  setShowKundenList(true);
                }}
                onFocus={() => setShowKundenList(true)}
              />
              {showKundenList && kundenSearch && filteredKunden.length > 0 && (
                <div style={s.dropdown}>
                  {filteredKunden.map(k => (
                    <div key={k.id} style={s.dropdownItem} onClick={() => selectKunde(k)}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#F8FAFC' }}>{k.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{k.telefon} · {k.besuche} Besuche</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={s.formGrid}>
              <input
                style={s.input}
                placeholder="Telefon (+49...)"
                value={form.telefon}
                onChange={e => setForm({ ...form, telefon: e.target.value })}
              />
              <input style={s.input} type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} />
              <input style={s.input} type="time" value={form.uhrzeit} onChange={e => setForm({ ...form, uhrzeit: e.target.value })} />
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
          ].map(tab => (
            <button key={tab.key} style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={s.list}>
          {loading && <div style={s.empty}>Laden...</div>}
          {!loading && filtered.length === 0 && <div style={s.empty}>Keine Termine gefunden</div>}
          {filtered.map(t => {
            const sc = statusConfig[t.status] || statusConfig.ausstehend;
            const kunde = kunden.find(k => k.id === t.kunde_id);
            return (
              <div key={t.id} style={s.card}>
                <div style={s.cardLeft}>
                  <div style={s.avatar}>{t.name[0].toUpperCase()}</div>
                  <div>
                    <div style={s.name}>{t.name}</div>
                    <div style={s.meta}>📞 {t.telefon}</div>
                    <div style={s.meta}>🗓 {t.datum} um {t.uhrzeit} Uhr</div>
                    {kunde && <div style={s.meta}>👥 {kunde.besuche} Besuche {kunde.bewertung_gesendet ? '· ⭐ Bewertet' : ''}</div>}
                    {t.sms_gesendet
                      ? <div style={s.smsSent}>📱 SMS gesendet am {getSMSZeit(t.datum, t.uhrzeit)}</div>
                      : <div style={s.smsPending}>⏳ SMS geplant für {getSMSZeit(t.datum, t.uhrzeit)}</div>
                    }
                  </div>
                </div>
                <div style={s.cardRight}>
                  <div style={{ ...s.badge, color: sc.color, background: sc.bg }}>{sc.label}</div>
                  <select style={s.select} value={t.status} onChange={e => updateStatus(t.id, e.target.value)}>
                    <option value="ausstehend">Ausstehend</option>
                    <option value="abgeschlossen">Abgeschlossen</option>
                    <option value="abgesagt">Abgesagt</option>
                    <option value="nicht_erschienen">Nicht erschienen</option>
                  </select>
                  <button style={s.deleteBtn} onClick={() => deleteTermin(t.id, t.name)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={s.footer}>TerminPing · Alle Termine werden sicher in der Datenbank gespeichert</div>
      </div>
    </div>
  );
}

const s = {
  root: { minHeight: '100vh', background: '#0A0F1E', fontFamily: "'DM Sans','Helvetica Neue',sans-serif", position: 'relative', overflow: 'hidden', paddingBottom: 60 },
  bg: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.06) 0%, transparent 60%)', pointerEvents: 'none' },
  glow1: { position: 'fixed', top: -200, left: -200, width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' },
  glow2: { position: 'fixed', bottom: -200, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' },
  toast: { position: 'fixed', top: 24, right: 24, zIndex: 1000, padding: '12px 20px', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
  loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 },
  loginCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 40, width: '100%', maxWidth: 400, backdropFilter: 'blur(10px)' },
  loginSub: { color: '#64748B', fontSize: 14, marginBottom: 24, marginTop: 4 },
  switchAuth: { color: '#6366F1', fontSize: 13, textAlign: 'center', marginTop: 16, cursor: 'pointer' },
  container: { maxWidth: 900, margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, flexWrap: 'wrap', gap: 16 },
  logo: { fontSize: 28, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748B' },
  userEmail: { fontSize: 12, color: '#64748B' },
  addBtn: { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  settingsBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', borderRadius: 10, padding: '10px 16px', fontSize: 14, cursor: 'pointer' },
  logoutBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 },
  statCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 16px', textAlign: 'center' },
  statVal: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: 500 },
  formCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: 24, marginBottom: 24 },
  formTitle: { color: '#F8FAFC', fontWeight: 700, fontSize: 16, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: '#F8FAFC', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  saveBtn: { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 8 },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#1A1F2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 100, overflow: 'hidden', marginTop: 4 },
  dropdownItem: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' },
  tabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px', color: '#64748B', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  tabActive: { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { textAlign: 'center', color: '#475569', padding: 40, fontSize: 14 },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  name: { color: '#F8FAFC', fontWeight: 600, fontSize: 15, marginBottom: 4 },
  meta: { color: '#64748B', fontSize: 12, marginBottom: 2 },
  smsSent: { color: '#10B981', fontSize: 11, marginTop: 4, fontWeight: 500 },
  smsPending: { color: '#F59E0B', fontSize: 11, marginTop: 4, fontWeight: 500 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  badge: { padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#F8FAFC', fontSize: 12, cursor: 'pointer', outline: 'none' },
  deleteBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer' },
  footer: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 40 },
};
