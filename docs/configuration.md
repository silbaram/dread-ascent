# Configuration

이 문서는 현재 코드에 박혀 있는 주요 런타임/밸런스/저장 설정을 빠르게 찾기 위한 요약입니다.

## 런타임

| 항목 | 값 | 위치 |
|------|-----|------|
| 화면 크기 | `800 x 600` | `src/main.ts` |
| 렌더러 | `Phaser.AUTO` | `src/main.ts` |
| 픽셀 아트 | `true` | `src/main.ts` |
| 등록 씬 | `MainScene`, `BattleScene` | `src/main.ts` |

## 전투 리소스

| 항목 | 값 | 위치 |
|------|-----|------|
| 최대 에너지 | `3` | `COMBAT_RESOURCE_BALANCE.maxEnergy` |
| 턴당 기본 드로우 | `5` | `COMBAT_RESOURCE_BALANCE.cardsPerTurn` |
| 최대 손패 | `10` | `COMBAT_RESOURCE_BALANCE.maxHandSize` |
| 카드 보상 오퍼 수 | `3` | `COMBAT_RESOURCE_BALANCE.rewardOfferSize` |

## 시작 덱과 덱 상한

| 항목 | 값 | 위치 |
|------|-----|------|
| 시작 덱 | `Strike x4`, `Fortify x3` | `STARTER_DECK_COMPOSITION` |
| 최대 덱 크기 | `20` | `DECK_MAX_SIZE` |

## 카드 드롭

| 항목 | 값 | 위치 |
|------|-----|------|
| 일반 적 드롭 확률 | `0.3` | `NORMAL_DROP_RATE` |
| 엘리트 적 드롭 확률 | `0.6` | `ELITE_DROP_RATE` |
| 보스 드롭 확률 | `1.0` | `BOSS_DROP_RATE` |

보상 오퍼 구성:

- 1장: 현재 덱 방향성 아키타입
- 1장: 중립 카드
- 1장: 랜덤 슬롯

## 층 진행

| 항목 | 값 | 위치 |
|------|-----|------|
| 안전지대 확률 | `0.25` | `DEFAULT_SAFE_FLOOR_CHANCE` |
| 보스층 번호 | `100` | `BOSS_FLOOR_NUMBER` |

## 인벤토리

| 항목 | 값 | 위치 |
|------|-----|------|
| 층당 기본 아이템 수 | `3` | `DEFAULT_MAX_ITEMS_PER_FLOOR` |
| 인벤토리 슬롯 | `12` | `DEFAULT_INVENTORY_SLOT_CAPACITY` |

## 상태이상

| 항목 | 값 | 위치 |
|------|-----|------|
| Vulnerable 배율 | `1.5` | `STATUS_EFFECT_BALANCE.vulnerableDamageMultiplier` |
| Weak 배율 | `0.75` | `STATUS_EFFECT_BALANCE.weakDamageMultiplier` |
| Frail Block 배율 | `0.75` | `STATUS_EFFECT_BALANCE.frailBlockMultiplier` |
| Poison 스택당 피해 | `1` | `STATUS_EFFECT_BALANCE.poison.damagePerStack` |
| Poison 턴당 감소 | `1` | `STATUS_EFFECT_BALANCE.poison.stackDecayPerTurn` |

## 영혼 파편과 메타 진행

| 항목 | 값 | 위치 |
|------|-----|------|
| 층당 영혼 파편 | `10` | `SOUL_SHARDS_PER_FLOOR` |
| 처치당 영혼 파편 | `3` | `SOUL_SHARDS_PER_DEFEATED_ENEMY` |

성소 업그레이드:

| 업그레이드 | 효과 | 기본 비용 | 비용 증가 |
|-----------|------|-----------|-----------|
| `Vitality` | 시작 HP `+10` | `20` | `+10` |
| `Ferocity` | 시작 ATK `+2` | `25` | `+15` |
| `Bulwark` | 시작 DEF `+1` | `20` | `+12` |

## 저장 키

| 키 | 내용 |
|----|------|
| `dread-ascent.run-state` | 현재 런 상태 |
| `dread-ascent.soul-shards` | 누적 영혼 파편 |
| `dread-ascent.meta-progression` | 성소 업그레이드 레벨 |
| `dread-ascent.card-collection` | 카드 모음집 해금 목록 |
| `dread-ascent.locale` | 선택한 언어 |

## 주의할 점

- `ai-dev-team/artifacts/` 문서에 있는 일부 버전/수치는 현재 `package.json` 및 실제 코드와 다를 수 있습니다.
- 값을 바꿀 때는 `CombatBalance.ts`, 개별 서비스 상수, 계약 파일이 함께 어긋나지 않는지 확인해야 합니다.
