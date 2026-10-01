import React, { useEffect, useState } from 'react';
import { User, Plus, Trash2, Wand2, Loader2 } from 'lucide-react';
import { EMPTY_VAULT, IdentityVault } from '../../identity/vault.types';
import { loadIdentityVault, saveIdentityVault } from '../../identity/vaultStore';
import { runFormFill } from '../../identity/runFormFill';

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold text-text-secondary">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
      />
    </label>
  );
}

export function IdentityVaultSection({ showToast }: { showToast: (msg: string) => void }) {
  const [vault, setVault] = useState<IdentityVault>(EMPTY_VAULT);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  useEffect(() => {
    loadIdentityVault().then(setVault);
  }, []);

  const patch = (partial: Partial<IdentityVault>) => setVault((v) => ({ ...v, ...partial }));

  const handleSave = async () => {
    setSaving(true);
    await saveIdentityVault(vault);
    setSaving(false);
    showToast('Identity vault saved on this device only.');
  };

  const handleFill = async () => {
    await saveIdentityVault(vault);
    setFilling(true);
    setReceipt(null);
    try {
      const msg = await runFormFill();
      setReceipt(msg);
      showToast('Form fill finished — check the page. Submit is still yours.');
    } finally {
      setFilling(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 w-7 h-7 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-text-primary">Form identity vault</h4>
          <p className="text-[10px] text-text-muted leading-relaxed mt-0.5">
            Stored in IndexedDB on this PC — not used as a password manager. Click the Google Form / Unstop / job page, then <b>Fill this form</b>. We never auto-submit, and we skip passwords, OTP, CAPTCHA, and file uploads.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Full name" value={vault.fullName} onChange={(v) => patch({ fullName: v })} />
        <Field label="Email" value={vault.email} onChange={(v) => patch({ email: v })} placeholder="you@email.com" />
        <Field label="First name" value={vault.firstName} onChange={(v) => patch({ firstName: v })} />
        <Field label="Last name" value={vault.lastName} onChange={(v) => patch({ lastName: v })} />
        <Field label="Phone" value={vault.phone} onChange={(v) => patch({ phone: v })} placeholder="+91 …" />
        <Field label="Date of birth" value={vault.dateOfBirth} onChange={(v) => patch({ dateOfBirth: v })} placeholder="DD/MM/YYYY" />
        <Field label="Gender" value={vault.gender} onChange={(v) => patch({ gender: v })} />
        <Field label="City" value={vault.city} onChange={(v) => patch({ city: v })} />
        <Field label="State" value={vault.state} onChange={(v) => patch({ state: v })} />
        <Field label="PIN code" value={vault.pincode} onChange={(v) => patch({ pincode: v })} />
        <Field label="LinkedIn" value={vault.linkedin} onChange={(v) => patch({ linkedin: v })} />
        <Field label="GitHub" value={vault.github} onChange={(v) => patch({ github: v })} />
        <Field label="College" value={vault.college} onChange={(v) => patch({ college: v })} />
        <Field label="Degree / branch" value={vault.degree} onChange={(v) => patch({ degree: v })} />
        <Field label="Graduation year" value={vault.graduationYear} onChange={(v) => patch({ graduationYear: v })} />
        <Field label="CGPA" value={vault.cgpa} onChange={(v) => patch({ cgpa: v })} />
        <Field label="Current role" value={vault.currentRole} onChange={(v) => patch({ currentRole: v })} />
        <Field label="Years of experience" value={vault.yearsExperience} onChange={(v) => patch({ yearsExperience: v })} />
        <Field label="Current CTC" value={vault.currentCtc} onChange={(v) => patch({ currentCtc: v })} />
        <Field label="Expected CTC" value={vault.expectedCtc} onChange={(v) => patch({ expectedCtc: v })} />
        <Field label="Notice period" value={vault.noticePeriod} onChange={(v) => patch({ noticePeriod: v })} />
        <Field label="Preferred location" value={vault.preferredLocation} onChange={(v) => patch({ preferredLocation: v })} />
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold text-text-secondary">About / summary (job forms)</span>
        <textarea
          value={vault.about}
          onChange={(e) => patch({ about: e.target.value })}
          rows={3}
          className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
        />
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-text-secondary">Custom (Unstop ID, roll no, …)</span>
          <button
            type="button"
            onClick={() => patch({ custom: [...vault.custom, { key: '', value: '' }] })}
            className="text-[10px] text-accent font-semibold flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {vault.custom.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={row.key}
              onChange={(e) => {
                const custom = [...vault.custom];
                custom[i] = { ...custom[i], key: e.target.value };
                patch({ custom });
              }}
              placeholder="Label on the form"
              className="flex-1 bg-bg-secondary border border-card-border rounded-lg px-2 py-1 text-[11px] text-text-primary"
            />
            <input
              value={row.value}
              onChange={(e) => {
                const custom = [...vault.custom];
                custom[i] = { ...custom[i], value: e.target.value };
                patch({ custom });
              }}
              placeholder="Value"
              className="flex-1 bg-bg-secondary border border-card-border rounded-lg px-2 py-1 text-[11px] text-text-primary"
            />
            <button
              type="button"
              onClick={() => patch({ custom: vault.custom.filter((_, j) => j !== i) })}
              className="text-text-muted hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-card-border text-text-primary hover:bg-card cursor-pointer disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save vault'}
        </button>
        <button
          type="button"
          onClick={handleFill}
          disabled={filling}
          className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-accent hover:bg-accent-hover text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {filling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Fill this form
        </button>
      </div>
      {receipt && (
        <pre className="text-[10px] text-text-secondary whitespace-pre-wrap bg-bg-secondary/60 border border-card-border rounded-xl p-2.5 max-h-40 overflow-y-auto">
          {receipt.replace(/\*\*/g, '')}
        </pre>
      )}
    </div>
  );
}
