# Sound Effects System Implementation Plan

> **For agentic workers:** Execute steps sequentially — tasks build on each other.

**Goal:** Add 8-bit achievement-unlock sound effects to AGPA, with CLI + Dashboard toggle.

**Architecture:** `playSound()` in notify.ts plays .wav via OS-native player before existing notification flow. Config lives in `config.json` as `sound_enabled` (default true). Rarity dedup: same poll round → only highest rarity plays.

---

### Task 1: Generate sound files script + assets

**Create:** `scripts/generate-sounds.ts`, `assets/sounds/`

(Task to be done inline)

### Task 2: Config layer — sound_enabled field

**Modify:** `src/config.ts`, `src/utils/validate.ts`

### Task 3: notify.ts — playSound() + rarity param

**Modify:** `src/utils/notify.ts`, `src/engine/types.ts` (RARITY_RANK)

### Task 4: CLI — agpa sound command

**Create:** `src/cli/sound.ts`, modify `src/cli/index.ts`

### Task 5: Wire poll.ts + hook.ts sendNotification calls

**Modify:** `src/tools/poll.ts`, `src/cli/hook.ts`

### Task 6: Dashboard API + UI toggle

**Modify:** `src/dashboard/server.ts`, `src/dashboard/public/app.js`, `src/dashboard/public/styles.css`

### Task 7: Init — copy sounds to stateDir

**Modify:** `src/cli/init.ts`

### Task 8: Test + verify

**Run:** `npm run build`, `npm run test`
