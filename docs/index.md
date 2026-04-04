# Dread Ascent Docs

`Dread Ascent`는 브라우저에서 실행되는 싱글플레이 탐험 + 카드 전투 로그라이트입니다.
현재 저장소는 Phaser 캔버스 씬, DOM HUD, 순수 TypeScript 도메인 서비스, `localStorage` 기반 저장을 조합한 구조로 되어 있습니다.

## 현재 기준 요약

| 항목 | 값 |
|------|-----|
| 런타임 | Browser-only client |
| 핵심 프레임워크 | Phaser 3.80.1 |
| 언어 | TypeScript 5.3.3 |
| 맵/턴 유틸 | rot-js 2.2.0 |
| 테스트 | Vitest 3.2.4 |
| 저장 방식 | `localStorage` |
| 메인 씬 | `MainScene`, `BattleScene` |
| UI 방식 | Phaser 내부 패널 + DOM HUD |

## 현재 구현 범위

- 타이틀 화면, 이어하기, 새 런 시작
- 성소(`Sanctuary`) 메타 업그레이드
- 카드 모음집(`Card Archive`)
- 절차적 맵 생성, 층 진행, 안전지대/보스층
- 필드 탐험, 적 이동, 시야(FOV), 아이템 습득
- 카드 기반 전투 씬, 상태이상, 적 intent, 로그 패널
- 적 처치 카드 보상 오퍼
- 인벤토리와 장비/소모품
- 런 저장/복원, 영혼 파편, 영구 업그레이드

## 문서 목차

- [Quick Start](./quick-start.md)
  로컬 실행, 빌드, 테스트, 기본 조작
- [Architecture](./architecture.md)
  런타임 구성, 디렉터리 역할, 데이터 흐름
- [Gameplay Systems](./gameplay-systems.md)
  탐험, 전투, 보상, 층 진행, 성장 시스템
- [UI and Scenes](./ui-and-scenes.md)
  `MainScene`, `BattleScene`, HUD, 오버레이 구조
- [Persistence and Meta](./persistence-and-meta.md)
  저장 키, 런 저장, 영혼 파편, 성소, 카드 모음집
- [API Reference](./api-reference.md)
  핵심 클래스/서비스의 역할과 책임 맵
- [Configuration](./configuration.md)
  현재 코드에 박힌 주요 상수와 설정 값
- [Testing Guide](./testing-guide.md)
  테스트 트리 구조와 실행 방식
- [Contracts and Change Control](./contracts-and-change-control.md)
  내부 계약 파일, 검증 스크립트, 변경 분류 규칙

## 문서 기준

- `docs/`는 개발자 온보딩과 빠른 파악을 위한 입구 문서입니다.
- 더 깊은 설계 배경은 `ai-dev-team/artifacts/`에 있습니다.
- 값이 충돌할 때는 우선순위를 이렇게 봅니다.
  1. 실제 코드와 `package.json`
  2. `ai-dev-team/artifacts/contracts/*`
  3. `ai-dev-team/artifacts/*.md`
  4. `docs/`
