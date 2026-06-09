const figlet = require('figlet');

const G = [
  '\x1b[38;2;0;255;255m', '\x1b[38;2;0;210;255m',
  '\x1b[38;2;80;160;255m', '\x1b[38;2;160;80;255m',
  '\x1b[38;2;230;40;230m', '\x1b[38;2;255;0;170m',
  '\x1b[38;2;255;0;120m',
];
const RST = '\x1b[0m', B = '\x1b[1m';
function cc(a) { return a.split('\n').filter(l=>l.trim().length>0).map((l,i)=>G[i%7]+l+RST).join('\n'); }
function stats(a) {
  const ls = a.split('\n').filter(l=>l.trim().length>0);
  return (ls[0]||'').replace(/\x1b\[[0-9;]*m/g,'').length + 'w × ' + ls.length + 'h';
}

const fonts = ['Slant','ANSI Shadow','Big','Larry 3D'];

fonts.forEach(f => {
  const art = figlet.textSync('AGPA', {font:f, horizontalLayout:'full'});
  console.log('');
  console.log(B + `──── ${f}  (${stats(art)}) ────` + RST);
  console.log(cc(art));
  console.log('');
});
