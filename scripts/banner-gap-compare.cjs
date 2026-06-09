const figlet = require('figlet');
const fs = require('fs');

const G_HTML = ['#00ffff','#00dcff','#4db4ff','#9650ff','#dc32dc','#ff00aa','#ff0078'];

// Render each letter separately
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

let html = `<!DOCTYPE html>
<html><head><meta charset=utf-8>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080810;color:#ccc;font:13px "JetBrains Mono","SF Mono",monospace;padding:24px}
h1{color:#0ff;font-size:20px;margin-bottom:4px}
.sub{color:#555;font-size:12px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:16px}
.card{background:#0d0d1a;border:1px solid #1a1a33;border-radius:8px;padding:18px;position:relative;transition:border-color .2s}
.card:hover{border-color:rgba(255,255,255,.15)}
.card.pick{border-color:rgba(0,255,255,.3);box-shadow:0 0 24px rgba(0,255,255,.06)}
.label{color:#0ff;font-size:14px;font-weight:700;margin-bottom:2px}
.stats{color:#888;font-size:11px;margin-bottom:14px}
.art{white-space:pre;line-height:1.14;font-weight:700;padding:12px 0;border-top:1px solid rgba(255,255,255,.05)}
.term{background:#0a0a14;border:1px solid #1a1a33;border-radius:6px;padding:20px 20px 14px;position:relative}
.subt{color:#555;font-size:10.5px;margin-top:8px;font-style:italic}
.link{color:#3a3a4a;font-size:10px;margin-top:2px}
.rec{position:absolute;top:12px;right:14px;font-size:10px;padding:2px 8px;border-radius:3px;font-weight:700;background:#0ff;color:#000;letter-spacing:.5px}
</style></head><body>
<h1>🎨 Larry 3D — 字母间距 gap 对比</h1>
<p class="sub">逐字母独立渲染后拼接 | spacer = gap 空格 | 青色边框 = 推荐 | 80列终端模拟</p>
<div class="grid">
`;

[0,1,2,3,4,5].forEach(g => {
  const rows = joinRows(g);
  const w = Math.max(...rows.map(l => l.length));
  const pct = Math.round(w / 80 * 100);
  const isRec = (g === 2 || g === 3);

  html += `<div class="card${isRec ? ' pick' : ''}">`;
  if (isRec) html += '<span class="rec">★ gap=' + g + '</span>';
  html += `<div class="label">gap = ${g}</div>`;
  html += `<div class="stats">${w}w × 7h  |  占终端 80 列的 ${pct}%</div>`;
  html += '<div class="term"><div class="art">';

  rows.forEach((l, i) => {
    const esc = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += `<span style="color:${G_HTML[i % 7]}">${esc}</span>\n`;
  });

  html += '</div>';
  html += '<div class="subt">  gamified achievement tracking for AI coding tools</div>';
  html += '<div class="link">  github.com/eiainano/AgentPlayerAchievements  ·  v0.1.8</div>';
  html += '</div></div>\n';
});

// Analysis table
html += `</div>
<div style="margin-top:24px;padding:20px;background:#0d0d1a;border:1px solid #1a1a33;border-radius:8px">
<h2 style="color:#0ff;font-size:14px;margin-bottom:14px">📐 间距 vs 宽度 分析表</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px">
<tr style="color:#0ff">
  <th style="text-align:left;padding:6px 10px;border-bottom:1px solid #1a1a33">gap</th>
  <th style="text-align:right;padding:6px 10px;border-bottom:1px solid #1a1a33">宽度</th>
  <th style="text-align:right;padding:6px 10px;border-bottom:1px solid #1a1a33">80列占比</th>
  <th style="text-align:right;padding:6px 10px;border-bottom:1px solid #1a1a33">120列占比</th>
  <th style="text-align:left;padding:6px 10px;border-bottom:1px solid #1a1a33">评价</th>
</tr>`;

[0,1,2,3,4,5].forEach(g => {
  const rows = joinRows(g);
  const w = Math.max(...rows.map(l => l.length));
  const judge = w <= 44 ? '偏窄 — 两侧留白过多' :
                w <= 47 ? '略窄 — 尚可，呼吸感好' :
                w <= 50 ? '★ 适中 — 比例舒适' :
                w <= 53 ? '★ 大气 — 填充得体，存在感强' :
                w <= 56 ? '饱满 — 接近终端边缘' : '太宽 — 可能换行';
  const c = w <= 44 ? '#ff0' : w <= 53 ? '#0f0' : '#f80';
  html += `<tr>
    <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.03);font-weight:700">${g}</td>
    <td style="text-align:right;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.03);color:#0ff">${w}w</td>
    <td style="text-align:right;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.03)">${Math.round(w/80*100)}%</td>
    <td style="text-align:right;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.03)">${Math.round(w/120*100)}%</td>
    <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.03);color:${c}">${judge}</td>
  </tr>`;
});

html += `</table>
<div style="margin-top:16px;padding:14px;background:rgba(0,255,255,.04);border-left:3px solid #0ff;border-radius:0 4px 4px 0">
<span style="color:#0ff;font-weight:700">💡 建议：</span>
<span style="color:#aaa;font-size:12px">
<code style="color:#fff;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px">gap=2</code> 适合日常使用，呼吸感舒适，50w占80列62%。
<code style="color:#fff;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px">gap=3</code> 更大气，适合展示/截图/欢迎页，53w占80列66%。
两者都是干净的单体字母拼接（无内部拉伸变形），差距很小，主要看个人审美偏好。
</span>
</div>
</div>
</body></html>`;

fs.writeFileSync('/tmp/agpa-gap-compare.html', html);
console.log('Written: /tmp/agpa-gap-compare.html');
