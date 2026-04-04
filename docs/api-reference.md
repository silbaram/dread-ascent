# API Reference

이 문서는 "외부 API"보다 "코드베이스 안에서 어떤 클래스가 무슨 책임을 가지는가"를 빠르게 찾기 위한 맵입니다.

## Bootstrap

| 파일 | 역할 |
|------|------|
| `src/main.ts` | Phaser 게임 초기화, HUD 생성, `MainScene`/`BattleScene` 등록 |

## Scenes

| 파일 | 역할 |
|------|------|
| `src/scenes/MainScene.ts` | 탐험 루프, 층 진입, 적 조우, 아이템, 결과 처리, 메타 오버레이 연결 |
| `src/scenes/BattleScene.ts` | 카드 전투 전용 씬, 에너지/드로우/상태이상/적 intent/UI 패널 처리 |
| `src/scenes/battleSceneLayout.ts` | 전투 UI 패널 좌표와 레이아웃 상수 |

## Scene Controllers and Directors

| 파일 | 역할 |
|------|------|
| `src/scenes/controllers/InputController.ts` | 키보드 입력을 `MainScene` delegate로 위임 |
| `src/scenes/controllers/OverlayController.ts` | 타이틀/성소/인벤토리/게임오버/승리 오버레이 상태 조정 |
| `src/scenes/directors/FloorDirector.ts` | 층 생성, 적/아이템 스폰, 저장 복원 조립 |
| `src/scenes/directors/BattleDirector.ts` | 필드 기반 전투/턴 처리 보조 경로 |

## Rendering Helpers

| 파일 | 역할 |
|------|------|
| `src/scenes/synchronizers/RenderSynchronizer.ts` | 엔티티 상태를 맵/스프라이트/FOV 렌더와 동기화 |
| `src/scenes/synchronizers/MovementAnimator.ts` | Phaser tween 기반 이동 애니메이션 |
| `src/scenes/synchronizers/MovementDurationPolicy.ts` | 이동 속도와 duration 계산 정책 |
| `src/scenes/effects/DamagePopup.ts` | 데미지/블록/독 팝업 렌더 |

## Domain Entities

| 파일 | 역할 |
|------|------|
| `src/domain/entities/Card.ts` | 카드 모델, 효과 타입, 키워드, 덱 유틸 |
| `src/domain/entities/CardCatalog.ts` | 카드 카탈로그, starter deck, 카탈로그 ID 해석 |
| `src/domain/entities/Player.ts` | 플레이어 위치/스탯/경험치 |
| `src/domain/entities/Enemy.ts` | 적 위치/스탯/보상/추적 상태 |
| `src/domain/entities/Item.ts` | 아이템/장비/소모품 정의 |
| `src/domain/entities/CombatStats.ts` | 체력/공격/방어/이동 속도 기본 스탯 |

## Core Domain Services

### 전투

| 파일 | 역할 |
|------|------|
| `src/domain/services/CardEffectService.ts` | 카드 효과 적용, 피해/Block/회복/버프/상태이상 계산 |
| `src/domain/services/StatusEffectService.ts` | `VULNERABLE`, `WEAK`, `POISON`, `FRAIL` 등 상태이상 처리 |
| `src/domain/services/DrawCycleService.ts` | draw/hand/discard/exhaust 순환 |
| `src/domain/services/EnergyService.ts` | 턴 에너지 관리 |
| `src/domain/services/EnemyIntentService.ts` | 적의 다음 행동 intent 계산 |
| `src/domain/services/CardBattleService.ts` | 적 카드 풀과 드로우용 카드 선택 |
| `src/domain/services/CardBattleResolver.ts` | 카드 vs 카드 상성 계산 |
| `src/domain/services/CardBattleLoopService.ts` | 멀티 라운드 카드 배틀 루프 |
| `src/domain/services/CombatService.ts` | 필드용 단순 공격 계산 |
| `src/domain/services/EquipmentCardBonusService.ts` | 장비 스탯을 카드 파워 보너스로 변환 |

### 탐험 / 층 / 적

| 파일 | 역할 |
|------|------|
| `src/domain/services/FloorProgressionService.ts` | 층 번호와 `normal/safe/boss` 진행 |
| `src/domain/services/EnemySpawnerService.ts` | 적/보스 스폰 |
| `src/domain/services/EnemyAiService.ts` | 적 시야, 추적, 이동, 공격 선택 |
| `src/domain/services/TurnQueueService.ts` | 턴 큐 관리 |
| `src/domain/services/VisibilityService.ts` | FOV 계산 결과 관리 |

### 보상 / 진행 / 저장

| 파일 | 역할 |
|------|------|
| `src/domain/services/CardDropService.ts` | 적 처치 후 카드 보상 오퍼 생성 |
| `src/domain/services/DeckService.ts` | 플레이어 덱 관리 |
| `src/domain/services/ItemService.ts` | 필드 아이템과 인벤토리/장착/사용 처리 |
| `src/domain/services/RunPersistenceService.ts` | 현재 런 저장/복원 |
| `src/domain/services/SoulShardService.ts` | 영혼 파편 적립/소비 |
| `src/domain/services/MetaProgressionService.ts` | 성소 영구 업그레이드 |
| `src/domain/services/CardCollectionService.ts` | 카드 모음집 해금 누적 |
| `src/domain/services/CombatBalance.ts` | 카드 카탈로그, starter deck, 전투 리소스, intent 가중치 |

## UI

| 파일 | 역할 |
|------|------|
| `src/ui/GameHud.ts` | DOM HUD와 모든 오버레이 렌더링/이벤트 처리 |
| `src/ui/GameLocalization.ts` | 로케일 문자열과 언어 저장 |
| `src/ui/gameHud.css` | HUD 스타일시트 |

## ROT.js Adapters

| 파일 | 역할 |
|------|------|
| `src/infra/rot/MapGenerator.ts` | 맵 생성, 플레이어 스폰, 계단/REST 배치 |
| `src/infra/rot/RotFovCalculator.ts` | ROT.js FOV 어댑터 |
| `src/infra/rot/RotPathFinder.ts` | ROT.js 경로 탐색 어댑터 |
| `src/infra/rot/RotTurnScheduler.ts` | ROT.js 턴 스케줄러 어댑터 |
