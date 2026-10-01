export interface IdentityVault {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  altEmail: string;
  altPhone: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  college: string;
  degree: string;
  branch: string;
  graduationYear: string;
  cgpa: string;
  currentRole: string;
  currentCompany: string;
  yearsExperience: string;
  currentCtc: string;
  expectedCtc: string;
  noticePeriod: string;
  preferredLocation: string;
  about: string;
  custom: { key: string; value: string }[];
}

export const EMPTY_VAULT: IdentityVault = {
  fullName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  altEmail: '',
  altPhone: '',
  dateOfBirth: '',
  gender: '',
  nationality: 'Indian',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  linkedin: '',
  github: '',
  portfolio: '',
  college: '',
  degree: '',
  branch: '',
  graduationYear: '',
  cgpa: '',
  currentRole: '',
  currentCompany: '',
  yearsExperience: '',
  currentCtc: '',
  expectedCtc: '',
  noticePeriod: '',
  preferredLocation: '',
  about: '',
  custom: []
};

export function normalizeVault(raw?: Partial<IdentityVault> | null): IdentityVault {
  const src = raw || {};
  return {
    ...EMPTY_VAULT,
    ...src,
    custom: Array.isArray(src.custom)
      ? src.custom.filter((r) => r && (r.key || r.value)).map((r) => ({ key: String(r.key || ''), value: String(r.value || '') }))
      : []
  };
}

export type InspectedField = {
  index: number;
  name: string;
  type: string;
  isPassword?: boolean;
  automationId?: string;
};

export type FieldMapping = {
  index: number;
  name: string;
  value: string;
  vaultKey: string;
  skipped?: string;
};
