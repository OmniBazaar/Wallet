// Polyfill for browser compatibility
if (typeof globalThis === 'undefined') {
  window.globalThis = window;
}

// Define global for packages that expect it
if (typeof window !== 'undefined') {
  if (typeof window.global === 'undefined') {
    window.global = window.globalThis || window;
  }

  // Add Buffer polyfill
  if (typeof window.Buffer === 'undefined') {
    import('buffer').then((module) => {
      window.Buffer = module.Buffer;
    });
  }
}

// Export for @polkadot/x-globalThis compatibility
export const xglobal = globalThis;

// Add any exports that might be expected
export const extractGlobal = (name, fallback) => {
  return typeof globalThis[name] === 'undefined' ? fallback : globalThis[name];
};

export const exposeGlobal = (name, fallback) => {
  if (typeof globalThis[name] === 'undefined') {
    globalThis[name] = fallback;
  }
};

// Export global for inject plugin
export const global = window.global || globalThis;

export default globalThis;