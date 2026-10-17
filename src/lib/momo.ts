/**
 * Ghana phone helpers for checkout: normalise what guests type, validate it,
 * and detect the Mobile Money network from the number prefix so guests don't
 * have to pick it themselves.
 */

export type MomoNetwork = 'mtn' | 'telecel' | 'at';

export const MOMO_NETWORKS: Record<MomoNetwork, { label: string; short: string }> = {
  mtn: { label: 'MTN MoMo', short: 'MTN' },
  telecel: { label: 'Telecel Cash', short: 'Telecel' },
  at: { label: 'AT Money', short: 'AT' },
};

const PREFIX_TO_NETWORK: Record<string, MomoNetwork> = {
  '024': 'mtn', '025': 'mtn', '053': 'mtn', '054': 'mtn', '055': 'mtn', '059': 'mtn',
  '020': 'telecel', '050': 'telecel',
  '026': 'at', '027': 'at', '056': 'at', '057': 'at',
};

/** Convert "+233 24 412 3456", "233244123456" or "024-412-3456" to "0244123456". */
export function normalizeGhanaPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9 && !digits.startsWith('0')) return `0${digits}`;
  return digits;
}

export function isValidGhanaPhone(input: string): boolean {
  return /^0[235]\d{8}$/.test(normalizeGhanaPhone(input));
}

export function detectMomoNetwork(input: string): MomoNetwork | null {
  const phone = normalizeGhanaPhone(input);
  return phone.length >= 3 ? PREFIX_TO_NETWORK[phone.slice(0, 3)] ?? null : null;
}

/** "0244123456" → "024 412 3456" */
export function formatGhanaPhone(input: string): string {
  const phone = normalizeGhanaPhone(input);
  if (phone.length !== 10) return input;
  return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
}
