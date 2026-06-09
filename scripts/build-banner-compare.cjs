const figlet = require('figlet');
const fs = require('fs');

const fonts = [
  { name: 'ANSI Shadow', desc: '╔╗╚╝║═ 双线框 | 街机主机游戏风格 | 天然游戏感', size: '33w × 6h', rec: true },
  { name: 'Big', desc: '/\\/\\ 对称钻石 | 优雅干净 | 最易辨认', size: '26w × 6h', rec: true },
  { name: 'Larry 3D', desc: '/\\ 立体3D | 当前方案 | 深度层次感', size: '44w × 7h' },
  { name: 'Delta Corps Priest 1', desc: '▀▄█ 像素方块 | 最大最粗 | 半块高密度', size: '42w × 8h' },
  { name: 'Big Chief', desc: 'ASCII 线框3D | 建筑感 | 立体透视', size: '36w × 6h' },
  { name: 'Henry 3D', desc: '引号3D阴影 | 独特风格 | ."" 字符', size: '43w × 7h' },
  { name: 'Colossal', desc: '888 数字体 | 金币/积分风格 | 非常醒目', size: '43w × 8h' },
  { name: 'Doom', desc: '/__\\ 方正哥特 | 暗黑风格 | 下划线重', size: '26w × 6h' },
];

let html = `<!DOCTYPE html>
<html><head><meta charset=utf-8>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080810;color:#ccc;font:13px "JetBrains Mono","SF Mono","Fira Code",monospace;padding:24px}
h1{color:#0ff;font-size:20px;margin-bottom:4px}
.sub{color:#555;font-size:12px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px}
.card{background:#0d0d1a;border:1px solid #1a1a33;border-radius:8px;padding:18px;position:relative;transition:border-color .2s}
.card.rec{border-color:rgba(0,255,255,.25);box-shadow:0 0 24px rgba(0,255,255,.04)}
.card:hover{border-color:rgba(255,255,255,.15)}
.badge{position:absolute;top:12px;right:14px;font-size:10px;padding:2px 8px;border-radius:3px;font-weight:700;letter-spacing:.3px}
.badge.best{background:#0ff;color:#000}
.badge.alt{background:rgba(255,255,255,.06);color:#666;border:1px solid rgba(255,255,255,.08)}
.label{color:#0ff;font-size:14px;font-weight:700;margin-bottom:2px}
.size{color:#888;font-weight:400;font-size:12px}
.desc{color:#0f0;font-size:11px;margin:6px 0 14px;font-weight:500;line-height:1.5}
.art{white-space:pre;line-height:1.08;overflow-x:auto;padding:8px 0;border-top:1px solid rgba(255,255,255,.04)}
</style></head><body>
<h1>🎨 AGPA ASCII Banner — 字体方案全对比</h1>
<p class="sub">8 款 figlet 字体渲染 "AGPA" | cyan → magenta 渐变 | 终端 80 列模拟 | 2026-06-09</p>
<div class="grid">
`;

const G = [
  '#00ffff','#00dcff','#4db4ff','#9650ff',
  '#dc32dc','#ff00aa','#ff0078','#ff1446',
];

fonts.forEach((f) => {
  const art = figlet.textSync('AGPA', { font: f.name, horizontalLayout: 'full' });
  const lines = art.split('\n').filter(l => l.trim().length > 0);

  html += `<div class="card${f.rec ? ' rec' : ''}">`;
  html += `<span class="badge ${f.rec ? 'best' : 'alt'}">${f.rec ? '★ 推荐' : '候选'}</span>`;
  html += `<div class="label">${f.name} <span class="size">${f.size}</span></div>`;
  html += `<div class="desc">${f.desc}</div>`;
  html += '<div class="art">';

  lines.forEach((l, j) => {
    const esc = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += `<span style="color:${G[j % G.length]}">${esc}</span>\n`;
  });

  html += '</div></div>\n';
});

html += `</div>
<div style="margin-top:32px;padding:20px;background:#0d0d1a;border:1px solid #1a1a33;border-radius:8px">
<h2 style="color:#0ff;font-size:14px;margin-bottom:12px">📝 分析笔记</h2>
<pre style="color:#aaa;font-size:11px;line-height:1.7">
<b style="color:#0ff">ANSI Shadow</b> — 唯一使用 ╔╗╚╝║═ 双线框字符的字体。这些字符本身就是游戏 UI / 终端界面的原生元素，
    天然适配"成就系统"主题。每个字母有边框包围，结构感极强，远距离可读性最高。
    问题：33w 偏窄，终端右侧有大片空白。

<b style="color:#0ff">Big</b> — /\\ 形成对称钻石型轮廓，字面最干净。是唯一"不像 ASCII art 的 ASCII art"。
    问题是只有 26w × 6h，在 80 列终端上显得太小。

<b style="color:#0ff">Larry 3D</b> — 当前方案。44w × 7h 宽度适中，/\\ 数字 3D 立体效果层次分明。
    但 \\和 / 交叠处稍显凌乱，第一行 ______ 容易被当成分隔线而非字母 A 的顶部。

<b style="color:#0ff">Delta Corps Priest 1</b> — ▀▄█ 半块字符，密度最高，最有"像素游戏"感。8 行最高。
    问题是 ▀▄ 半块字符在某些终端宽度不一致，可能出现缝隙。

<b style="color:#0ff">Colossal</b> — 888 数字体。最像"金币计数器"——用数字 8 编码字母轮廓，积分/金币风格。
    但可能需要终端字号够大才看得出是字母。

<b style="color:#0ff">关键洞见</b> — 现有方案只在"单个 figlet 字体"里挑，没有考虑 <b style="color:#00ff88">字体混合 + 框架设计</b>：
    1. 可以用 ANSI Shadow 做主标题 + Big 做副标题（如 profile 名）
    2. 可以给 Big 加一个 ╔═╗║╚═╝ 外框，视觉面积翻倍
    3. 可以双色打印同一字体偏移 1px 做 3D 阴影（不需要第二个 figlet）
</pre>
</div>
</body></html>`;

fs.writeFileSync('/tmp/agpa-banner-compare.html', html);
console.log('Written: /tmp/agpa-banner-compare.html');
