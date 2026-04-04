# Persistence and Meta

## 저장의 큰 구분

이 프로젝트는 데이터를 두 종류로 나눠 저장합니다.

### 런 저장

현재 플레이 중인 한 번의 하강 상태입니다.

저장 키:

- `dread-ascent.run-state`

저장 내용:

- 런 상태(`active`, `game-over`, `victory`)
- 현재 층
- 플레이어 스탯과 경험치
- 인벤토리
- 덱
- 처치 수

담당 서비스:

- `RunPersistenceService`

### 메타 저장

하강 간에 유지되는 장기 데이터입니다.

저장 키:

- `dread-ascent.soul-shards`
- `dread-ascent.meta-progression`
- `dread-ascent.card-collection`
- `dread-ascent.locale`

## 저장/복원 흐름

`MainScene`에서 다음 시점에 저장이 일어납니다.

- 새 런 시작 후
- 층 전환 후
- 런 재개 후
- 게임 오버/승리 시 상태 갱신 후

복원 시에는 저장된 덱, 인벤토리, 플레이어 스탯, 층 정보를 바탕으로 필드를 다시 구성합니다.

## 영혼 파편

영혼 파편은 `SoulShardService`가 관리합니다.

현재 적립 공식:

```text
floorNumber * 10 + defeatedEnemies * 3
```

중요:

- 현재 프로덕션 적립 경로는 `게임 오버 시점`입니다.
- 성소는 영혼 파편을 얻는 곳이 아니라 쓰는 곳입니다.
- 현재 `승리 시` 영혼 파편 적립은 없습니다.

## 성소

성소는 타이틀 화면에서 여는 메타 상점입니다.

담당 서비스:

- `MetaProgressionService`

구매 가능한 영구 업그레이드:

- `Vitality`
  시작 HP 증가
- `Ferocity`
  시작 ATK 증가
- `Bulwark`
  시작 DEF 증가

구매 시:

1. 영혼 파편 차감
2. 업그레이드 레벨 저장
3. 다음 런 시작 스탯에 반영

## 카드 모음집

카드 모음집은 `CardCollectionService`가 관리합니다.

특징:

- 카드 카탈로그 전체 목록을 기준으로 렌더
- 과거 하강에서 확보한 카드만 해금
- 해금 여부를 `catalogId` 기준으로 누적 저장
- 타이틀 화면 `Card Archive`에서 열람

즉, 이 서비스는 "현재 덱"이 아니라 "메타 차원의 카드 발견 기록"을 저장합니다.

## 로케일

언어 선택은 `GameLocalization`이 관리합니다.

- 저장 키: `dread-ascent.locale`
- 현재 지원 로케일: 코드상 `ko`, `en`

## 현재 저장 모델에서 알아둘 점

- 영혼 파편은 런 저장에 포함되지 않고 별도 메타 키로 관리됩니다.
- 카드 모음집도 런 저장과 분리된 메타 데이터입니다.
- 안전지대와 성소는 개념적으로 가깝지만, 현재 코드에서는 "필드 안전지대"와 "타이틀 성소 UI"가 다른 시스템입니다.
