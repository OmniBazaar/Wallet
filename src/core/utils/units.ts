/**
 * Unit conversion utilities (bigint-based, strict-mode friendly)
 */

/** Convert base units to decimal string. */
export function fromBase(weiInput: string, decimals: number, options?: { pad?: boolean; commify?: boolean }): string {
  const v = BigInt(weiInput || '0');
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, '0');
  if (!options?.pad) {
    frac = frac.replace(/0+$/, '');
  }
  let wholeStr = whole.toString();
  if (options?.commify) {
    wholeStr = wholeStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return frac.length ? `${wholeStr}.${frac}` : wholeStr;
}

/** Convert decimal string to base units string. */
export function toBase(etherInput: string, decimals: number): string {
  if (!/^\s*-?\d*(?:\.\d*)?\s*$/.test(etherInput)) {
    throw new Error(`Invalid number '${etherInput}'`);
  }
  let ether = etherInput.trim();
  const negative = ether.startsWith('-');
  if (negative) ether = ether.slice(1);
  const [wholePart = '0', fracRaw = '0'] = ether.split('.');
  const base = 10n ** BigInt(decimals);
  if (fracRaw.length > decimals) {
    throw new Error(`Too many decimal places for ${decimals}`);
  }
  const fracPadded = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  let wei = BigInt(wholePart || '0') * base + BigInt(fracPadded || '0');
  if (negative) wei = -wei;
  return wei.toString();
}

/** Check if amount has <= decimals decimal places. */
export function isValidDecimals(amount: string, decimals: number): boolean {
  const numDecimals = amount.split('.')[1]?.length;
  return !numDecimals || numDecimals <= decimals;
}
