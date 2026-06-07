import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/utils/lang-detect.js';

describe('detectLanguage', () => {
  it('returns "python" for .py files', () => {
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('/abs/path/main.py')).toBe('python');
  });
  it('returns "typescript" for .ts/.tsx', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
    expect(detectLanguage('/src/components/Button.tsx')).toBe('typescript');
  });
  it('returns "javascript" for .js/.jsx/.mjs', () => {
    expect(detectLanguage('index.js')).toBe('javascript');
    expect(detectLanguage('App.jsx')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
  });
  it('returns "java" for .java', () => {
    expect(detectLanguage('Main.java')).toBe('java');
  });
  it('returns "cpp" for .cpp/.cc/.cxx/.hpp', () => {
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('util.cc')).toBe('cpp');
    expect(detectLanguage('util.cxx')).toBe('cpp');
    expect(detectLanguage('util.hpp')).toBe('cpp');
  });
  it('returns "c" for .c/.h', () => {
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('header.h')).toBe('c');
  });
  it('returns "rust" for .rs', () => {
    expect(detectLanguage('lib.rs')).toBe('rust');
  });
  it('returns "go" for .go', () => {
    expect(detectLanguage('main.go')).toBe('go');
  });
  it('returns null for unknown extensions', () => {
    expect(detectLanguage('notes.txt')).toBeNull();
    expect(detectLanguage('Makefile')).toBeNull();
    expect(detectLanguage('noext')).toBeNull();
  });
  it('returns null for empty path', () => {
    expect(detectLanguage('')).toBeNull();
  });
  it('handles Dockerfile naming', () => {
    expect(detectLanguage('Dockerfile')).toBe('dockerfile');
  });
  it('returns "bash" for .sh/.bash/.zsh', () => {
    expect(detectLanguage('deploy.sh')).toBe('bash');
    expect(detectLanguage('build.bash')).toBe('bash');
    expect(detectLanguage('aliases.zsh')).toBe('bash');
  });
});
