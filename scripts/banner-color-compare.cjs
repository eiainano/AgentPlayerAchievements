const figlet = require('figlet');
const fs = require('fs');

// Render each letter separately with gap=2
const letters = ['A','G','P','A'].map(ch =>
  figlet.textSync(ch, {font:'Larry 3D', horizontalLayout:'full'})
    .split('\n').filter(l => l.trim().length > 0)
);

function joinRows(gap) {
  const spacer = ' '.repeat(gap);
  const rows = [];
  for (let r = 0; r < 7; r++) {
    rows.push(letters.map(l => l[r] || '').join(spacer));
  }
  return rows;
}

const rows = joinRows(2); // 50w

// ═══════════ Color schemes ═══════════
const schemes = {
  neon: {
    name: 'Cyan → Magenta (当前)',
    desc: '赛博朋克霓虹渐变，当前方案',
    colors: ['#00ffff','#00dcff','#4db4ff','#9650ff','#dc32dc','#ff00aa','#ff0078'],
    mode: 'gradient',
  },
  ps4: {
    name: 'PS4 手柄四键色',
    desc: '🟢 △ Green · 🔴 ○ Red · 🔵 × Blue · 🟣 □ Pink — 每字母独立按键色',
    colors: [
      '#00b32c','#00b32c','#00b32c','#00b32c','#00b32c','#00b32c','#00b32c', // A=Green
      '#e01030','#e01030','#e01030','#e01030','#e01030','#e01030','#e01030', // G=Red
      '#0070d1','#0070d1','#0070d1','#0070d1','#0070d1','#0070d1','#0070d1', // P=Blue
      '#e080b0','#e080b0','#e080b0','#e080b0','#e080b0','#e080b0','#e080b0', // A=Pink
    ],
    mode: 'per-letter',
  },
  gold: {
    name: 'Gold 金色渐变 (Dashboard 配色)',
    desc: '#f5b800 金色系，与 Dashboard hero 标题一致',
    colors: ['#ffe08a','#ffd54f','#ffca28','#ffc107','#f5b800','#e0a800','#cc9600'],
    mode: 'gradient',
  },
};

// Per-letter coloring: split each row into 4 letter chunks
function getLetterWidths() {
  return letters.map(l => Math.max(...l.map(line => line.length)));
}

const letterWidths = getLetterWidths();
// Each row: [A_part][spacer][G_part][spacer][P_part][spacer][A_part]
// We need to split the joined row back into letter segments

function colorRowPerLetter(row, colors7perLetter) {
  // row is "A......  G......  P......  A......"
  // We know each letter width from letterWidths
  let pos = 0;
  let html = '';
  const letterColors = [colors7perLetter[0], colors7perLetter[1], colors7perLetter[2], colors7perLetter[3]];

  for (let li = 0; li < 4; li++) {
    const lw = letterWidths[li];
    const seg = row.slice(pos, pos + lw);
    pos += lw + 2; // +2 for the spacer gap
    const esc = seg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += `<span style="color:${letterColors[li]}">${esc}</span>`;
    if (li < 3) html += '  '; // spacer between letters
  }
  return html;
}

function colorRowGradient(row, colors7, rowIdx) {
  const esc = row.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<span style="color:${colors7[rowIdx % colors7.length]}">${esc}</span>`;
}

// ═══════════ Build HTML ═══════════
let html = `<!DOCTYPE html>
<html><head><meta charset=utf-8>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080810;color:#ccc;font:13px "JetBrains Mono","SF Mono",monospace;padding:24px}
h1{color:#0ff;font-size:20px;margin-bottom:4px}
.sub{color:#555;font-size:12px;margin-bottom:24px}
.grid{display:flex;flex-direction:column;gap:20px}
.card{background:#0d0d1a;border:1px solid #1a1a33;border-radius:10px;padding:22px;transition:border-color .2s}
.card:hover{border-color:rgba(255,255,255,.12)}
.card-header{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}
.card-name{color:#0ff;font-size:15px;font-weight:700}
.card-desc{color:#0f0;font-size:11px}
.card-meta{color:#666;font-size:10px;margin-bottom:16px}
.term{background:#0a0a14;border:1px solid #1a1a33;border-radius:8px;padding:28px 24px 20px;position:relative;overflow:hidden}
.term::before{content:'Terminal · 80×24';position:absolute;top:8px;left:14px;font-size:9px;color:#2a2a3a;letter-spacing:.5px}
.term::after{content:'';position:absolute;top:8px;right:12px;width:10px;height:10px;border-radius:50%;background:#333;box-shadow:14px 0 0 #333, 28px 0 0 #333}
.art{white-space:pre;line-height:1.14;font-weight:700;padding:8px 0}
.subt{color:#555;font-size:11px;margin-top:10px;font-style:italic}
.link{color:#3a3a4a;font-size:10px;margin-top:3px}
.framed{color:#3a3a4a;margin-top:16px;font-size:11px}

/* Color swatch row */
.swatches{display:flex;gap:6px;margin-top:10px;align-items:center}
.swatch{width:16px;height:16px;border-radius:3px;border:1px solid rgba(255,255,255,.1)}
.swatch-label{font-size:10px;color:#666}

/* PS4 controller legend */
.controller{display:flex;gap:14px;align-items:center;margin:8px 0 0 0;font-size:28px}
.ctrl-btn{display:flex;flex-direction:column;align-items:center;gap:2px}
.ctrl-shape{font-size:24px;line-height:1}
.ctrl-label{font-size:9px;color:#666}
.ctrl-letter{font-size:9px;color:#888;font-weight:700}
</style></head><body>
<h1>🎨 Larry 3D Banner — 三种配色方案 (gap=2, 50w)</h1>
<p class="sub">逐字母独立渲染 | 字母间距 2 空格 | 80 列终端模拟 | 2026-06-10</p>
<div class="grid">
`;

// ═══════ Scheme 1: Neon ═══════
html += `<div class="card">
<div class="card-header"><span class="card-name">${schemes.neon.name}</span><span class="card-desc">${schemes.neon.desc}</span></div>
<div class="card-meta">cyan → magenta 7 级渐变 | 50w × 7h | 占终端 63%</div>
<div class="term"><div class="art">`;

rows.forEach((l, i) => {
  html += colorRowGradient(l, schemes.neon.colors, i) + '\n';
});

html += `</div>
<div class="subt">  gamified achievement tracking for AI coding tools</div>
<div class="link">  github.com/eiainano/AgentPlayerAchievements  ·  v0.1.8</div>
<div class="swatches">${schemes.neon.colors.map(c => `<span class="swatch" style="background:${c}"></span>`).join('')}<span class="swatch-label">7 级渐变</span></div>
</div></div>`;

// ═══════ Scheme 2: PS4 ═══════
html += `<div class="card">
<div class="card-header"><span class="card-name">${schemes.ps4.name}</span><span class="card-desc">${schemes.ps4.desc}</span></div>
<div class="card-meta">每字母独立着色 | 50w × 7h | 对应 PlayStation 手柄功能键</div>

<!-- PS4 controller visual -->
<div class="controller">
  <div class="ctrl-btn"><span class="ctrl-shape" style="color:#00b32c">△</span><span class="ctrl-letter">A</span><span class="ctrl-label">Green</span></div>
  <div class="ctrl-btn"><span class="ctrl-shape" style="color:#e01030">○</span><span class="ctrl-letter">G</span><span class="ctrl-label">Red</span></div>
  <div class="ctrl-btn"><span class="ctrl-shape" style="color:#0070d1">×</span><span class="ctrl-letter">P</span><span class="ctrl-label">Blue</span></div>
  <div class="ctrl-btn"><span class="ctrl-shape" style="color:#e080b0">□</span><span class="ctrl-letter">A</span><span class="ctrl-label">Pink</span></div>
</div>

<div class="term"><div class="art">`;

rows.forEach((l, i) => {
  const escapedRow = l; // raw row text
  // Color each letter segment
  let pos = 0;
  const spacer = '  ';
  for (let li = 0; li < 4; li++) {
    const lw = letterWidths[li];
    let seg = escapedRow.slice(pos, pos + lw);
    pos += lw + 2;
    seg = seg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += `<span style="color:${schemes.ps4.colors[li * 7]}">${seg}</span>`;
    if (li < 3) html += spacer;
  }
  html += '\n';
});

html += `</div>
<div class="subt" style="color:#e01030;font-style:normal;font-weight:700">  △ Green  ·  ○ Red  ·  × Blue  ·  □ Pink</div>
<div class="link">  PlayStation 手柄四键配色 — 游戏成就系统的最佳搭档</div>
<div class="swatches">
  <span class="swatch" style="background:#00b32c"></span><span class="swatch-label">△ Green</span>
  <span class="swatch" style="background:#e01030"></span><span class="swatch-label">○ Red</span>
  <span class="swatch" style="background:#0070d1"></span><span class="swatch-label">× Blue</span>
  <span class="swatch" style="background:#e080b0"></span><span class="swatch-label">□ Pink</span>
</div>
</div></div>`;

// ═══════ Scheme 3: Gold ═══════
html += `<div class="card">
<div class="card-header"><span class="card-name">${schemes.gold.name}</span><span class="card-desc">${schemes.gold.desc}</span></div>
<div class="card-meta">#ffe08a → #cc9600 7 级金色渐变 | 50w × 7h | 与 Dashboard 品牌色一致</div>
<div class="term"><div class="art">`;

rows.forEach((l, i) => {
  html += colorRowGradient(l, schemes.gold.colors, i) + '\n';
});

html += `</div>
<div class="subt">  Agent Player Achievements — 游戏化 AI 编码成就追踪</div>
<div class="link">  github.com/eiainano/AgentPlayerAchievements  ·  v0.1.8</div>
<div class="swatches">${schemes.gold.colors.map(c => `<span class="swatch" style="background:${c}"></span>`).join('')}<span class="swatch-label">7 级金渐变</span></div>
</div></div>`;

// ═══════ Final advice ═══════
html += `</div>

<div style="margin-top:32px;padding:20px;background:#0d0d1a;border:1px solid #1a1a33;border-radius:10px">
<h2 style="color:#0ff;font-size:14px;margin-bottom:12px">📝 配色分析</h2>
<pre style="color:#aaa;font-size:11px;line-height:1.7">

<b style="color:#0ff">方案 1 — Cyan→Magenta</b>  赛博朋克霓虹，辨识度极高，与游戏终端环境自然融合。
  缺点：与 AGPA Dashboard 的金色品牌色不统一，在浅色终端背景下可读性差。

<b style="color:#00b32c">方案 2 — PS4 手柄四色</b>  △ ○ × □ 是最具辨识度的游戏色彩组合之一。
  A=Green(△) G=Red(○) P=Blue(×) A=Pink(□) — 四个字母四个按键，天然等于"游戏系统"。
  独有优势：每字母独立颜色，滚动时颜色不会糊成一片，远距离可读性最高。
  PlayStation 手柄的 4 键颜色是全球游戏玩家瞬间能认出的视觉符号。

<b style="color:#f5b800">方案 3 — 金色渐变</b>  与 Dashboard hero 标题 (#f5b800) 同一色系，品牌统一性最优。
  #ffe08a(亮金)→#f5b800(标准)→#cc9600(暗金)，温暖、贵重，成就/奖杯质感。
  缺点：纯金色系缺少霓虹色的视觉冲击力，在白底终端上可读性不如冷色。

<b style="color:#0ff">推荐：方案 2 (PS4 四色)</b> — 这是唯一"自带故事"的配色。四个手柄按键色是
全球统一标准，不需要任何解释就能传达"这是一个游戏系统"。AGPA 正好4个字母。
</pre>
</div>

</body></html>`;

fs.writeFileSync('/tmp/agpa-color-compare.html', html);
console.log('Written: /tmp/agpa-color-compare.html');
