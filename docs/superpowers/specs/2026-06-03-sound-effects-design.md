# AGPA 成就音效系统设计

> 状态：✅ 已确认 | 日期：2026-06-03 | 基于 `docs/whatsmore.md` 设计 1 深化

---

## 1. 设计目标

成就解锁时播放 8-bit 风格音效，与像素画视觉风格统一。让听觉成为独立的信息通道，增强"游戏手感"。

---

## 2. 架构总览

```
unlock 发生 (poll.ts / hook.ts)
    │
    ▼
sendNotification(title, body, stateDir, profile, rarity)   ← 新增 rarity 可选参数
    │
    ├── 1. playSound(rarity, stateDir)   ← 新增
    │       ├── 同轮多个解锁 → 取最高稀有度
    │       ├── 检查 config.json sound_enabled 字段
    │       └── OS 适配播放 .wav
    │
    ├── 2. 系统桌面弹窗（现有）
    └── 3. 终端文本输出（现有）
```

**核心原则**：
- 音效逻辑完全封装在 `notify.ts` 的新函数 `playSound()` 中
- `sendNotification()` 签名新增可选 `rarity?` 参数，向后兼容
- `poll.ts` 和 `hook.ts` 调用处传入本轮解锁的最高稀有度
- 音效在弹窗之前播放（即时听觉反馈 → 视觉弹窗确认）

---

## 3. 音效分级

| 稀有度 | 音效特征 | 时长 | 描述 |
|--------|---------|------|------|
| **Common** | 三音上行 + 滑音 + 短延音 | ~1.0s | 类似 NES "获得道具"，三音符层层递进，尾音自然衰减 |
| **Uncommon** | 五音琶音分解和弦 + 低音垫 | ~1.5s | C-E-G-C-E 琶音上行，三角波低音铺底，有"小里程碑"仪式感 |
| **Rare** | 七音旋律 + 三角波和声 + 轻微颤音 | ~2.0s | 旋律线 + 双声部和声，尾音加 vibrato |
| **Epic** | 十音上行音阶 + 噪声鼓点 + 镲 | ~2.8s | 快速上行扫音 + 鼓点节奏 + 噪声镲收尾，类似"关卡通关" |
| **Legendary** | 短乐句（A-B-A' 结构）+ 低音鼓 + 回声 | ~3.4s | 完整三句式旋律动机，有起承转合 |
| **Mythic** | 长旋律 + 多声部和弦层叠 + 延迟混响 + 低音渐强 | ~4.0s | Boss 击败级，intro crescendo → 主旋律 → 和弦收束 → 混响衰减 |

**样式方向**：8-bit / 芯片音乐，方波+三角波+噪声三种波形组合。

---

## 4. 冷却/去重策略

同一轮 poll 内多个成就同时解锁时，只播放**最高稀有度**的音效，避免音效轰炸。

不同轮 poll 之间不加冷却限制。

实现方式：
```typescript
// poll.ts / hook.ts 中
const rarities = newlyUnlocked.map(a => rarityRank[a.rarity]);
const maxRarity = Math.max(...rarities);
const maxRarityName = RARITY_RANK[maxRarity]; // 反查稀有度名称
sendNotification(title, body, stateDir, profile, maxRarityName);
```

需要新增 `RARITY_RANK` 常量（`src/engine/types.ts`）：
```typescript
export const RARITY_RANK: Record<RarityLevel, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
};
```

---

## 5. 用户控制

### 5.1 全局开关（默认开启）

存储位置：`~/.agent-achievements/config.json` → `sound_enabled` 字段（跨 profile 全局配置）

### 5.2 CLI 命令

```
agpa sound          → 显示当前状态 ("Sound effects: ON")
agpa sound on       → 启用音效 + 打印确认
agpa sound off      → 禁用音效 + 打印确认
```

### 5.3 环境变量覆盖

```
AGPA_SOUND=off → 强制关闭（优先级高于 config.json）
AGPA_SOUND=on  → 强制开启
```

### 5.4 Dashboard 开关

Hero section 旁边小喇叭图标按钮，POST `/api/config` 即时切换。

---

## 6. 配置层实现

### 6.1 `AppConfig` 接口（`src/config.ts`）

新增字段：
```typescript
sound_enabled: boolean; // default: true
```

### 6.2 `appConfigSchema`（`src/utils/validate.ts`）

```typescript
sound_enabled: z.boolean().default(true),
```

### 6.3 读取函数

```typescript
// src/config.ts
export function isSoundEnabled(): boolean {
  // 环境变量优先
  if (process.env.AGPA_SOUND === 'off') return false;
  if (process.env.AGPA_SOUND === 'on') return true;
  return loadConfig().sound_enabled;
}

export function setSoundEnabled(enabled: boolean): void {
  saveConfig({ sound_enabled: enabled });
}
```

---

## 7. 音效播放实现

### 7.1 `playSound()` 函数（`src/utils/notify.ts`）

```typescript
import { isSoundEnabled } from '../config.js';
import { RARITY_RANK } from '../engine/types.js';

function playSound(rarity: string, stateDir: string): void {
  if (!isSoundEnabled()) return;

  const soundFile = path.join(stateDir, 'sounds', `${rarity}.wav`);
  if (!fs.existsSync(soundFile)) return;

  const os = detectOS();
  let child: ChildProcess | null = null;

  switch (os) {
    case 'macos':
      child = execFile('afplay', [soundFile]);
      break;
    case 'linux':
      // paplay for PulseAudio, aplay for ALSA
      child = execFile('paplay', [soundFile], (err) => {
        if (err) execFile('aplay', [soundFile], () => {});
      });
      break;
    case 'windows':
      child = execFile('powershell', [
        '-WindowStyle', 'Hidden', '-NoProfile', '-NonInteractive', '-Command',
        `(New-Object Media.SoundPlayer '${soundFile.replace(/'/g, "''")}').PlaySync()`,
      ]);
      break;
  }
  if (child) child.unref();
}
```

### 7.2 `sendNotification()` 签名变更

```typescript
export function sendNotification(
  title: string, 
  body: string, 
  stateDir: string, 
  profile?: string,
  rarity?: string,  // 新增：可选，传入则播放对应音效
): void {
  if (rarity) {
    playSound(rarity, stateDir);
  }
  // ... 现有通知逻辑不变
}
```

### 7.3 音效文件位置

音效文件放在 `stateDir/sounds/` 下（而非项目 `assets/`），便于后续用户自定义主题包（替换目录即可）。

`agpa init` 时自动复制 `assets/sounds/` → `~/.agent-achievements/sounds/`。

---

## 8. Dashboard API

### 8.1 新增端点

```
GET  /api/config/sound     → { sound_enabled: true/false }
POST /api/config/sound     → body: { sound_enabled: true/false } → 200 OK
```

### 8.2 UI 开关

小喇叭图标按钮（🔊/🔇），放在 Hero section 的右上角。
- 点击发送 POST `/api/config/sound`
- 图标即时切换
- 颜色：启用时绿色，禁用时灰色

---

## 9. 音效文件生成

### 9.1 生成脚本 `scripts/generate-sounds.ts`

用纯算法生成 WAV 文件（PCM 裸写，零依赖）：

- 每个音效定义 `notes[]` 数组（频率 + 时长 + 波形类型 + 音量包络）
- 方波 / 三角波 / 噪声三种波形
- 写入标准 WAV 头 + PCM 数据
- 输出到 `assets/sounds/*.wav`

后续可替换为手工精调的版本，文件名不变即可无缝切换。

### 9.2 生成方案

先用代码生成 PoC 版本，用户试听后如果不满意再手动精调。

---

## 10. 实施顺序

```
第 1 步：生成音效文件
    └── scripts/generate-sounds.ts → assets/sounds/*.wav

第 2 步：config.ts 加 sound_enabled + types.ts 加 RARITY_RANK
    └── 数据层变更，含 validate.ts schema 同步

第 3 步：notify.ts 实现 playSound() + sendNotification() 加 rarity 参数
    └── 核心实现，这一步完成后音效链路即打通

第 4 步：agpa sound CLI 命令
    └── src/cli/sound.ts（新建）+ index.ts COMMANDS 注册

第 5 步：poll.ts / hook.ts 调用处传入 rarity
    └── 接入实际触发点，计算本轮最高稀有度

第 6 步：Dashboard API + UI 开关
    └── 与 CLI 共享同一 config.json sound_enabled 字段

第 7 步：init.ts 复制音效文件到 stateDir
    └── agpa init 时自动部署

第 8 步：全链路测试
    └── 模拟解锁 → 确认音效播放 + 冷却逻辑 + 开关生效
```

---

## 11. 涉及文件汇总

| 文件 | 类型 | 说明 |
|------|------|------|
| `assets/sounds/common.wav` | 新建 | Common 音效 |
| `assets/sounds/uncommon.wav` | 新建 | Uncommon 音效 |
| `assets/sounds/rare.wav` | 新建 | Rare 音效 |
| `assets/sounds/epic.wav` | 新建 | Epic 音效 |
| `assets/sounds/legendary.wav` | 新建 | Legendary 音效 |
| `assets/sounds/mythic.wav` | 新建 | Mythic 音效 |
| `scripts/generate-sounds.ts` | 新建 | 8-bit 音效生成脚本 |
| `src/cli/sound.ts` | 新建 | `agpa sound on/off` 命令 |
| `src/utils/notify.ts` | 修改 | 新增 `playSound()`；`sendNotification()` 加 `rarity?` |
| `src/config.ts` | 修改 | 新增 `sound_enabled` 字段 + 读写函数 |
| `src/utils/validate.ts` | 修改 | `appConfigSchema` 新增 `sound_enabled` |
| `src/engine/types.ts` | 修改 | 新增 `RARITY_RANK` 常量 |
| `src/cli/index.ts` | 修改 | `COMMANDS` 注册 sound 命令 |
| `src/cli/poll.ts` | 修改 | `sendNotification()` 传入最高 rarity |
| `src/cli/hook.ts` | 修改 | `sendNotification()` 传入最高 rarity |
| `src/cli/init.ts` | 修改 | 复制音效文件到 stateDir |
| `src/dashboard/api.ts` | 修改 | 新增 `GET/POST /api/config/sound` |
| `src/dashboard/public/app.js` | 修改 | 音效开关 UI |
| `src/dashboard/public/styles.css` | 修改 | 开关样式 |

---

## 12. 未来扩展（不在本次范围）

- 用户自定义音效主题包（替换 `stateDir/sounds/` 目录）
- 连击音效（短时间内连续解锁多个成就时播特殊音效）
- Dashboard 手动试听按钮
- 稀有度阈值设置（只播 >= Epic 等，而不仅是开/关）
