import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Trash2, 
  Plus, 
  Calendar, 
  Clock, 
  RefreshCw, 
  User, 
  Phone, 
  Linkedin, 
  ShieldCheck, 
  Edit2, 
  Check, 
  Search, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  X,
  AlertCircle,
  Laptop,
  Globe,
  HelpCircle
} from 'lucide-react';
import { 
  WhatsAppAuth, 
  LinkedInAuth, 
  ContactStore, 
  MessageScheduler, 
  ResolvedRecipient, 
  ScheduledMessageJob,
  AuthResult
} from '../../agents/messenger';

export function MessagingSettingsSection({ showToast }: { showToast: (msg: string) => void }) {
  const [waAuth, setWaAuth] = useState<AuthResult | null>(null);
  const [liAuth, setLiAuth] = useState<AuthResult | null>(null);
  const [contacts, setContacts] = useState<ResolvedRecipient[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledMessageJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Address book filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'whatsapp' | 'linkedin'>('all');

  // New Contact Form State
  const [newContactName, setNewContactName] = useState('');
  const [newContactIdentifier, setNewContactIdentifier] = useState('');
  const [newContactPlatform, setNewContactPlatform] = useState<'whatsapp' | 'linkedin'>('whatsapp');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);

  // WhatsApp Connect / Edit Form State
  const [isEditingWa, setIsEditingWa] = useState(false);
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [waAccountNameInput, setWaAccountNameInput] = useState('');
  const [waClientType, setWaClientType] = useState<'desktop' | 'web' | 'ask'>('ask');
  const [waTokenInput, setWaTokenInput] = useState('');
  const [waPhoneIdInput, setWaPhoneIdInput] = useState('');
  const [showWaAdvanced, setShowWaAdvanced] = useState(false);
  const [waSession, setWaSession] = useState<{ loggedIn?: boolean; qr?: boolean; open?: boolean } | null>(null);

  // LinkedIn Connect / Edit Form State
  const [isEditingLi, setIsEditingLi] = useState(false);
  const [liHandleInput, setLiHandleInput] = useState('');
  const [liAccountNameInput, setLiAccountNameInput] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wa, li, allContacts, jobs] = await Promise.all([
        WhatsAppAuth.getAccountInfo(),
        LinkedInAuth.getAccountInfo(),
        ContactStore.getAll(),
        MessageScheduler.getPending()
      ]);
      setWaAuth(wa);
      setLiAuth(li);
      setContacts(allContacts);
      setScheduledJobs(jobs);

      const waApi = typeof window !== 'undefined' ? window.electronAPI?.whatsapp : null;
      if (waApi?.status) {
        try { setWaSession(await waApi.status()); } catch { setWaSession(null); }
      }

      // Pre-fill edit fields if connected
      const waRaw = await WhatsAppAuth.getSessionData();
      if (waRaw && waRaw.status === 'CONNECTED') {
        setWaPhoneInput(waRaw.phoneNumber || '');
        setWaAccountNameInput(waRaw.accountName || '');
        setWaClientType(waRaw.clientType || 'ask');
        setWaTokenInput(waRaw.accessToken || '');
        setWaPhoneIdInput(waRaw.phoneNumberId || '');
      } else if (waRaw?.clientType) {
        setWaClientType(waRaw.clientType);
      }

      const liRaw = await LinkedInAuth.getSessionData();
      if (liRaw && liRaw.status === 'CONNECTED') {
        setLiHandleInput(liRaw.profileHandle || '');
        setLiAccountNameInput(liRaw.accountName || '');
      }
    } catch (err) {
      console.error('[MessagingSettingsSection] Failed to load messaging data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── WhatsApp Handlers ─────────────────────────────────────
  const handleToggleWaClientType = async (type: 'desktop' | 'web' | 'ask') => {
    setWaClientType(type);
    await WhatsAppAuth.setClientType(type);
    const toastMsgs: Record<string, string> = {
      web: 'Web: FloatGPT WhatsApp window will Send (scan QR once). Not Chrome SendKeys.',
      desktop: 'Desktop: opens the Windows WhatsApp app (may only pre-fill). Prefer Web to actually send.',
      ask: 'FloatGPT will ask you each time (Desktop or Web)'
    };
    showToast(toastMsgs[type] || 'Preference updated.');
  };

  const handleConnectWhatsApp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = waPhoneInput.trim();
    if (!cleanPhone) {
      showToast('Please enter your WhatsApp phone number.');
      return;
    }

    const res = await WhatsAppAuth.connectAccount({
      phoneNumber: cleanPhone,
      accountName: waAccountNameInput.trim() || `WhatsApp (${cleanPhone})`,
      clientType: waClientType,
      accessToken: waTokenInput.trim() || undefined,
      phoneNumberId: waPhoneIdInput.trim() || undefined
    });

    setWaAuth(res);
    setIsEditingWa(false);
    showToast(res.success ? 'WhatsApp connected successfully!' : 'Failed to connect WhatsApp.');
    loadData();
  };

  const handleDisconnectWhatsApp = async () => {
    await WhatsAppAuth.disconnect();
    setWaAuth(await WhatsAppAuth.getAccountInfo());
    setIsEditingWa(false);
    setWaPhoneInput('');
    setWaAccountNameInput('');
    setWaTokenInput('');
    setWaPhoneIdInput('');
    showToast('WhatsApp disconnected.');
    loadData();
  };

  // ─── LinkedIn Handlers ─────────────────────────────────────
  const cleanLinkedInHandle = (input: string): string => {
    let clean = input.trim();
    // Normalize full URL: https://www.linkedin.com/in/username/ -> username
    clean = clean.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '');
    clean = clean.replace(/\/+$/, '');
    clean = clean.replace(/^@/, '');
    return clean;
  };

  const handleConnectLinkedIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawHandle = liHandleInput.trim();
    if (!rawHandle) {
      showToast('Please enter your LinkedIn profile handle or URL.');
      return;
    }

    const handle = cleanLinkedInHandle(rawHandle);
    const res = await LinkedInAuth.connectAccount({
      profileHandle: handle,
      accountName: liAccountNameInput.trim() || `LinkedIn (@${handle})`
    });

    setLiAuth(res);
    setIsEditingLi(false);
    showToast(res.success ? 'LinkedIn connected successfully!' : 'Failed to connect LinkedIn.');
    loadData();
  };

  const handleDisconnectLinkedIn = async () => {
    await LinkedInAuth.disconnect();
    setLiAuth(await LinkedInAuth.getAccountInfo());
    setIsEditingLi(false);
    setLiHandleInput('');
    setLiAccountNameInput('');
    showToast('LinkedIn disconnected.');
    loadData();
  };

  // ─── Contact Handlers ──────────────────────────────────────
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactIdentifier.trim()) {
      showToast('Please enter both a name and contact number/handle.');
      return;
    }

    await ContactStore.saveContact({
      name: newContactName.trim(),
      identifier: newContactIdentifier.trim(),
      platform: newContactPlatform,
      metadata: newContactCompany.trim() ? { company: newContactCompany.trim() } : {}
    });

    setNewContactName('');
    setNewContactIdentifier('');
    setNewContactCompany('');
    setShowAddContact(false);
    showToast(`Saved contact: ${newContactName}`);
    loadData();
  };

  const handleDeleteContact = async (id: string, name: string) => {
    await ContactStore.deleteContact(id);
    showToast(`Removed contact: ${name}`);
    loadData();
  };

  const handleClearDemoContacts = async () => {
    await ContactStore.clearDemoContacts();
    showToast('Cleared demo contacts from address book.');
    loadData();
  };

  const handleLoadSampleContacts = async () => {
    await ContactStore.loadSampleContacts();
    showToast('Sample contacts loaded for testing.');
    loadData();
  };

  const handleCancelJob = async (jobId: string) => {
    const success = await MessageScheduler.cancelJob(jobId);
    if (success) {
      showToast('Cancelled scheduled message.');
      loadData();
    } else {
      showToast('Could not cancel message.');
    }
  };

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      if (filterPlatform !== 'all' && c.platform !== filterPlatform) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.identifier && c.identifier.toLowerCase().includes(q)) ||
        (c.phoneNormalized && c.phoneNormalized.includes(q))
      );
    });
  }, [contacts, searchQuery, filterPlatform]);

  const hasDemos = useMemo(() => ContactStore.hasDemoContacts(contacts), [contacts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            Connected Accounts & Messaging Agent
          </span>
          <button 
            onClick={loadData}
            className="p-1 rounded-lg hover:bg-card text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="Refresh accounts and scheduler"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </h3>
        <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">
          Connect your personal messaging accounts and address book so FloatGPT can securely execute your instructions.
        </p>
      </div>

      {/* 1. Connected Platform Accounts */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* WhatsApp Card */}
        <div className="p-4 rounded-2xl bg-card border border-card-border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-xs">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary">WhatsApp Messenger Agent</h4>
                <p className="text-[10px] text-text-muted">Direct personal messages & Cloud API scheduling</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${waAuth?.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${waAuth?.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                {waAuth?.status === 'CONNECTED' ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          </div>

          {waAuth?.status === 'CONNECTED' && !isEditingWa ? (
            /* Connected View */
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-bg-secondary/60 border border-card-border/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    {waAuth.accountName || 'Active WhatsApp'}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono">{waAuth.accountId}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsEditingWa(true)}
                    className="px-2 py-1 text-[10px] font-medium text-text-muted hover:text-text-primary hover:bg-card rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-card-border"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={handleDisconnectWhatsApp}
                    className="px-2.5 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border border-rose-500/20"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Client Preference Selector */}
              <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-card-border/50 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-text-secondary">Dispatch Target:</span>
                  <span className="text-text-muted text-[9px]">
                    {waClientType === 'desktop' ? 'Windows WhatsApp app' : waClientType === 'web' ? 'FloatGPT WhatsApp window' : 'Asks each time'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-card p-1 rounded-xl border border-card-border">
                  <button
                    type="button"
                    onClick={() => handleToggleWaClientType('web')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      waClientType === 'web'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Web
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleWaClientType('desktop')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      waClientType === 'desktop'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Laptop className="w-3 h-3" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleWaClientType('ask')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      waClientType === 'ask'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <HelpCircle className="w-3 h-3" />
                    Ask Me
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-secondary/40 border border-card-border/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold text-text-secondary">WhatsApp Web session</div>
                    <div className="text-[9px] text-text-muted mt-0.5">
                      {waSession?.loggedIn
                        ? 'Logged in — messages click Send in this window, they are not only typed.'
                        : waSession?.qr
                          ? 'QR is showing. Scan with your phone, then retry send.'
                          : 'Open once, scan QR, leave it running (minimized is fine).'}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    waSession?.loggedIn
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}>
                    {waSession?.loggedIn ? 'Ready' : waSession?.qr ? 'Scan QR' : 'Idle'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      const api = window.electronAPI?.whatsapp;
                      if (!api?.openSession) {
                        showToast('Restart the FloatGPT desktop app to enable the WhatsApp session.');
                        return;
                      }
                      const status = await api.openSession();
                      setWaSession(status);
                      showToast(status?.loggedIn ? 'WhatsApp session ready.' : 'Scan the QR in the FloatGPT WhatsApp window.');
                    }}
                    className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    Open WhatsApp session
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await window.electronAPI?.whatsapp?.status?.().then(setWaSession).catch(() => {});
                    }}
                    className="px-2 py-1.5 text-[10px] font-medium text-text-muted hover:text-text-primary border border-card-border rounded-lg cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Connect or Edit Form */
            <form onSubmit={handleConnectWhatsApp} className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">Your WhatsApp Phone Number</label>
                <input
                  type="text"
                  value={waPhoneInput}
                  onChange={e => setWaPhoneInput(e.target.value)}
                  placeholder="+91 98765 43210 (include country code)"
                  className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">Account Display Name (Optional)</label>
                <input
                  type="text"
                  value={waAccountNameInput}
                  onChange={e => setWaAccountNameInput(e.target.value)}
                  placeholder="e.g. My Personal WhatsApp"
                  className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">Preferred Client</label>
                <div className="grid grid-cols-3 gap-1.5 bg-bg-secondary p-1 rounded-xl border border-card-border">
                  <button
                    type="button"
                    onClick={() => setWaClientType('web')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      waClientType === 'web'
                        ? 'bg-card text-emerald-400 border border-emerald-500/25 shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Web
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaClientType('desktop')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      waClientType === 'desktop'
                        ? 'bg-card text-emerald-400 border border-emerald-500/25 shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Laptop className="w-3 h-3" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaClientType('ask')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      waClientType === 'ask'
                        ? 'bg-card text-emerald-400 border border-emerald-500/25 shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <HelpCircle className="w-3 h-3" />
                    Ask Me
                  </button>
                </div>
              </div>

              {/* Collapsible Meta Cloud API Credentials */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowWaAdvanced(!showWaAdvanced)}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {showWaAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Meta Cloud API Configuration (Optional for Business delivery)
                </button>

                {showWaAdvanced && (
                  <div className="mt-2 p-2.5 rounded-xl bg-bg-secondary/70 border border-card-border space-y-2 animate-in fade-in">
                    <div className="space-y-1">
                      <label className="text-[9px] text-text-muted">Meta Permanent / System Access Token</label>
                      <input
                        type="password"
                        value={waTokenInput}
                        onChange={e => setWaTokenInput(e.target.value)}
                        placeholder="EAA..."
                        className="w-full bg-card border border-card-border rounded-lg px-2.5 py-1 text-[11px] text-text-primary font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-text-muted">WhatsApp Phone Number ID</label>
                      <input
                        type="text"
                        value={waPhoneIdInput}
                        onChange={e => setWaPhoneIdInput(e.target.value)}
                        placeholder="e.g. 109823487123984"
                        className="w-full bg-card border border-card-border rounded-lg px-2.5 py-1 text-[11px] text-text-primary font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {isEditingWa && (
                  <button
                    type="button"
                    onClick={() => setIsEditingWa(false)}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {isEditingWa ? 'Save Changes' : 'Connect WhatsApp'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* LinkedIn Card */}
        <div className="p-4 rounded-2xl bg-card border border-card-border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-xs">
                <Linkedin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary">LinkedIn Messenger Agent</h4>
                <p className="text-[10px] text-text-muted">Direct messaging adapter for professional network</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${liAuth?.status === 'CONNECTED' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${liAuth?.status === 'CONNECTED' ? 'bg-blue-500 animate-pulse' : 'bg-zinc-400'}`} />
                {liAuth?.status === 'CONNECTED' ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          </div>

          {liAuth?.status === 'CONNECTED' && !isEditingLi ? (
            /* Connected View */
            <div className="p-3 rounded-xl bg-bg-secondary/60 border border-card-border/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  {liAuth.accountName || 'Active LinkedIn'}
                </div>
                <div className="text-[10px] text-text-muted font-mono">@{liAuth.accountId}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditingLi(true)}
                  className="px-2 py-1 text-[10px] font-medium text-text-muted hover:text-text-primary hover:bg-card rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-card-border"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={handleDisconnectLinkedIn}
                  className="px-2.5 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border border-rose-500/20"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* Connect or Edit Form */
            <form onSubmit={handleConnectLinkedIn} className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">LinkedIn Profile Handle or URL</label>
                <input
                  type="text"
                  value={liHandleInput}
                  onChange={e => setLiHandleInput(e.target.value)}
                  placeholder="e.g. mayank-garg or linkedin.com/in/mayank-garg"
                  className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">Account Display Name (Optional)</label>
                <input
                  type="text"
                  value={liAccountNameInput}
                  onChange={e => setLiAccountNameInput(e.target.value)}
                  placeholder="e.g. Mayank Garg (LinkedIn)"
                  className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {isEditingLi && (
                  <button
                    type="button"
                    onClick={() => setIsEditingLi(false)}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {isEditingLi ? 'Save Changes' : 'Connect LinkedIn'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 2. Contact Address Book */}
      <div className="p-4 rounded-2xl bg-card border border-card-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-bold text-text-primary">Contact Address Book</h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-card border border-card-border text-text-muted">
              {contacts.length} saved
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {hasDemos && (
              <button
                onClick={handleClearDemoContacts}
                className="px-2.5 py-1 text-[10px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer border border-rose-500/20"
                title="Remove pre-loaded test contacts"
              >
                Clear Demo Contacts
              </button>
            )}

            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors cursor-pointer border border-accent/20"
            >
              {showAddContact ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {showAddContact ? 'Close' : 'Add Contact'}
            </button>
          </div>
        </div>

        {/* Add Contact Modal / Form */}
        {showAddContact && (
          <form onSubmit={handleAddContact} className="p-3 rounded-xl bg-bg-secondary border border-card-border space-y-2.5 animate-in fade-in">
            <div className="text-[11px] font-bold text-text-primary">Add New Contact</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newContactName}
                onChange={e => setNewContactName(e.target.value)}
                placeholder="Full Name (e.g. Rahul Sharma)"
                className="bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={newContactIdentifier}
                onChange={e => setNewContactIdentifier(e.target.value)}
                placeholder="Phone (+91...) or LinkedIn ID"
                className="bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={newContactPlatform}
                onChange={e => setNewContactPlatform(e.target.value as any)}
                className="bg-card border border-card-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <input
                type="text"
                value={newContactCompany}
                onChange={e => setNewContactCompany(e.target.value)}
                placeholder="Relationship / Tag (e.g. Friend, Client)"
                className="bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddContact(false)}
                className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 cursor-pointer"
              >
                Save Contact
              </button>
            </div>
          </form>
        )}

        {/* Contacts Search Bar */}
        {contacts.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search contacts by name or number..."
                className="w-full bg-bg-secondary border border-card-border rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <select
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value as any)}
              className="bg-bg-secondary border border-card-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:outline-none"
            >
              <option value="all">All</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
        )}

        {/* Contacts List or Empty State */}
        {contacts.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-bg-secondary/40 border border-card-border/40 space-y-2">
            <p className="text-xs text-text-secondary font-medium">Your address book is empty.</p>
            <p className="text-[11px] text-text-muted max-w-sm mx-auto">
              Add your real contacts so FloatGPT knows whom to message when you say "Send a WhatsApp to Rahul...".
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowAddContact(true)}
                className="px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors cursor-pointer"
              >
                Add Your First Contact
              </button>
              <button
                onClick={handleLoadSampleContacts}
                className="px-3 py-1.5 bg-card border border-card-border text-text-muted hover:text-text-primary text-xs rounded-lg transition-colors cursor-pointer"
              >
                Load Sample Contacts
              </button>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-4 text-center text-text-muted text-xs">
            No contacts match "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredContacts.map(c => (
              <div key={c.id} className="p-2.5 rounded-xl bg-bg-secondary/60 border border-card-border/60 flex items-center justify-between">
                <div className="space-y-0.5 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-primary truncate">{c.name}</span>
                    <span className={`text-[8px] font-mono px-1 py-0.2 rounded uppercase ${c.platform === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                      {c.platform}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted font-mono truncate">{c.phoneNormalized || c.identifier}</div>
                  {c.metadata?.company && (
                    <div className="text-[9px] text-text-secondary truncate">{c.metadata.company}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteContact(c.id, c.name)}
                  className="p-1 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                  title="Remove contact"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Scheduled Messages Queue */}
      <div className="p-4 rounded-2xl bg-card border border-card-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-bold text-text-primary">Persistent Scheduled Queue</h4>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
            {scheduledJobs.length} queued
          </span>
        </div>

        {scheduledJobs.length === 0 ? (
          <div className="p-4 text-center rounded-xl bg-bg-secondary/40 border border-card-border/40 text-text-muted text-[11px]">
            No pending scheduled messages. Say <span className="text-text-primary font-medium">"Float, schedule a WhatsApp to Rahul tomorrow at 4 PM"</span> to queue a message.
          </div>
        ) : (
          <div className="space-y-2">
            {scheduledJobs.map(job => (
              <div key={job.id} className="p-3 rounded-xl bg-bg-secondary/70 border border-card-border/70 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary">{job.recipient.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-card border border-card-border uppercase text-text-muted">
                      {job.platform}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary italic">"{job.message.content}"</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                    <Clock className="w-3 h-3 text-accent" />
                    <span>{new Date(job.scheduledEpochMs).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelJob(job.id)}
                  className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Cancel scheduled message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
