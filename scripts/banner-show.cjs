const figlet = require('figlet');
const RST='\x1b[0m', DIM='\x1b[2m';

function show(theme, name, desc) {
  console.log('');
  console.log('\x1b[1m══════ ' + name + ' ══════\x1b[0m  \x1b[2m' + desc + '\x1b[0m');
  console.log('');

  if (theme === 'Arcade') {
    // Per-letter
    const letters = ['A','G','P','A'].map(ch =>
      figlet.textSync(ch, {font:'Larry 3D', horizontalLayout:'full'})
        .split('\n').filter(l => l.trim().length > 0)
    );
    const colors = [
      '\x1b[38;2;0;179;44m',   // Green
      '\x1b[38;2;224;16;48m',   // Red
      '\x1b[38;2;0;112;209m',   // Blue
      '\x1b[38;2;224;128;176m', // Pink
    ];
    for (let r=0; r<7; r++) {
      let row = '';
      for (let li=0; li<4; li++) {
        if (li>0) row += '  ';
        row += colors[li] + letters[li][r] + RST;
      }
      console.log(row);
    }
  } else {
    const gradient = theme === 'Neon'
      ? ['\x1b[38;2;0;255;255m','\x1b[38;2;0;220;255m','\x1b[38;2;77;180;255m','\x1b[38;2;150;80;255m','\x1b[38;2;220;50;220m','\x1b[38;2;255;0;170m','\x1b[38;2;255;0;120m']
      : ['\x1b[38;2;255;224;138m','\x1b[38;2;255;213;79m','\x1b[38;2;255;202;40m','\x1b[38;2;255;193;7m','\x1b[38;2;245;184;0m','\x1b[38;2;224;168;0m','\x1b[38;2;204;150;0m'];

    const raw = figlet.textSync('AGPA', {font:'Larry 3D', horizontalLayout:'full'});
    raw.split('\n').filter(l => l.trim().length > 0).forEach((l,i) => {
      console.log(gradient[i%7] + l + RST);
    });
  }

  console.log('');
  console.log(DIM + '  gamified achievement tracking for AI coding tools' + RST);
  console.log(DIM + '  github.com/eiainano/AgentPlayerAchievements  ·  v0.1.8' + RST);
}

show('Neon',   'Neon',   'Cyan → Magenta 赛博朋克霓虹');
show('Arcade', 'Arcade', 'PS4 △○×□ Green/Red/Blue/Pink 每字母独立色');
show('Gold',   'Gold',   '#f5b800 金色渐变，Dashboard 品牌统一');
console.log('');
