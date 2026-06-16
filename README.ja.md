# Agent Player Achievements (AGPA) 🏆

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="pixel-art-output/agpa-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="pixel-art-output/agpa-logo-light.png">
    <img alt="AGPA Logo" src="pixel-art-output/agpa-logo-dark.png" width="192">
  </picture>
</p>

<p align="center">
  <a href="./README.md">EN</a>&nbsp;|&nbsp;<a href="./README.zh-CN.md">中文</a>&nbsp;|&nbsp;<a href="./README.es.md">ES</a>&nbsp;|&nbsp;<a href="./README.ko.md">한국어</a>&nbsp;|&nbsp;<strong>日本語</strong>
</p>

<p align="center">
  AIコーディングエージェントのためのゲーミフィケーション実績システム。<br>
  <em>XPを獲得し、トロフィーを解除し、レベルアップ — いつもの作業をしながら。</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/実績-213-blueviolet" alt="213 実績"></a>
  <a href="#"><img src="https://img.shields.io/badge/テスト-1176-green" alt="1176 テスト"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml"><img src="https://github.com/eiainano/AgentPlayerAchievements/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen" alt="Node >= 18"></a>
  <a href="#"><img src="https://img.shields.io/badge/CLI-24コマンド-orange" alt="24 CLIコマンド"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements"><img src="https://img.shields.io/github/stars/eiainano/AgentPlayerAchievements?style=flat&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/eiainano/AgentPlayerAchievements/commits/dev"><img src="https://img.shields.io/github/last-commit/eiainano/AgentPlayerAchievements/dev" alt="最終コミット"></a>
  <a href="README.ja.md"><img src="https://img.shields.io/badge/i18n-5言語-blue" alt="i18n: 5言語"></a>
</p>

<p align="center">
  <b>Claude Code</b>&nbsp;·&nbsp;<b>Kilo Code</b>&nbsp;·&nbsp;<b>OpenCode</b>&nbsp;·&nbsp;<b>Hermes</b>&nbsp;·&nbsp;<b>OpenClaw</b>
</p>

<p align="center">
  <a href="#クイックスタート">クイックスタート</a> ·
  <a href="#仕組み">仕組み</a> ·
  <a href="#機能">機能</a> ·
  <a href="#対応ツール">対応ツール</a> ·
  <a href="#cliコマンド">CLIコマンド</a> ·
  <a href="#ダッシュボード">ダッシュボード</a> ·
  <a href="#ドキュメント">ドキュメント</a> ·
  <a href="#セキュリティとプライバシー">セキュリティ</a> ·
  <a href="#よくある質問">FAQ</a>
</p>

---

### AGPAなし ❌

- セッションをまたいだコーディング習慣の**可視性なし**
- **進捗の追跡不可** — 速くなってる？ツールを増やしてる？知る術がない
- エージェントの全機能を探求する**モチベーションなし**
- **毎日同じルーティン** — 驚きもマイルストーンもない

### AGPAあり ✅

- **自動トラッキング** — すべてのツール呼び出し、ファイル編集、Gitコミットが自動記録
- **Steam風ダッシュボード** — XPバー、レベル、連続記録、ヒートマップ、実績ショーケース
- **213個の実績**、11カテゴリ — 「Hello World」から「コンプリート」まで
- **即時フィードバック** — ターミナルポップアップ、macOS通知、8ビットサウンド

---

## クイックスタート

```bash
git clone https://github.com/eiainano/AgentPlayerAchievements.git
cd AgentPlayerAchievements && npm install && npm link
agpa init
```

以上です。エージェントを使い続けてください — 作業中に実績が自動的に解除されます。

> [!TIP]
> 実際の解除を待たずにダッシュボードを見てみたい？`agpa demo`を実行すればサンプルデータが即座に生成されます。

```bash
agpa dashboard   # 実績ダッシュボードを開く
agpa stats       # 進捗を確認
```

## 仕組み

```
コーディングセッション
  │
  ├─ コードを書き、エージェントが応答 — すべてのアクションが追跡される
  │   └─ デュアルチャネル: MCPツール + Hookイベント
  │
  ├─ セッション終了 → エンジンが213個の実績を評価
  │   └─ 解除された？ → macOS通知 🎉
  │
  └─ agpa dashboard → 表示、並べ替え、フィルター、共有
```

**2つのデータチャネル → 1つのエンジン → 1つのダッシュボード:**

| チャネル | 方式 | キャプチャ内容 |
|---------|--------|----------|
| **Hook CLI** | ツールフック（stdin経由のサブプロセス） | file.read/write/edit, tool.complete, git.commit, session.start/end, task.complete, agent.spawn |
| **MCPサーバー** | STDIOプロトコル（5ツール） | image.read, file.language_used, plan.mode_entered, user.message, automode.start |

両方のチャネルが同じ `~/.agent-achievements/` イベントログに書き込みます。エンジンは12種類の条件タイプで213個の実績を評価します。

> [!NOTE]
> **オーバーヘッドゼロ。** Hook CLIは1ミリ秒未満のサブプロセスです。MCPサーバーはネットワーク呼び出しなしでSTDIO上で動作します。すべてのデータはあなたのマシン上に留まります。

## 機能

- 🎮 **実績ダッシュボード** — XPバー、レベル、連続記録、アクティビティヒートマップ、レア度内訳、ショーケース
- 🏆 **213個の実績**、11カテゴリ（オンボーディング、ツール熟練、マイルストーン、スキル、スタイル、ワークフロー、クリエイター、隠し、チャレンジ、コミュニティ、耐久）
- 🔥 **GitHub風ヒートマップ** — 4ヶ月分のコーディングアクティビティを一目で
- 📸 **共有カード** — ダーク/ライトテーマ、バイリンガル（EN/ZH）、PNGダウンロード可能
- 🔊 **8ビットサウンドエフェクト** — レア度別のレトロな解除音
- 🔔 **macOS通知** — クリックでダッシュボードにジャンプ
- 📊 **XP＆レベルシステム** — 使用量に応じたXPとレベルラダー
- 📂 **マルチプロファイル** — 最大4プロファイル、いつでも切り替え可能
- 🌓 **ダーク＆ライトテーマ** — システム設定を自動検出
- 🖥️ **ターミナルANSIポップアップ** — 実績解除バナーをターミナルに表示

## 対応ツール

<p align="center">
  <a href="#claude-code"><img src="https://img.shields.io/badge/Claude_Code-auto_+_MCP-blueviolet?logo=claude" alt="Claude Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/Kilo_Code-auto_+_MCP-00b4d8" alt="Kilo Code"></a>
  <a href="#kilo-code--opencode"><img src="https://img.shields.io/badge/OpenCode-auto_+_MCP-2ec4b6" alt="OpenCode"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/Cursor-MCPのみ-007acc?logo=cursor" alt="Cursor"></a>
  <a href="#cursor--vs-code"><img src="https://img.shields.io/badge/VS_Code-MCPのみ-007acc?logo=visualstudiocode" alt="VS Code"></a>
  <a href="#hermes"><img src="https://img.shields.io/badge/Hermes-MCPのみ-ff6b6b" alt="Hermes"></a>
  <a href="#openclaw"><img src="https://img.shields.io/badge/OpenClaw-auto_+_MCP-ffd166" alt="OpenClaw"></a>
</p>

| ツール | 自動トラック | MCPトラック | 最も簡単なセットアップ |
|------|:----------:|:---------:|---------------|
| Claude Code | ✅ | ✅ | `agpa init`が自動検出 |
| Kilo Code | ✅ | ✅ | TSプラグイン + MCP設定 |
| OpenCode | ✅ | ✅ | TSプラグイン + MCP設定 |
| Hermes | — | ✅ | MCP JSON設定 |
| OpenClaw | ✅ | ✅ | プラグイン + MCP設定 |

Hermes（Hook APIなし）を除く全ツールで完全なデュアルチャネルカバレッジを提供します。MCP互換クライアント（Cursor、VS Code、Windsurfなど）では、MCPのみのトラッキングがそのまま動作します — Hookベースの自動トラッキングだけが欠けます。

> [!TIP]
> **MCPは初めてですか？** `agpa init`から始めましょう — インストール済みのツールを自動検出し、すべてを設定します。以下の手動JSON設定は代替手段です。

<details>
<summary><b>Claude Code</b> — 自動トラック + MCP（完全カバレッジ）</summary>

`agpa init`がClaude Codeを自動検出し、両方のチャネルを登録します。手動セットアップ：

**MCP設定** (`~/.claude/.mcp.json` またはプロジェクトルートの `.mcp.json`):
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

**Hook登録** — `agpa init`がClaude Code設定にHookエントリを追加します。`agpa verify`で確認してください。
</details>

<details>
<summary><b>Cursor / VS Code</b> — MCPのみ</summary>

これらのエディタはMCPをサポートしていますが、自動トラッキング用のHook APIを公開していません。MCP経由でツール呼び出しの追跡が可能です。

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
<summary><b>Kilo Code / OpenCode</b> — 自動トラック + MCP（完全カバレッジ）</summary>

これらのツールはHookレベルの自動トラッキング用のTSプラグインをサポートしています。`agpa init`がプラグイン + MCP設定を登録します。

**手動MCP設定** (`opencode.json` または Kilo Code設定):
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

`agpa init`によって登録されたTSプラグインが、PostToolUse、SessionStart、SessionEnd、その他のHookイベントを自動的に処理します。
</details>

<details>
<summary><b>Hermes</b> — MCPのみ</summary>

HermesはHook APIを公開していません。MCPベースのトラッキングがツール呼び出しとセッションイベントをカバーします。

**MCP設定** (`~/.hermes/mcp.json`):
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
<summary><b>OpenClaw</b> — 自動トラック + MCP（完全カバレッジ）</summary>

OpenClawはHookレベルのトラッキング用のプラグインシステムをサポートしています。`agpa init`がプラグインとMCP設定の両方を登録します。

**手動MCP設定**:
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

## CLIコマンド

| コマンド | 説明 |
|---------|-------------|
| `agpa init` | エージェントツールを自動検出して登録 |
| `agpa uninstall` | 設定済みの全ツールからAGPAをクリーンに削除 |
| `agpa verify` | インストールの正しさを確認 |
| `agpa doctor` | システム状態を診断 |
| `agpa dashboard` | 実績ダッシュボードを起動（localhost:3867） |
| `agpa stats` | 実績進捗サマリーを表示 |
| `agpa progress` | 全実績を解除状態とともに一覧表示 |
| `agpa profile` | 実績プロファイルを管理（作成、一覧、切り替え） |
| `agpa demo` | テスト用のMVPデモデータを生成 |
| `agpa reset` | すべてのトラッキングデータをリセット |
| `agpa config` | 設定の表示/変更（言語、サウンド、デバッグ...） |
| `agpa showcase` | ショーケースを管理（一覧、固定、解除、自動入力） |
| `agpa search` | キーワード/レア度/カテゴリで実績を検索 |
| `agpa suggest` | 次に狙う実績を提案 |
| `agpa sound` | 8ビットレア度別サウンドエフェクトをテスト |
| `agpa activity` | 連続記録 + 4ヶ月のアクティビティヒートマップを表示 |
| `agpa export` | 実績データをJSONとしてエクスポート |
| `agpa import` | バックアップからインポート |
| `agpa mcp` | MCPサーバーを起動（stdioモード） |
| `agpa web` | `agpa dashboard`のエイリアス |

> 完全なCLIリファレンス: `agpa --help`

## 実績カテゴリ

| # | カテゴリ | 数 | ハイライト |
|---|----------|:-----:|-----------|
| 1 | オンボーディング | 14 | Hello World, 初めてのツール呼び出し, 初めてのPR |
| 2 | ツール熟練 | 38 | Read/Edit/Bashスキルしきい値 |
| 3 | マイルストーン | 19 | タスク数, 連続記録, トークン使用量 |
| 4 | スキル | 17 | 連鎖反応, デバッガー, ワンショット |
| 5 | スタイル | 17 | ミニマリスト, 夜型, コピペキング |
| 6 | ワークフロー | 29 | PR, CI/CD, コードレビュー, マージ競合 |
| 7 | クリエイター | 9 | スラッシュコマンド, スキル, エージェント, フック |
| 8 | 隠し | 47 | イースターエッグとサプライズ解除 |
| 9 | チャレンジ | 13 | スピードラン, マルチモデル, 無編集連続記録 |
| 10 | コミュニティ | 9 | コンプリートティア, クロスツールコレクター |
| 11 | 耐久 | 1 | マラソンセッション, 長期連続記録 |

## ダッシュボード

<p align="center">
  <em>統計行 → 連続記録 + ヒートマップ → ショーケース → 検索/フィルター付き実績グリッド</em>
</p>

```bash
agpa dashboard           # デフォルトポート :3867
agpa dashboard 8080      # カスタムポート
agpa dashboard --profile work   # 特定のプロファイルで起動
```

- **統計**: XP、レベル、総実績数、連続記録、タスク、ツール使用
- **ヒートマップ**: GitHub風4ヶ月アクティビティグリッド
- **ショーケース**: 固定されたお気に入り実績（最大6個）
- **実績グリッド**: 検索、レア度/カテゴリでソート、解除/ロックでフィルター
- **サウンドトグル**: 8ビットレア度別エフェクト
- **共有ボタン**: 美しいバイリンガルカードを生成 → PNGダウンロード

## アーキテクチャ

```
                    ┌─────────────────────────┐
                    │   エンジン (src/engine/)  │
                    │   track() / poll()      │
                    └─────────────────────────┘
                      ↗                    ↖
            MCPサーバー              Hook CLI
          (src/main.ts)        (src/cli/hook.ts)
                │                        │
          STDIO永続接続         短命サブプロセス
                │                  (stdin pipe)
                │                        │
          エージェントが        フックが自動的に
          意識的に呼び出す        発火
                │                        │
          ┌─────┴─────┐          ┌──────┴──────┐
          │ 手動トラック│          │ 自動トラック│
          │ image.read │          │ tool.complete│
          │ lang_used  │          │ file.edit   │
          │ plan.mode  │          │ session.*   │
          │ ...        │          │ agent.spawn │
          └───────────┘          └─────────────┘
                    ╲            ╱
                event.log  ← 両チャネルがここに書き込み
                          │
                     engine.poll()
                          │
                     state.json
                          │
                     ダッシュボード
```

## プロジェクト構造

```
src/
├── main.ts                  # MCPサーバーエントリ (STDIO)
├── cli/
│   ├── hook.ts              # Hook CLI (track + poll + auto モード)
│   ├── init.ts              # 対話型インストールウィザード
│   ├── dashboard.ts         # ダッシュボードランチャー
│   ├── doctor.ts            # システム診断
│   ├── mvp.ts               # デモデータ生成
│   └── ...                  # 13以上のCLIコマンド
├── engine/
│   ├── engine.ts            # コアエンジン (track / poll / stats)
│   ├── evaluator.ts         # 12種類の条件タイプ評価器
│   ├── store.ts             # JSONLイベントログ + 状態永続化
│   ├── types.ts             # TypeScriptインターフェース
│   └── yaml-parser.ts       # YAML実績定義パーサー
├── dashboard/
│   ├── server.ts            # HTTPサーバー + APIルート
│   ├── api.ts               # カードデータ、統計集計
│   ├── public/              # ゼロフレームワーク HTML/CSS/JS フロントエンド
│   └── customize-api.ts     # セルフカスタマイズエンドポイント
├── tools/                   # MCPツール定義 (5ツール)
├── utils/                   # 通知、検証、ログ、エラー、プロファイル
├── config.ts                # グローバル設定
└── helpers.ts               # 共有ユーティリティ

pixel-art-output/            # ロゴ + 実績ピクセルアート
achievement-definitions.yaml   # 213個の実績定義（信頼できるデータソース）
scripts/                     # 開発ツール（ロゴ生成、ピクセルアート生成、サウンド）
```

## 開発

```bash
npm install          # 依存関係をインストール (3つのランタイム依存)
npm run build        # tsc --noEmit
npm test             # 1176テスト, 45ファイル
npm run dashboard    # 開発ダッシュボードを起動
npm run demo         # MVPデータを生成
```

## 依存関係

- **ランタイム** (4): `@modelcontextprotocol/sdk` · `yaml` · `zod` · `figlet`
- **開発**: `typescript` · `vitest` · `tsx`
- **オプション** (macOS): `terminal-notifier` — 解除時のシステム通知

> [!NOTE]
> **意図的に最小限。** 4つのランタイム依存関係、ランタイム時のネットワーク呼び出しゼロ。エンジンはJSONLストレージを使用する純粋関数 — 監査が容易で、壊れようがありません。

## 📚 ドキュメント

| ドキュメント | 説明 |
|----------|-------------|
| [マルチツールセットアップ](docs/multi-tool-setup.md) | 5つの対応エージェントツールでのAGPA設定 |
| [実績デザイン](docs/design/01-成就分类体系.md) | 実績分類体系、命名規則、YAMLフィールドリファレンス |
| [エンジンアーキテクチャ](docs/design/05-核心引擎设计.md) | イベントフロー → 条件評価 → 状態永続化 |
| [イベントキャプチャ設計](docs/design/08-EventCapture落地设计.md) | デュアルチャネルキャプチャ: Hook CLI + MCPサーバー |
| [Steamリサーチ](docs/design/12-Steam游戏成就设计调研.md) | 人気Steamゲーム21本の実績システム調査 |
| [問題とTODO](docs/issues-todo.md) | 既知のバグ、ギャップ、P0–P3優先順位 |
| [変更ログ](CHANGELOG.md) | バージョン履歴とリリースノート |

## 🔒 セキュリティとプライバシー

- **ローカルファースト** — すべてのイベントデータは `~/.agent-achievements/` に保存。テレメトリなし、クラウド同期なし、ランタイム時のネットワーク呼び出しなし。
- **監査可能** — エンジンはJSONLファイルを操作する純粋なTypeScript関数。難読化なし、バイナリなし。
- **最小限の依存関係** — 4つのランタイム依存関係（`@modelcontextprotocol/sdk`、`yaml`、`zod`、`figlet`）— すべて広く監査済み。
- **STDIO分離** — MCPサーバーは標準I/Oのみで通信。HTTPエンドポイントは公開されません。
- **Hookサンドボックス** — Hook CLIは1ミリ秒未満のサブプロセスとして実行され、状態の永続化やネットワークアクセスはできません。
- **サプライチェーン** — ネイティブモジュールなし、postinstallスクリプトなし、インストール時のバイナリダウンロードなし。

## 🌐 環境変数

| 変数 | 説明 | デフォルト | 値 |
|----------|-------------|---------|--------|
| `AGPA_PROFILE` | アクティブなプロファイル名 | `default` | 任意の文字列 |
| `AGPA_LANG` | インターフェース言語 | `en` | `en`, `zh` |
| `AGPA_ENABLED_CATEGORIES` | アクティブな実績カテゴリをフィルター | すべて | カンマ区切り（例: `onboarding,tool_mastery`） |
| `AGPA_DEBUG` | 詳細なデバッグログを有効化 | `false` | `true` |
| `AGPA_SOUND` | サウンドエフェクトを上書き | 設定値 | `on`, `off`, `true`, `false` |
| `AGPA_SIMPLE_ANIMATIONS` | 簡略化されたターミナルアニメーションを使用 | `false` | `true` |
| `AGPA_BANNER_THEME` | CLI起動バナースタイル | `Arcade` | `Neon`, `Arcade`, `Gold` |
| `AGPA_TELEMETRY` | 匿名使用テレメトリを有効化 | `false` | `true`, `false` |
| `AGPA_TELEMETRY_SERVER` | カスタムテレメトリエンドポイントURL | `''` (なし) | URL文字列 |
| `AGPA_TOOL_SOURCE` | ツールソース識別子を上書き | 自動検出 | `claude-code`, `hermes`, `openclaw` など |
| `AGPA_MODEL` | 現在のAIモデル名（実績用） | `auto` | 任意のモデル文字列 |

> [!TIP]
> 環境変数は `config.json` の設定を上書きします。永続的な上書きにはシェルプロファイルまたはエージェント設定で指定してください。

## よくある質問

**Q: エージェントが遅くなりますか？**
A: いいえ。Hook CLIは1ミリ秒未満のサブプロセスです。MCPサーバーはネットワークオーバーヘッドなしでSTDIO上で動作します。

**Q: 複数のエージェントで使用できますか？**
A: はい。インストールウィザードがClaude Code、Kilo Code、OpenCode、Hermes、OpenClawを自動検出します。それぞれに独自のプロファイルを持たせることができます。

**Q: 実績が解除されません？**
A: `agpa doctor`を実行してください — トラッキング状態、Hook登録、イベントカバレッジを診断します。

**Q: WakaTimeや他のコーディングアクティビティトラッカーとはどう違いますか？**
A: WakaTimeは*何を*したかを教えます — 時間、言語、プロジェクト。AGPAはそれを*楽しく*します — XP、レベル、実績、連続記録、Steam風のドーパミンヒット。既存のワークフローに重ねたゲーミフィケーションであり、確認すべきもう一つのダッシュボードではありません。フィットネストラッカーの歩数カウントとPokémon Goのバッジの違いを想像してください — 同じデータ、異なる体験。

**Q: 実績名をカスタマイズできますか？**
A: はい。ダッシュボードの `/customize` ページで任意の実績名を変更できます。

## トラブルシューティング

> [!IMPORTANT]
> **あらゆる問題の最初のステップ:** `agpa doctor`を実行してください — トラッキング状態、Hook登録、イベントカバレッジ、設定の問題を一度に診断します。

| 症状 | 考えられる原因 | 修正方法 |
|---------|-------------|-----|
| 実績が解除されない | Hook/MCPが登録されていない | `agpa doctor`を実行してHook登録 + イベントカバレッジを確認 |
| ダッシュボードが起動しない | ポート3867が既に使用中 | `agpa dashboard 8080`（または任意の空きポート） |
| `agpa init`が失敗 | エージェントツールが検出されない | 対応ツールリストを確認; 代替として手動MCP JSON設定を使用 |
| macOS通知が来ない | `terminal-notifier`がない | `brew install terminal-notifier`を実行、または`agpa init`が自動インストール |
| サウンドが再生されない | ブラウザのオーディオコンテキストがブロックされている | ダッシュボードページの任意の場所をクリックしてオーディオを有効化 |
| プロファイル切り替えが機能しない | プロファイルが存在しない | `agpa profile list`で利用可能なプロファイルを確認し、`agpa profile switch <name>`を実行 |
| エージェントログにHook CLIエラー | stdin pipeが空（初回実行時は正常） | 正常 — Hookは短命サブプロセス; エラーは `~/.agent-achievements/error.log` に記録されます |

継続的な問題は `~/.agent-achievements/error.log` を確認するか、[Issueを作成](https://github.com/eiainano/AgentPlayerAchievements/issues)してください。

## スター履歴

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=eiainao/AgentPlayerAchievements&theme=dark&type=Date">
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=eiainao/AgentPlayerAchievements&type=Date" width="100%">
</picture>

## ライセンス

MIT — [LICENSE](LICENSE) を参照

---

<p align="center">
  <sub>ゲーミフィケーションを愛する開発者のために。213個の実績、さらに増加中。</sub>
</p>
