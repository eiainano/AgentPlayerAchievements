# AGPA Logo Pixel Art Design

> 2026-06-07 | Status: Approved | Final Version: 3.0

## Overview

AGPA (Agent Player Achievements) project logo — a 128×128 pixel art image combining three core identity elements: a PS4 DualShock 4 controller (gaming/achievement), the `>_` command prompt symbol (coding/terminal), and a think cloud (AI/agent thinking). Generated via Gemini 3.1 Flash Image.

## Final Composition

```
┌─────────────────────────────────┐  ← screen top (42%)
│  ██                             │
│  ██>_              ┌──────────┐ │
│  ██               (  think    )│ │
│  ██               │  cloud    │ │
│  ██               (  blue-white)│
│  ██                └──────────┘ │
│  ██                             │
└────────┬──────────────────┬─────┘  ← screen frame
         │                  │
         │   single cable   │        ← cable (7%)
         │                  │
     ┌───┴──────────────────┴───┐    ← controller top
     │  ┌──────┐  ┌─────────┐   │
     │  │ D-pad│  │ △ ○ □ ✕│   │    ← DS4 (51%)
     │  └──────┘  └─────────┘   │
     │     ●            ●       │    ← analog sticks
     │   ╲      PS     ╱        │
     │    ╲            ╱         │
     └─────╲──────────╱──────────┘    ← grips
```

**Layout hierarchy** (top-to-bottom):
1. **Screen** (y≈0–54 / ~42%) — thin-bezel display, background matches theme
2. **Cable** (y≈54–63 / ~7%) — single centered wire
3. **Controller** (y≈63–127 / ~51%) — DS4 top-down view, slightly larger than screen

### Key Design Decisions

| Aspect | Decision |
|--------|----------|
| Resolution | 128×128 |
| Aspect ratio | 1:1 square |
| Screen vs Controller | Screen ~42%, Controller ~51% (controller slightly dominates) |
| `>_` position | Left side, centered vertically-ish |
| `>_` size | ~24-28px tall, ~22-28px wide — BOLD |
| `>_` color | Green (#40c840) |
| Think cloud position | Right side, matching `>_` height |
| Think cloud size | ~32×28px, equal height to `>_` |
| Think cloud color | Blue-white (#c0d0e8) |
| Think cloud pointer | Tail at bottom-left pointing toward `>_` |
| Cable | Single straight line, centered, 2-3px wide |
| Controller view | Top-down (full DS4 detail) |
| D-pad | Cross shape, light grey |
| Face buttons | PS4 official colors: △ green, ○ red, ✕ blue, □ pink |
| Analog sticks | Two symmetric charcoal nubs with pale center dots |
| PS button | Small gold circle between D-pad and face buttons |

## Color Palette

### Dark Theme (navy #0a0e17 background)

| Color | Hex | Role |
|-------|-----|------|
| Dark navy | `#0a0e17` | Background + screen interior |
| Charcoal grey | `#2a2a38` | Controller body, stick bases, cable |
| Light grey | `#8a8a9a` | D-pad, touchpad, screen border |
| Muted white | `#b0b0c0` | Stick center dots, details |
| Blue-white | `#c0d0e8` | Think cloud |
| Green | `#40c840` | `>_` prompt + △ button |
| Red | `#c84040` | ○ button |
| Blue | `#4080c8` | ✕ button |
| Pink | `#d0a0c0` | □ button |
| Gold | `#e8c840` | PS button |

### Light Theme (white #ffffff background)

| Color | Hex | Role |
|-------|-----|------|
| White | `#ffffff` | Background + screen interior + controller body |
| Medium grey | `#707080` | D-pad, touchpad, screen border, cable |
| Light grey | `#c0c0d0` | Controller body shading/details |
| Near-black | `#202030` | Stick dots, outlines, details |
| Blue-white | `#c0d0e8` | Think cloud |
| Green | `#40c840` | `>_` prompt + △ button |
| Red | `#c84040` | ○ button |
| Blue | `#4080c8` | ✕ button |
| Pink | `#d0a0c0` | □ button |
| Gold | `#e8c840` | PS button |

Note: Light theme uses a white controller body on white background — subtle outlines separate them.

## Deliverables

- `pixel-art-output/agpa-logo-dark.png` — 1024×1024, dark navy background
- `pixel-art-output/agpa-logo-light.png` — 1024×1024, white background
- Generation script: `scripts/generate-logo.ts`

## Style Constraints

- True pixel art: visible square pixels, limited palette (10 colors)
- No anti-aliasing, no smooth curves, no gradients, no glow effects
- Sharp blocky edges — SNES/GBA era game sprite style
- Dark outlines around main subjects
- No text/labels beyond `>_`

## Metaphor

The `>_` (user prompting) and the think cloud (AI thinking) face each other inside a screen — the conversation between developer and AI. A cable connects the screen to a PS4 controller below: the achievement system you "play" while coding. The controller being slightly larger emphasizes gaming as the core experience.
