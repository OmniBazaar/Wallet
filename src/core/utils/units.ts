/**
 * Unit conversion utilities (bigint-based, strict-mode friendly)
 */

/**
 * Convert base units to decimal string.
 * @param weiInput - Input value in base units (wei)
 * @param decimals - Number of decimal places
 * @param options - Formatting options
 * @param options.pad - Whether to pad trailing zeros
 * @param options.commify - Whether to add comma separators
 * @returns Formatted decimal string
 */
export function fromBase(weiInput: string, decimals: number, options?: { pad?: boolean; commify?: boolean }): string {
  const v = BigInt(weiInput !== '' ? weiInput : '0');
  let base = BigInt(1);
  for (let i = 0; i < decimals; i++) {
    base = base * BigInt(10);
  }
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, '0');
  if (options?.pad !== true) {
    frac = frac.replace(/0+$/, '');
  }
  let wholeStr = whole.toString();
  if (options?.commify === true) {
    wholeStr = wholeStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return frac.length > 0 ? `${wholeStr}.${frac}` : wholeStr;
}

/**
 * Convert decimal string to base units string.
 * @param etherInput - Input value in decimal format
 * @param decimals - Number of decimal places
 * @returns Value in base units as string
 */
export function toBase(etherInput: string, decimals: number): string {
  if (!/^\s*-?\d*(?:\.\d*)?\s*$/.test(etherInput)) {
    throw new Error(`Invalid number '${etherInput}'`);
  }
  let ether = etherInput.trim();
  const negative = ether.startsWith('-');
  if (negative) ether = ether.slice(1);
  const [wholePart = '0', fracRaw = '0'] = ether.split('.');
  let base = BigInt(1);
  for (let i = 0; i < decimals; i++) {
    base = base * BigInt(10);
  }
  if (fracRaw.length > decimals) {
    throw new Error(`Too many decimal places for ${decimals}`);
  }
  const fracPadded = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  let wei = BigInt(wholePart !== '' ? wholePart : '0') * base + BigInt(fracPadded !== '' ? fracPadded : '0');
  if (negative) wei = -wei;
  return wei.toString();
}

/**
 * Check if amount has <= decimals decimal places.
 * @param amount - Amount string to validate
 * @param decimals - Maximum allowed decimal places
 * @returns True if valid, false otherwise
 */
export function isValidDecimals(amount: string, decimals: number): boolean {
  const numDecimals = amount.split('.')[1]?.length;
  return numDecimals === undefined || numDecimals <= decimals;
}
