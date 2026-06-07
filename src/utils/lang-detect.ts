const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  scala: 'scala',
  r: 'r',
  lua: 'lua',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  cljs: 'clojure',
  zig: 'zig',
  sol: 'solidity',
  dart: 'dart',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  toml: 'toml',
};

/**
 * Detect programming language from a file path based on its extension.
 * Returns null if the extension is not in the known map.
 */
export function detectLanguage(filePath: string): string | null {
  if (!filePath || filePath.trim() === '') return null;

  const basename = filePath.split('/').pop() || filePath;
  // Special case: Dockerfile (no meaningful extension)
  if (/^Dockerfile$/i.test(basename)) return 'dockerfile';

  const dotIdx = basename.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const ext = basename.slice(dotIdx + 1).toLowerCase();
  if (!ext) return null;

  return EXTENSION_MAP[ext] ?? null;
}
