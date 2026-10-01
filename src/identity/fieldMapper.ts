import { IdentityVault, InspectedField, FieldMapping } from './vault.types';

const SKIP =
  /\b(password|passwd|pwd|otp|one[- ]time|captcha|recaptcha|cvv|cvc|pin code|mpin|upi pin|aadhaar otp|secret|ssn|social security)\b/i;

const RULES: { test: RegExp; key: keyof IdentityVault | 'custom' }[] = [
  { test: /\b(first name|firstname|given name|fname|givenname)\b/i, key: 'firstName' },
  { test: /\b(last name|lastname|surname|family name|lname)\b/i, key: 'lastName' },
  { test: /\b(full name|your name|candidate name|applicant name|legal name|student name)\b/i, key: 'fullName' },
  { test: /\b(email|e-mail)\b/i, key: 'email' },
  { test: /\b(alternate email|secondary email|personal email)\b/i, key: 'altEmail' },
  { test: /\b(mobile|phone|whatsapp|contact no|contact number|cell)\b/i, key: 'phone' },
  { test: /\b(alternate (phone|mobile)|secondary (phone|mobile))\b/i, key: 'altPhone' },
  { test: /\b(dob|date of birth|birth date|birthday)\b/i, key: 'dateOfBirth' },
  { test: /\b(gender|sex)\b/i, key: 'gender' },
  { test: /\b(nationality|citizenship)\b/i, key: 'nationality' },
  { test: /\b(address line 1|street address|street|address 1)\b/i, key: 'addressLine1' },
  { test: /\b(address line 2|address 2|apartment|suite)\b/i, key: 'addressLine2' },
  { test: /\b(city|town|district)\b/i, key: 'city' },
  { test: /\b(state|province|region)\b/i, key: 'state' },
  { test: /\b(pin code|pincode|postal|zip)\b/i, key: 'pincode' },
  { test: /\b(country)\b/i, key: 'country' },
  { test: /\b(linkedin)\b/i, key: 'linkedin' },
  { test: /\b(github)\b/i, key: 'github' },
  { test: /\b(portfolio|website|personal site)\b/i, key: 'portfolio' },
  { test: /\b(college|university|institute|campus)\b/i, key: 'college' },
  { test: /\b(degree|qualification|programme|program)\b/i, key: 'degree' },
  { test: /\b(branch|major|speciali[sz]ation|stream)\b/i, key: 'branch' },
  { test: /\b(graduation|passing year|year of (pass|graduat))\b/i, key: 'graduationYear' },
  { test: /\b(cgpa|gpa|percentage|marks)\b/i, key: 'cgpa' },
  { test: /\b(job title|current role|designation|position applying|role applying)\b/i, key: 'currentRole' },
  { test: /\b(current company|organization|employer|company name)\b/i, key: 'currentCompany' },
  { test: /\b(years? of experience|total experience|experience \(years\))\b/i, key: 'yearsExperience' },
  { test: /\b(current ctc|current salary|present ctc)\b/i, key: 'currentCtc' },
  { test: /\b(expected ctc|expected salary|notice ctc)\b/i, key: 'expectedCtc' },
  { test: /\b(notice period|notice)\b/i, key: 'noticePeriod' },
  { test: /\b(preferred location|location preference|current location|city of residence)\b/i, key: 'preferredLocation' },
  { test: /\b(about( yourself)?|bio|summary|cover letter|why (do you )?want)\b/i, key: 'about' }
];

function cleanLabel(name: string): string {
  return (name || '').replace(/\s*\*\s*/g, ' ').replace(/[:：]/g, ' ').replace(/\s+/g, ' ').trim();
}

function vaultValue(vault: IdentityVault, key: string): string {
  if (key === 'custom') return '';
  const v = (vault as any)[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function flattenVault(vault: IdentityVault): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vault)) {
    if (k === 'custom' || typeof v !== 'string' || !v.trim()) continue;
    out[k] = v.trim();
  }
  if (vault.fullName && !vault.firstName) {
    const parts = vault.fullName.trim().split(/\s+/);
    out.firstName = out.firstName || parts[0] || '';
    out.lastName = out.lastName || parts.slice(1).join(' ') || '';
  }
  if (!out.fullName && (vault.firstName || vault.lastName)) {
    out.fullName = [vault.firstName, vault.lastName].filter(Boolean).join(' ');
  }
  return out;
}

export function mapFormFields(fields: InspectedField[], vault: IdentityVault): FieldMapping[] {
  const flat = flattenVault(vault);
  const custom = (vault.custom || []).filter((c) => c.key.trim() && c.value.trim());
  const used = new Set<number>();

  return fields.map((field) => {
    const label = cleanLabel(field.name || field.automationId || `field ${field.index}`);
    if (field.isPassword || SKIP.test(label) || SKIP.test(field.type || '')) {
      return { index: field.index, name: label, value: '', vaultKey: '', skipped: 'secret / otp / captcha (never auto-filled)' };
    }
    if (/\b(file|resume|cv|upload|attach)\b/i.test(label) || /file/i.test(field.type || '')) {
      return { index: field.index, name: label, value: '', vaultKey: '', skipped: 'file upload — attach manually' };
    }

    for (const row of custom) {
      const k = row.key.trim().toLowerCase();
      if (k.length >= 3 && label.toLowerCase().includes(k)) {
        used.add(field.index);
        return { index: field.index, name: label, value: row.value.trim(), vaultKey: `custom:${row.key}` };
      }
    }

    for (const rule of RULES) {
      if (rule.test.test(label)) {
        const value = vaultValue(vault, rule.key as string) || flat[rule.key as string] || '';
        if (!value) {
          return { index: field.index, name: label, value: '', vaultKey: String(rule.key), skipped: 'empty in vault' };
        }
        return { index: field.index, name: label, value, vaultKey: String(rule.key) };
      }
    }

    return { index: field.index, name: label, value: '', vaultKey: '', skipped: 'no vault match' };
  });
}

export function detectFillFormIntent(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (/\b(send|schedule)\b/.test(lower) && /\bto\s+/.test(lower)) return false;
  return (
    /\b(fill (this |the |my )?(form|application|google form)|auto[- ]?fill|complete (this |the )?form|unstop|job (application|form)|sign ?up form|create account)\b/i.test(
      lower
    ) || /^fill form$/i.test(lower.trim())
  );
}

export function formatFillReceipt(opts: {
  title?: string;
  filled: FieldMapping[];
  skipped: FieldMapping[];
  unmatched: FieldMapping[];
  error?: string;
}): string {
  if (opts.error) {
    return `⚠️ **Form fill stopped**\n\n${opts.error}\n\nFocus the browser form (Unstop, Google Form, careers page), then try **Fill form** again. FloatGPT never clicks Submit.`;
  }
  const lines = [
    `*Filled the focused window${opts.title ? ` (${opts.title})` : ''}*`,
    '',
    `**${opts.filled.length}** field(s) filled. **${opts.skipped.length}** skipped. **${opts.unmatched.length}** unmatched.`,
    '',
    'Nothing was submitted. Check dropdowns, files, CAPTCHA, and passwords yourself.'
  ];
  if (opts.filled.length) {
    lines.push('', 'Filled:', ...opts.filled.slice(0, 16).map((f) => `- ${f.name}`));
  }
  if (opts.skipped.length) {
    lines.push('', 'Skipped:', ...opts.skipped.slice(0, 8).map((f) => `- ${f.name}: ${f.skipped}`));
  }
  if (opts.unmatched.length) {
    lines.push('', 'Add a **custom field** in Settings → Profile if you need:', ...opts.unmatched.slice(0, 8).map((f) => `- ${f.name}`));
  }
  return lines.join('\n');
}
