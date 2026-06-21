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
  <a href="#"><img src="https://img.shields.io/badge/테스트-1207-green" alt="1207 테스트"></a>
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
  <a href="#보안-및-개인정보">보안 및 개인정보</a> ·
  <a href="#기여하기">기여하기</a> ·
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

## 빠른 시작

**사전 요구사항:** Node.js ≥ 18

```bash
# 방법 A: 전역 설치 (일반 사용자 권장)
npm install -g @eiainano/agpa
agpa init

# 방법 B: 클론 및 링크 (기여자 권장)
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

이게 전부입니다. 계속 에이전트를 사용하세요 — 업적은 작업하는 동안 자동으로 해제됩니다.

> [!TIP]