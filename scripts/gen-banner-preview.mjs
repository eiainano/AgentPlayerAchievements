import figlet from 'figlet';
import fs from 'node:fs';

const NEON_GRADIENT = [
  '\x1b[38;2;0;255;255m',
  '\x1b[38;2;0;220;255m',
  '\x1b[38;2;77;180;255m',
  '\x1b[38;2;150;80;255m',
  '\x1b[38;2;220;50;220m',
  '\x1b[38;2;255;0;170m',
  '\x1b[38;2;255;0;170m',
];

function ansiToHtml(text) {
  let result = '';
  let state = { bold: false, dim: false, fg: null };
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\x1b' && text[i+1] === '[') {
      const end = text.indexOf('m', i);
      if (end === -1) { result += text[i]; i++; continue; }
      const code = text.substring(i+2, end);
      if (code === '0') state = { bold: false, dim: false, fg: null };
      else if (code === '1') state.bold = true;
      else if (code === '2') state.dim = true;
      else if (code.startsWith('38;2;')) {
        const parts = code.split(';');
        state.fg = 'rgb(' + parts.slice(2).join(',') + ')';
      }
      i = end + 1;
      continue;
    }
    const styles = [];
    if (state.fg) styles.push('color:' + state.fg);
    if (state.dim) styles.push('opacity:0.5');
    if (state.bold) styles.push('font-weight:bold');
    const tag = styles.length ? '<span style="' + styles.join(';') + '">' : '<span>';
    let j = i;
    while (j < text.length && text[j] !== '\x1b') j++;
    result += tag + text.substring(i, j).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>';
    i = j;
  }
  return result;
}

const fonts = [
  'Slant', 'Lean', 'Larry 3D', 'Doom', 'ANSI Shadow',
  'Ogre', 'JS Block Letters', 'Epic', 'Star Wars',
  'Big', 'Ticks Slant', 'Italic', 'Sub-Zero',
];

let allHtml = '';

for (const font of fonts) {
  try {
    const art = figlet.textSync('AGPA', { font, horizontalLayout: font === 'Larry 3D' || font === 'Lean' ? 'full' : 'default' });
    const lines = art.trimEnd().split('\n').filter(l => l.trim().length > 0);

    const coloredLines = lines.map((line, i) => {
      const c = NEON_GRADIENT[Math.min(i, NEON_GRADIENT.length - 1)];
      return '\x1b[1m' + c + line + '\x1b[0m';
    }).join('\n');

    const maxW = Math.max(...lines.map(l => l.length));
    const label = font + '  [' + maxW + 'w \xd7 ' + lines.length + 'h]';

    allHtml += '<div class="card">';
    allHtml += '<div class="label">' + label + '</div>';
    allHtml += '<div class="art">' + ansiToHtml(coloredLines) + '</div>';
    allHtml += '</div>\n';
  } catch(e) {
    allHtml += '<div class="card"><div class="label">' + font + ' (error: ' + e.message + ')</div></div>\n';
  }
}

const html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset=utf-8>\n<style>\n' +
  '* { margin: 0; padding: 0; box-sizing: border-box; }\n' +
  'body { background: #080810; color: #ccc; font: 14px "JetBrains Mono", "SF Mono", "Fira Code", monospace; padding: 24px; }\n' +
  'h1 { color: #0ff; font-size: 20px; margin-bottom: 24px; }\n' +
  '.grid { display: flex; flex-wrap: wrap; gap: 24px; }\n' +
  '.card { background: #0d0d1a; border: 1px solid #1a1a33; border-radius: 8px; padding: 16px; min-width: 320px; }\n' +
  '.label { color: #0ff; font-size: 13px; font-weight: bold; margin-bottom: 12px; border-bottom: 1px solid #1a1a33; padding-bottom: 8px; }\n' +
  '.art { white-space: pre; line-height: 1.05; }\n' +
  '</style>\n</head>\n<body>\n' +
  '<h1>AGPA Banner — All Font Candidates (cyan &rarr; magenta gradient)</h1>\n' +
  '<div class="grid">\n' + allHtml + '</div>\n' +
  '</body>\n</html>';

fs.writeFileSync('/tmp/agpa-all-fonts.html', html);
console.log('Done: /tmp/agpa-all-fonts.html');
