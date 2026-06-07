# Gacha Reveal Animation Design

> 发布日期: 2026-06-07 | 状态: 草案

## 概要

为 AGPA Dashboard 添加稀有度分级的"抽卡翻牌"解锁动画，取代现有的纯文字 Toast。

- 覆盖 6 级稀有度（Common → Mythic），每级不同复杂度
- 纯 DOM CSS 3D 动画 + Canvas 粒子层（仅 Epic+）
- 与现有音效系统同步
- 累计新增：~450 行 CSS + ~350 行 JS + 新文件 `gacha-reveal.js`

---

## 1. 动画系统架构

### 1.1 新文件

| 文件 | 用途 |
|------|------|
| `src/dashboard/public/gacha-reveal.js` | 动画管理器 — GachaQueue + GachaReveal 类 |
| — | 追加到 `styles.css` 的动画 @keyframes |

### 1.2 现有文件修改

| 文件 | 修改内容 |
|------|---------|
| `src/dashboard/public/app.js` | 引入 `gacha-reveal.js`，替换 `showToast()` 调用为 `GachaQueue.enqueue()` |
| `src/dashboard/public/styles.css` | 追加所有动画 CSS（~450 行） |
| `src/dashboard/server.ts` | sound API 添加 `simple_animations` 配置项 |
| `src/config.ts` / `src/engine/types.ts` | 新增配置字段 `simple_animations: boolean` |

### 1.3 核心类

```
GachaQueue (单例)
  queue: Achievement[]          // 新解锁队列，按稀有度降序
  isPlaying: boolean
  enqueue(achievements)         // 加入队列，若空闲则立即 playNext()
  playNext()                    // 取第一个，创建 GachaReveal 实例
  skipAll()                     // Esc → 清空队列，直接 renderAll()
  
GachaReveal (单次动画实例)
  achievement                   // 要展示的成就
  rarity                       // 决定动画参数
  element: HTMLElement          // 渲染到 body 的 DOM 节点
  resolve: Promise<void>        // 动画完成后 resolve
  canvas: HTMLCanvasElement|null // Epic+ 才有
  start()                       // 开始动画
  skip()                        // 用户点击 → 跳到 modal
  destroy()                     // 清理 DOM/Canvas
```

### 1.4 调用链变更

**当前**:
```
poll() → freshIds → showToast(icon, name, rarity) for each → renderAll()
```

**新**:
```
poll() → freshIds → GachaQueue.enqueue(freshIds)
  → GachaQueue.playNext() → GachaReveal.start()
    → 动画结束 → 自增往下一个
  → 全部播完 → renderAll()
```

---

## 2. 稀有度动画参数矩阵

| 稀有度 | 入场 | 核心动画 | 粒子 | 音效时机 | 总时长 |
|--------|------|----------|------|----------|--------|
| Common | 缩放 0→1 (0.2s) | 无 flip | 无 | 完成时 | 0.6s |
| Uncommon | 缩放 0→1 (0.3s) | 背景辉光脉冲 | 无 | 完成时 | 1.0s |
| Rare | 3D 翻转 0→180° (0.5s) | 金色粒子边框旋转 | 12 星形粒子 | 翻转瞬间 | 1.5s |
| Epic | 3D 翻转 + 光柱 (0.6s) | 屏幕边缘辉光 | 30 火焰粒子喷射 | 翻转瞬间 | 2.0s |
| Legendary | 3D 翻转 + 冲击波 (0.8s) | 屏幕颤动 + 色散 | 60 星尘 + 拖尾 | 翻转瞬间 | 3.0s |
| Mythic | 全屏闪烁 → 从天而降 (1s) | 落地冲击波 + 碎裂 | 100+ 红金爆发 | 翻转瞬间 | 4.0s |

### 2.1 动画触发门槛

- **Common / Uncommon**: 增强 Toast（scale-up + 色光），无翻牌无粒子
- **Rare+**: 全屏 overlay 卡片翻转动画
- **"简化动画"开启**: 所有稀有度统一简化为淡入 fade-in（无 flip 无粒子）

### 2.2 多成就排队

- 新成就按**稀有度降序**排列（Mythic → Legendary → Epic → Rare → Uncommon → Common）
- 同一稀有度内按解锁时间升序（先解锁的先播）
- 逐一播放，全部播完才 renderAll() 更新网格
- 中途 Esc → `skipAll()` 清空剩余队列 + 立即 renderAll()

---

## 3. 卡片结构 (DOM)

```html
<div class="gacha-overlay">
  <!-- 半透明遮罩，点击跳过 -->
  <div class="gacha-card" data-rarity="rare">
    <!-- 卡背 (default front) -->
    <div class="gacha-card-face back">
      <div class="gacha-icon-question">❓</div>
    </div>
    <!-- 卡面 (flipped to) -->
    <div class="gacha-card-face front">
      <div class="gacha-icon">🏆</div>
      <div class="gacha-name">Test Champion</div>
      <div class="gacha-desc">500 tests passed</div>
      <div class="gacha-rarity-badge">Rare</div>
    </div>
  </div>
  <!-- Canvas 粒子层 (Epic+ 时有) -->
  <canvas class="gacha-particles" data-rarity="rare"></canvas>
</div>
```

### 3.1 CSS 3D 翻转

```css
.gacha-card {
  perspective: 800px;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(.4, 0, .2, 1);
}
.gacha-card.flip {
  transform: rotateY(180deg);
}
.gacha-card-face {
  backface-visibility: hidden;
  position: absolute;
  inset: 0;
}
.gacha-card-face.front {
  transform: rotateY(180deg);
}
```

### 3.2 粒子系统 (Canvas)

仅 Epic+ 激活。粒子引擎逻辑在 `gacha-reveal.js` 内内联实现（不引入第三方库）：

```js
class ParticleSystem {
  constructor(canvas, rarity) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.count = RARITY_CONFIG[rarity].particleCount; // 0/0/12/30/60/100+
  }
  update() { /* 更新位置、透明度、大小 */ }
  render() { /* 绘制粒子 */ }
  emitBurst() { /* 爆发模式 — legend/mythic */ }
}
```

粒子参数：
- 颜色：取当前稀有度 CSS 色值
- 寿命：2-3 秒渐隐
- 速度：随机向量，向外扩散
- 大小：2-8px 随机
- 拖尾：仅 Legendary/Mythic

---

## 4. 交互行为

| 操作 | 效果 |
|------|------|
| 点击动画任意位置 | 跳过当前动画 → 直接打开该成就详情 modal |
| Esc | 跳过所有排队动画 → renderAll() 更新网格 |
| 设置"简化动画"打开 | 所有稀有度统一淡入（0.3s），无视粒子/翻转 |
| 设置"关闭音效" | 动画正常播放但不发声（已有 sound toggle 复用） |

### 4.1 与现有系统兼容

- `GachaQueue.enqueue(freshIds)` 由现有 poll 循环触发（替换 `showToast`）
- 动画播放期间，10s 自动轮询**继续运行**，但新解锁的成就 `enqueue()` 追加到队列末尾（不会插队）
- 若用户切换 tab/导航，`skipAll()` 触发，立即回到正常状态
- Dashboard header 的统计数字在动画期间不更新，`renderAll()` 时一起刷新

---

## 5. 实现计划

### 5.1 文件清单

| 文件 | 操作 | 行数估算 |
|------|------|---------|
| `src/dashboard/public/gacha-reveal.js` | 新建 | ~350 行 |
| `src/dashboard/public/styles.css` | 追加 | ~450 行 |
| `src/dashboard/public/app.js` | 修改 | ~50 行（引入 + 替换 showToast 调用） |
| `src/dashboard/server.ts` | 修改 | ~10 行（新增 simple_animations API） |
| `src/config.ts` | 修改 | ~5 行 |
| `src/engine/types.ts` | 修改 | ~3 行（Config 接口新增字段） |

### 5.2 实现步骤

1. **CSS 动画关键帧** — 编写所有 @keyframes（card flip、particle sweep、impact wave 等），覆盖 6 级稀有度
2. **gacha-reveal.js** — GachaQueue + GachaReveal + ParticleSystem 类
3. **app.js 集成** — 替换 showToast 为 GachaQueue.enqueue，调整 poll 回调逻辑
4. **Config + API** — simple_animations 配置字段 + Dashboard 设置 UI 开关
5. **测试** — 手动测试 6 级稀有度动画 + 多成就排队 + 跳过 + Esc + 简化模式

---

## 6. 性能备忘

- Canvas 只在 Epic+ 非简化模式下创建，低稀有度无 Canvas 开销
- 动画使用 `requestAnimationFrame` 驱动，不用 setInterval
- `will-change: transform` 对正在动画的元素启用
- 粒子数量控制在 120 以内（Mythic 最多）
- 动画结束后 `destroy()` 清理所有 DOM/Canvas 引用
- 低功耗设备（navigator.hardwareConcurrency < 4）自动降低粒子密度 50%

## 7. 未解决的问题（Future）

- 音效与动画的精确同步（当前方案：音效在翻转瞬间用 `setTimeout` 触发，可能有 ~50ms 偏差）
- Legendary/Mythic 成就解锁后的"第二屏"——成就详情自动弹出（无需用户点击）
- 系列动画的"连击"效果（多稀有度连续揭示时累积能量条）
