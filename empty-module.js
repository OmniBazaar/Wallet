// Empty module polyfill for Node.js modules that don't work in browser
export default {};

// fs module exports for compatibility
export const existsSync = () => false;
export const mkdirSync = () => {};
export const writeFileSync = () => {};
export const appendFileSync = () => {};
export const readFileSync = () => '';
export const readdirSync = () => [];
export const statSync = () => ({ isDirectory: () => false, isFile: () => false });
export const unlinkSync = () => {};
export const rmdirSync = () => {};
export const promises = {
  readFile: () => Promise.resolve(''),
  writeFile: () => Promise.resolve(),
  mkdir: () => Promise.resolve(),
  stat: () => Promise.resolve({ isDirectory: () => false, isFile: () => false }),
};

// path module exports
export const join = (...args) => args.filter(Boolean).join('/');
export const resolve = (...args) => join(...args);
export const dirname = (path) => path.split('/').slice(0, -1).join('/');
export const basename = (path) => path.split('/').pop() || '';
export const extname = (path) => {
  const base = basename(path);
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx) : '';
};

// os module exports
export const homedir = () => '/home/user';
export const tmpdir = () => '/tmp';
export const platform = () => 'browser';
export const arch = () => 'browser';
export const cpus = () => [];
export const hostname = () => 'browser';

// http/https module exports
export const request = () => { throw new Error('HTTP not available in browser'); };
export const get = () => { throw new Error('HTTP not available in browser'); };
export const createServer = () => { throw new Error('HTTP server not available in browser'); };

// zlib module exports
export const createGzip = () => { throw new Error('Zlib not available in browser'); };
export const createGunzip = () => { throw new Error('Zlib not available in browser'); };

// vm module exports
export const runInContext = () => { throw new Error('VM not available in browser'); };
export const createContext = () => ({});
export const Script = function() { throw new Error('VM Script not available in browser'); };