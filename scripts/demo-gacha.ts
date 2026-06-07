import { AchievementEngine } from '../src/engine/engine.js';
import { homedir } from 'os';
import * as path from 'path';

const stateDir = path.join(homedir(), '.agent-achievements');
const engine = new AchievementEngine({ stateDir });
engine.resetState();
engine.init();

function trackMany(e: string, n: number, p?: Record<string, unknown>) {
  for(let i=0;i<n;i++) engine.track(e, p||{});
}

// Session 1: Basic onboarding
engine.track('session.start');
engine.track('conversation.message');
trackMany('tool.complete', 5, { tool_name: 'Read' });
trackMany('task.complete', 10);
engine.track('session.end');

// Session 2: File operations
engine.track('session.start');
trackMany('tool.complete', 5, { tool_name: 'Edit' });
trackMany('task.complete', 15);
trackMany('file.read', 10);
trackMany('file.write', 50);
engine.track('session.end');

// Session 3: Night coding
engine.track('session.start', { hour: 2, day_of_week: 6 });
trackMany('tool.complete', 30, { tool_name: 'Bash' });
trackMany('task.complete', 5);
engine.track('session.end');

// Session 4: Tests
engine.track('session.start');
trackMany('token.consumed', 1, { amount: 100000 });
trackMany('test.pass', 100);
trackMany('task.complete', 10);
engine.track('session.end');

// Sessions 5-10: more usage
for(let s=0; s<6; s++) {
  engine.track('session.start');
  trackMany('tool.complete', 8, { tool_name: 'Edit' });
  trackMany('task.complete', 3);
  trackMany('test.pass', 50);
  engine.track('session.end');
}

// Git activity
engine.track('session.start');
trackMany('git.commit', 50);
engine.track('git.push');
engine.track('session.end');

const unlocked = engine.poll();
console.log('Unlocked: ' + unlocked.length);
const rarities: Record<string,number> = {};
unlocked.forEach(a => { rarities[a.rarity] = (rarities[a.rarity]||0)+1; });
console.log('By rarity:', JSON.stringify(rarities));
console.log('IDs:', unlocked.map(a => a.id + ':' + a.rarity).join(', '));
