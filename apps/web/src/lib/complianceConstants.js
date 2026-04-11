export const UK_DBS_GUIDANCE_URL = 'https://www.gov.uk/disclosure-barring-service-check';

const UK_COUNTRY_VARIANTS = new Set([
  'uk',
  'u.k.',
  'united kingdom',
  'great britain',
  'england',
  'scotland',
  'wales',
  'northern ireland'
]);

export const BACKGROUND_CHECK_TYPE_OPTIONS = [
  { value: 'DBS', label: 'DBS', countries: ['uk'] },
  { value: 'Garda Vetting', label: 'Garda Vetting', countries: ['ireland'] },
  { value: 'FBI/State Criminal Check', label: 'FBI/State Criminal Check', countries: ['usa'] },
  { value: 'Vulnerable Sector Check', label: 'Vulnerable Sector Check', countries: ['canada'] },
  { value: 'Working With Children Check', label: 'Working With Children Check', countries: ['australia'] },
  { value: '__other__', label: 'Other (specify)', countries: ['*'] }
];

export function normalizeCountry(value) {
  return String(value || '').trim().toLowerCase();
}

export function isUkCountry(value) {
  return UK_COUNTRY_VARIANTS.has(normalizeCountry(value));
}

export function getBackgroundCheckLabel(value) {
  return isUkCountry(value) ? 'DBS Check' : 'Background Check';
}

export function getBackgroundCheckTypeOptions(country) {
  const normalized = normalizeCountry(country);

  const preferred = BACKGROUND_CHECK_TYPE_OPTIONS.filter((option) => {
    if (option.countries.includes('*')) return false;
    return option.countries.includes(normalized) || (option.countries.includes('uk') && isUkCountry(normalized));
  });

  const general = BACKGROUND_CHECK_TYPE_OPTIONS.filter((option) => option.value !== '__other__' && !preferred.includes(option));
  const other = BACKGROUND_CHECK_TYPE_OPTIONS.find((option) => option.value === '__other__');

  return [...preferred, ...general, ...(other ? [other] : [])];
}

export function getBackgroundCheckGuidance(country) {
  if (isUkCountry(country)) {
    return {
      helpText: 'If you coach children in the UK, you must hold a valid DBS check.',
      linkLabel: 'View GOV.UK DBS guidance',
      linkUrl: UK_DBS_GUIDANCE_URL,
      note: 'FACT may request proof before approving your profile.'
    };
  }

  return {
    helpText: 'If you coach children, you must hold the appropriate background check for your country. Please refer to your local government authority or national police service.',
    linkLabel: null,
    linkUrl: null,
    note: 'FACT may request proof before approving your profile.'
  };
}

export function isBackgroundCheckExpired(expiresAt) {
  if (!expiresAt) return false;
  const dateValue = String(expiresAt).slice(0, 10);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const expiryDate = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(expiryDate.getTime())) return false;
  return expiryDate < today;
}

export function getBackgroundCheckDisplayStatus(status, expiresAt) {
  if (status === 'verified' && isBackgroundCheckExpired(expiresAt)) {
    return 'expired';
  }
  return status || 'incomplete';
}
