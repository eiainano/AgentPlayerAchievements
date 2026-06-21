# Agent Player Achievements (AGPA) 🏆

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="pixel-art-output/agpa-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="pixel-art-output/agpa-logo-light.png">
    <img alt="AGPA Logo" src="pixel-art-output/agpa-logo-dark.png" width="192">
  </picture>
</p>

<p align="center">
  <a href="./README.md">EN</a>&nbsp;|&nbsp;<a href="./README.zh-CN.md">中文</a>&nbsp;|&nbsp;<a href="./README.es.md">ES</a>&nbsp;|&nbsp;<strong>한국어</strong>&nbsp;|&nbsp;<a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  AI 코딩 에이전트를 위한 게임화된 업적 시스템.<br>
  <em>XP를 획득하고, 트로피를 해제하고, 레벨업하세요 — 평소에 하던 일을 하면서 말이죠.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/업적-217-blueviolet" alt="217 업적"></a>
  <a href="#"><img src="https://img.shields.io/badge/테스트-1204-green" alt="1204 테스트"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml"><img src="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" alt="Node >= 18"></a>
  <a href="#"><img src="https://img.shields.io/badge/CLI-27_명령어-orange" alt="27 CLI 명령어"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements"><img src="https://img.shields.io/github/stars/eiainano/AgentPlayerAchievements?style=flat&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/commits/dev"><img src="https://img.shields.io/github/last-commit/eiainano/AgentPlayerAchievements/dev" alt="마지막 커밋"></a>
  <a href="README.ko.md"><img src="https://img.shields.io/badge/i18n-5개_언어-blue" alt="i18n: 5개 언어"></a>
</p>

<p align="center">
  <b>Claude Code</b>&nbsp;·&nbsp;<b>Kilo Code</b>&nbsp;·&nbsp;<b>OpenCode</b>&nbsp;·&nbsp;<b>Hermes</b>&nbsp;·&nbsp;<b>OpenClaw</b>
</p>

<p align="center">
  <a href="#빠른-시작">빠른 시작</a> ·
  <a href="#작동-방식">작동 방식</a> ·
  <a href="#기능">기능</a> ·
  <a href="#지원-도구">지원 도구</a> ·
  <a href="#cli-명령어">CLI 명령어</a> ·
  <a href="#커뮤니티-팩">커뮤니티 팩</a> ·
  <a href="#대시보드">대시보드</a> ·
  <a href="#문서">문서</a> ·
  <a href="#보안-및-개인정보">보안 및 개인정보</a> ·
  <a href="#자주-묻는-질문">FAQ</a>
</p>

---

### AGPA 없이 ❌

- 세션 간 코딩 습관에 대한 **가시성 없음**
- **진행 상황 추적 불가** — 더 빨라지고 있나? 더 많은 도구를 사용하고 있나? 알 수 없음
- 에이전트의 전체 기능을 탐색할 **동기 부족**
- **매일 같은 루틴** — 놀라움도, 이정표도 없음

### AGPA와 함께 ✅

- **자동 추적** — 모든 도구 호출, 파일 편집, Git 커밋이 자동으로 기록됨
- **Steam 스타일 대시보드** — XP 바, 레벨, 연속 기록, 히트맵, 업적 쇼케이스
- **217개 업적**, 11개 카테고리 — "Hello World"부터 "컴플리셔니스트"까지
- **즉각적인 피드백** — 터미널 팝업, macOS 알림, 8비트 사운드

---

## 빠른 시작

```bash
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

이게 전부입니다. 계속 에이전트를 사용하세요 — 업적은 작업하는 동안 자동으로 해제됩니다.

> [!TIP]
> 실제 업적 해제를 기다리지 않고 대시보드를 보고 싶으신가요? `agpa demo`를 실행하여 샘플 데이터를 즉시 생성하세요.

```bash
agpa dashboard   # 업적 대시보드 열기
agpa stats       # 진행 상황 확인
```

## 작동 방식

```
코딩 세션
  │
  ├─ 코드를 작성하고, 에이전트가 응답 — 모든 동작이 추적됨
  │   └─ 이중 채널: MCP 도구 + Hook 이벤트
  │
  ├─ 세션 종료 → 엔진이 217개 업적 평가
  │   └─ 해제됨? → macOS 알림 🎉
  │
  └─ agpa dashboard → 보기, 정렬, 필터, 공유
```

**두 개의 데이터 채널 → 하나의 엔진 → 하나의 대시보드:**

| 채널 | 방식 | 캡처 내용 |
|---------|--------|----------|
| **Hook CLI** | 도구 후크 (stdin을 통한 서브프로세스) | file.read/write/edit, tool.complete, git.commit, session.start/end, task.complete, agent.spawn |
| **MCP 서버** | STDIO 프로토콜 (7개 도구) | image.read, file.language_used, plan.mode_entered, user.message, automode.start |

두 채널 모두 동일한 `~/.agent-achievements/` 이벤트 로그에 기록합니다. 엔진은 12가지 조건 유형으로 217개 업적을 평가합니다.

> [!NOTE]
> **오버헤드 제로.** Hook CLI는 밀리초 미만의 서브프로세스입니다. MCP 서버는 네트워크 호출 없이 STDIO에서 실행됩니다. 모든 데이터는 사용자의 컴퓨터에 저장됩니다.

## 기능

- 🎮 **업적 대시보드** — XP 바, 레벨, 연속 기록, 활동 히트맵, 희귀도 분석, 쇼케이스
- 🏆 **217개 업적**, 11개 카테고리 (온보딩, 도구 숙련, 마일스톤, 스킬, 스타일, 워크플로우, 크리에이터, 히든, 챌린지, 커뮤니티, 인내)
- 🔥 **GitHub 스타일 히트맵** — 4개월간의 코딩 활동을 한눈에
- 📸 **공유 카드** — 다크/라이트 테마, 이중언어 (EN/ZH), PNG 다운로드
- 🔊 **8비트 사운드 효과** — 해제 시 희귀도별 레트로 사운드
- 🔔 **macOS 알림** — 클릭하여 대시보드로 이동
- 📊 **XP 및 레벨 시스템** — 사용량 기반 XP와 레벨 래더
- 📂 **다중 프로필** — 최대 4개 프로필, 언제든지 전환 가능
- 🌓 **다크 & 라이트 테마** — 시스템 설정 자동 감지
- 🖥️ **터미널 ANSI 팝업** — 터미널에서 업적 해제 배너 표시

## 지원 도구

<p align="center">
  <a href="#claude-code"><img src="https://img.shields.io/badge/Claude_Code-auto_+_MCP-blueviolet?logo=claude" alt="Claude Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/Kilo_Code-auto_+_MCP-00b4d8" alt="Kilo Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/OpenCode-auto_+_MCP-2ec4b6" alt="OpenCode"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/Cursor-MCP_only-007acc?logo=cursor" alt="Cursor"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/VS_Code-MCP_only-007acc?logo=visualstudiocode" alt="VS Code"></a>
  <a href="#hermes"><img src="https://img.shields.io/badge/Hermes-MCP_only-ff6b6b" alt="Hermes"></a>
  <a href="#openclaw"><img src="https://img.shields.io/badge/OpenClaw-auto_+_MCP-ffd166" alt="OpenClaw"></a>
</p>

| 도구 | 자동 추적 | MCP 추적 | 가장 쉬운 설정 |
|------|:----------:|:---------:|---------------|
| Claude Code | ✅ | ✅ | `agpa init` 자동 감지 |
| Kilo Code | ✅ | ✅ | TS 플러그인 + MCP 설정 |
| OpenCode | ✅ | ✅ | TS 플러그인 + MCP 설정 |
| Hermes | — | ✅ | MCP JSON 설정 |
| OpenClaw | ✅ | ✅ | 플러그인 + MCP 설정 |

Hermes(Hook API 없음)를 제외한 모든 도구에서 완전한 이중 채널 커버리지를 제공합니다. MCP 호환 클라이언트(Cursor, VS Code, Windsurf 등)의 경우 MCP 전용 추적이 즉시 작동합니다 — Hook 기반 자동 추적만 빠집니다.

> [!TIP]
> **MCP가 처음이신가요?** `agpa init`으로 시작하세요 — 설치된 도구를 자동으로 감지하고 모든 것을 구성합니다. 아래 수동 JSON 설정은 대체 방법입니다.

<details>
<summary><b>Claude Code</b> — 자동 추적 + MCP (전체 커버리지)</summary>

`agpa init`이 Claude Code를 자동 감지하고 두 채널을 등록합니다. 수동 설정:

**MCP 설정** (`~/.claude/.mcp.json` 또는 프로젝트 루트 `.mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```

**Hook 등록** — `agpa init`이 Claude Code 설정에 Hook 항목을 추가합니다. `agpa verify`로 확인하세요.
</details>

<details>
<summary><b>Cursor / VS Code</b> — MCP 전용</summary>

이 편집기들은 MCP를 지원하지만 자동 추적을 위한 Hook API를 노출하지 않습니다. MCP를 통해 도구 호출 추적이 가능합니다.

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>Kilo Code / OpenCode</b> — 자동 추적 + MCP (전체 커버리지)</summary>

이 도구들은 Hook 레벨 자동 추적을 위한 TS 플러그인을 지원합니다. `agpa init`이 플러그인 + MCP 설정을 등록합니다.

**수동 MCP 설정** (`opencode.json` 또는 Kilo Code 설정):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```

`agpa init`으로 등록된 TS 플러그인이 PostToolUse, SessionStart, SessionEnd 및 기타 Hook 이벤트를 자동으로 처리합니다.
</details>

<details>
<summary><b>Hermes</b> — MCP 전용</summary>

Hermes는 Hook API를 노출하지 않습니다. MCP 기반 추적으로 도구 호출과 세션 이벤트를 커버합니다.

**MCP 설정** (`~/.hermes/mcp.json`):
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>OpenClaw</b> — 자동 추적 + MCP (전체 커버리지)</summary>

OpenClaw는 Hook 레벨 추적을 위한 플러그인 시스템을 지원합니다. `agpa init`이 플러그인과 MCP 설정을 모두 등록합니다.

**수동 MCP 설정**:
```json
{
  "mcpServers": {
    "agpa": {
      "command": "npx",
      "args": ["tsx", "path/to/AgentPlayerAchievements/src/main.ts"]
    }
  }
}
```
</details>

## CLI 명령어

| 명령어 | 설명 |
|---------|-------------|
| `agpa init` | 에이전트 도구 자동 감지 및 등록 |
| `agpa uninstall` | 설정된 모든 도구에서 AGPA 깔끔하게 제거 |
| `agpa verify` | 설치 정확성 확인 |
| `agpa doctor` | 시스템 상태 진단 |
| `agpa dashboard` | 업적 대시보드 시작 (localhost:3867) |
| `agpa stats` | 업적 진행 상황 요약 표시 |
| `agpa progress` | 모든 업적과 해제 상태 나열 |
| `agpa profile` | 업적 프로필 관리 (생성, 목록, 전환) |
| `agpa demo` | 테스트용 MVP 데모 데이터 생성 |
| `agpa reset` | 모든 추적 데이터 초기화 |
| `agpa config` | 설정 보기/수정 (언어, 사운드, 디버그...) |
| `agpa showcase` | 쇼케이스 관리 (목록, 고정, 해제, 자동 채우기) |
| `agpa search` | 키워드/희귀도/카테고리로 업적 검색 |
| `agpa suggest` | 다음에 도전할 업적 제안 |
| `agpa sound` | 8비트 희귀도별 사운드 효과 테스트 |
| `agpa activity` | 연속 기록 + 4개월 활동 히트맵 보기 |
| `agpa export` | 업적 데이터를 JSON으로 내보내기 |
| `agpa import` | 백업에서 가져오기 |
| `agpa mcp` | MCP 서버 시작 (stdio 모드) |
| `agpa web` | `agpa dashboard`의 별칭 |
| `agpa pack` | 설치된 커뮤니티 업적 팩 목록 또는 정보 보기 |
| `agpa banner` | CLI 배너 색상 테마 전환 (Neon/Arcade/Gold) |
| `agpa history` | 이벤트 로그 항목 탐색 |
| `agpa explain` | 업적 잠금/해제 이유 표시 (조건 분석) |
| `agpa watch` | 실시간 업적 진행 모니터 |
| `agpa upgrade` | 업데이트 확인 및 AGPA 업그레이드 |
| `agpa completion` | 셸 완료 스크립트 생성 (bash/zsh/fish) |

> 전체 CLI 참조: `agpa --help`

## 커뮤니티 팩

누구나 업적 팩을 만들고 공유할 수 있습니다. YAML 파일을 `~/.agent-achievements/packs/`에 넣으면 설치됩니다:

```bash
agpa pack list              # 설치된 팩 목록 보기
agpa pack info <id>         # 팩 상세 정보 보기
```

팩 형식, 이벤트 카탈로그 및 12가지 조건 유형은 [업적 팩 생성 가이드](docs/creating-achievements.md)를 참조하세요.

## 업적 카테고리

| # | 카테고리 | 개수 | 하이라이트 |
|---|----------|:-----:|-----------|
| 1 | 온보딩 | 14 | Hello World, 첫 도구 호출, 첫 PR |
| 2 | 도구 숙련 | 38 | Read/Edit/Bash 스킬 임계값 |
| 3 | 마일스톤 | 19 | 작업 수, 연속 기록, 토큰 사용량 |
| 4 | 스킬 | 16 | 연쇄 반응, 디버거, 원샷 |
| 5 | 스타일 | 17 | 미니멀리스트, 나이트 아울, 복붙의 왕 |
| 6 | 워크플로우 | 29 | PR, CI/CD, 코드 리뷰, 머지 충돌 |
| 7 | 크리에이터 | 9 | 슬래시 명령어, 스킬, 에이전트, 후크 |
| 8 | 히든 | 47 | 이스터에그와 깜짝 해제 |
| 9 | 챌린지 | 13 | 스피드런, 멀티 모델, 무편집 연속 기록 |
| 10 | 커뮤니티 | 9 | 컴플리셔니스트 티어, 크로스 도구 컬렉터 |
| 11 | 인내 | 1 | 마라톤 세션, 긴 연속 기록 |

## 대시보드

<p align="center">
  <em>통계 행 → 연속 기록 + 히트맵 → 쇼케이스 → 검색/필터가 있는 업적 그리드</em>
</p>

```bash
agpa dashboard           # 기본 포트 :3867
agpa dashboard 8080      # 사용자 지정 포트
agpa dashboard --profile work   # 특정 프로필로 시작
```

- **통계**: XP, 레벨, 총 업적, 연속 기록, 작업, 도구 사용
- **히트맵**: GitHub 스타일 4개월 활동 그리드
- **쇼케이스**: 고정된 즐겨찾기 업적 (최대 6개)
- **업적 그리드**: 검색, 희귀도/카테고리별 정렬, 해제됨/잠김 필터
- **사운드 토글**: 8비트 희귀도별 효과
- **공유 버튼**: 아름다운 이중언어 카드 생성 → PNG 다운로드

## 아키텍처

```
                    ┌─────────────────────────┐
                    │   엔진 (src/engine/)     │
                    │   track() / poll()      │
                    └─────────────────────────┘
                      ↗                    ↖
            MCP 서버               Hook CLI
          (src/main.ts)        (src/cli/hook.ts)
                │                        │
          STDIO 장기 연결       단기 서브프로세스
                │                  (stdin pipe)
                │                        │
          에이전트가 의식적으로    후크가 자동으로
          호출                     실행됨
                │                        │
          ┌─────┴─────┐          ┌──────┴──────┐
          │ 수동 추적  │          │ 자동 추적   │
          │ image.read │          │ tool.complete│
          │ lang_used  │          │ file.edit   │
          │ plan.mode  │          │ session.*   │
          │ ...        │          │ agent.spawn │
          └───────────┘          └─────────────┘
                    ╲            ╱
                event.log  ← 두 채널 모두 여기에 기록
                          │
                     engine.poll()
                          │
                     state.json
                          │
                      대시보드
```

## 프로젝트 구조

```
src/
├── main.ts                  # MCP 서버 진입점 (STDIO)
├── tool-registry.ts         # 중앙 도구 등록
├── cli/
│   ├── index.ts             # 통합 CLI 진입점 (27개 명령어)
│   ├── hook.ts              # Hook CLI (track + poll + auto 모드)
│   ├── init.ts              # 대화형 설치 마법사
│   ├── dashboard.ts         # 대시보드 런처
│   ├── doctor.ts            # 시스템 진단
│   │   └── ...                  # 22개 CLI 명령어
├── engine/
│   ├── engine.ts            # 코어 엔진 (track / poll / stats)
│   ├── evaluator.ts         # 12가지 조건 유형 평가기
│   ├── store.ts             # JSONL 이벤트 로그 + 상태 지속성
│   ├── types.ts             # TypeScript 인터페이스
│   └── yaml-parser.ts       # YAML 업적 정의 파서
├── dashboard/
│   ├── server.ts            # HTTP 서버 + API 라우트
│   ├── api.ts               # 카드 데이터, 통계 집계
│   ├── public/              # 제로 프레임워크 HTML/CSS/JS 프론트엔드
│   └── customize-api.ts     # 자체 커스터마이즈 엔드포인트
├── tools/                   # MCP 도구 정의 (7개 도구)
├── utils/                   # 알림, 검증, 프로필, 픽셀아트, 배터리 등
├── verify/
│   └── auditor.ts           # 업적 검증 로직
├── config.ts                # 전역 설정
└── helpers.ts               # 공유 유틸리티

pixel-art-output/            # 로고 (README)
achievement-definitions.yaml   # 217개 업적 정의 (권위적 소스)
scripts/                     # 개발 도구 (로고 생성, 픽셀 아트 생성, 사운드)
```

## 개발

```bash
npm install          # 의존성 설치 (5개 런타임 의존성)
npm run build        # tsc --noEmit
npm test             # 1204개 테스트, 46개 파일
npm run dashboard    # 개발 대시보드 시작
npm run demo         # MVP 데이터 생성
```

## 의존성

- **런타임** (5): `@modelcontextprotocol/sdk` · `yaml` · `zod` · `figlet` · 
- **개발**: `typescript` · `vitest` · `tsx`
- **선택 사항** (macOS): `terminal-notifier` — 해제 시 시스템 알림

> [!NOTE]
> **의도적으로 최소한으로.** 5개의 런타임 의존성, 런타임 시 네트워크 호출 없음. 엔진은 JSONL 저장소를 사용하는 순수 함수 — 감사하기 쉽고, 망가질 수 없습니다.

## 📚 문서

| 문서 | 설명 |
|----------|-------------|
| [멀티 도구 설정](docs/multi-tool-setup.md) | 5개 지원 에이전트 도구에서 AGPA 구성하기 |
| [업적 디자인](docs/design/01-成就分类体系.md) | 업적 분류 체계, 명명 규칙 및 YAML 필드 참조 |
| [엔진 아키텍처](docs/design/05-核心引擎设计.md) | 이벤트 흐름 → 조건 평가 → 상태 지속성 |
| [이벤트 캡처 디자인](docs/design/08-EventCapture落地设计.md) | 이중 채널 캡처: Hook CLI + MCP 서버 |
| [Steam 리서치](docs/design/12-Steam游戏成就设计调研.md) | 인기 Steam 게임 21개의 업적 시스템 조사 |
| [이슈 및 TODO](docs/issues-todo.md) | 알려진 버그, 격차 및 P0–P3 우선순위 |
| [변경 로그](CHANGELOG.md) | 버전 기록 및 릴리스 노트 |

## 🔒 보안 및 개인정보

- **로컬 우선** — 모든 이벤트 데이터는 `~/.agent-achievements/`에 저장됩니다. 원격 측정 없음, 클라우드 동기화 없음, 런타임 시 네트워크 호출 없음.
- **감사 가능** — 엔진은 JSONL 파일에서 작동하는 순수 TypeScript 함수입니다. 난독화 없음, 바이너리 없음.
- **최소 의존성** — 5개의 런타임 의존성 (`@modelcontextprotocol/sdk`, `yaml`, `zod`, `figlet`) — 모두 광범위하게 감사됨.
- **STDIO 격리** — MCP 서버는 표준 I/O만으로 통신합니다. HTTP 엔드포인트가 노출되지 않습니다.
- **Hook 샌드박스** — Hook CLI는 밀리초 미만의 서브프로세스로 실행되며 상태를 유지하거나 네트워크에 접근할 수 없습니다.
- **공급망** — 네이티브 모듈 없음, postinstall 스크립트 없음, 설치 시 바이너리 다운로드 없음.

## 🌐 환경 변수

| 변수 | 설명 | 기본값 | 값 |
|----------|-------------|---------|--------|
| `AGPA_PROFILE` | 활성 프로필 이름 | `default` | 임의의 문자열 |
| `AGPA_LANG` | 인터페이스 언어 | `en` | `en`, `zh` |
| `AGPA_ENABLED_CATEGORIES` | 활성화할 업적 카테고리 필터 | 전체 | 쉼표로 구분 (예: `onboarding,tool_mastery`) |
| `AGPA_DEBUG` | 자세한 디버그 로깅 활성화 | `false` | `true` |
| `AGPA_SOUND` | 사운드 효과 재정의 | 설정 값 | `on`, `off`, `true`, `false` |
| `AGPA_SIMPLE_ANIMATIONS` | 단순화된 터미널 애니메이션 사용 | `false` | `true` |
| `AGPA_BANNER_THEME` | CLI 시작 배너 스타일 | `Arcade` | `Neon`, `Arcade`, `Gold` |
| `AGPA_TELEMETRY` | 익명 사용 원격 측정 활성화 | `false` | `true`, `false` |
| `AGPA_TELEMETRY_SERVER` | 사용자 지정 원격 측정 엔드포인트 URL | `''` (없음) | URL 문자열 |
| `AGPA_TOOL_SOURCE` | 도구 소스 식별자 재정의 | 자동 감지 | `claude-code`, `hermes`, `openclaw` 등 |
| `AGPA_MODEL` | 현재 AI 모델 이름 (업적용) | `auto` | 임의의 모델 문자열 |

> [!TIP]
> 환경 변수는 `config.json` 설정을 재정의합니다. 영구적인 재정의를 위해 셸 프로필이나 에이전트 설정에서 지정하세요.

## 자주 묻는 질문

**Q: 에이전트가 느려지나요?**
A: 아니요. Hook CLI는 밀리초 미만의 서브프로세스입니다. MCP 서버는 네트워크 오버헤드 없이 STDIO에서 실행됩니다.

**Q: 여러 에이전트에서 사용할 수 있나요?**
A: 네. 설치 마법사가 Claude Code, Kilo Code, OpenCode, Hermes, OpenClaw를 자동 감지합니다. 각각 독립적인 프로필을 가질 수 있습니다.

**Q: 업적이 해제되지 않아요?**
A: `agpa doctor`를 실행하세요 — 추적 상태, Hook 등록 및 이벤트 커버리지를 진단합니다.

**Q: WakaTime이나 다른 코딩 활동 추적기와 어떻게 다른가요?**
A: WakaTime은 *무엇을* 했는지 알려줍니다 — 시간, 언어, 프로젝트. AGPA는 그것을 *재미있게* 만듭니다 — XP, 레벨, 업적, 연속 기록, Steam 스타일의 도파민 히트. 기존 워크플로우 위에 게임화를 더한 것이지, 확인해야 할 또 다른 대시보드가 아닙니다. 피트니스 트래커의 걸음 수와 Pokémon Go 배지의 차이를 생각해 보세요 — 같은 데이터, 다른 경험.

**Q: 업적 이름을 커스터마이즈할 수 있나요?**
A: 네. 대시보드의 `/customize` 페이지에서 모든 업적의 이름을 변경할 수 있습니다.

## 문제 해결

> [!IMPORTANT]
> **모든 문제의 첫 단계:** `agpa doctor`를 실행하세요 — 추적 상태, Hook 등록, 이벤트 커버리지 및 설정 문제를 한 번에 진단합니다.

| 증상 | 가능한 원인 | 해결 방법 |
|---------|-------------|-----|
| 업적이 해제되지 않음 | Hook/MCP가 등록되지 않음 | `agpa doctor`를 실행하여 Hook 등록 + 이벤트 커버리지 확인 |
| 대시보드가 시작되지 않음 | 포트 3867이 이미 사용 중 | `agpa dashboard 8080` (또는 사용 가능한 포트) |
| `agpa init` 실패 | 에이전트 도구가 감지되지 않음 | 지원 도구 목록 확인; 수동 MCP JSON 설정을 대안으로 사용 |
| macOS 알림 없음 | `terminal-notifier` 누락 | `brew install terminal-notifier` 실행, 또는 `agpa init`이 자동 설치 |
| 사운드가 재생되지 않음 | 브라우저 오디오 컨텍스트 차단됨 | 대시보드 페이지의 아무 곳이나 클릭하여 오디오 활성화 |
| 프로필 전환이 작동하지 않음 | 프로필이 존재하지 않음 | `agpa profile list`로 사용 가능한 프로필 확인 후 `agpa profile switch <name>` |
| 에이전트 로그에 Hook CLI 오류 | stdin pipe가 비어 있음 (첫 실행 시 정상) | 정상 — Hook은 단기 서브프로세스; 오류는 `~/.agent-achievements/error.log`에 기록됨 |

지속적인 문제는 `~/.agent-achievements/error.log`를 확인하거나 [Issue를 열어주세요](https://github.com/eiainano/AgentPlayerAchievements/issues).

## Star 히스토리

<img alt="Star History Chart" src="https://api.star-history.com/svg?repos=eiainao/AgentPlayerAchievements&type=Date" width="100%">

## 라이선스

MIT — [LICENSE](LICENSE) 참조

---

<p align="center">
  <sub>게임화를 사랑하는 개발자를 위해 만들어졌습니다. 217개의 업적, 계속 증가 중.</sub>
</p>
