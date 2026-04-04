# UI and Scenes

## 씬 구성

프로젝트의 플레이 흐름은 크게 두 Phaser 씬으로 나뉩니다.

### `MainScene`

역할:

- 타이틀 상태 복귀
- 필드 탐험과 이동
- 층 생성과 전환
- 적 조우 감지
- 아이템 습득/사용/드롭
- 게임 오버/승리 처리
- DOM HUD와 오버레이 동기화

### `BattleScene`

역할:

- 카드 전투 전용 UI
- 플레이어/적 체력, Block, 상태이상 표시
- 손패 렌더, 카드 상세 패널, 적 intent 표시
- 전투 로그와 데미지 팝업
- 전투 종료 후 `MainScene`으로 결과 반환

## HUD 구성

DOM HUD는 `GameHud`가 렌더합니다.

주요 영역:

- 상단 상태 바
  층, 체력, 경험치, 턴 상태
- 타이틀 오버레이
  `Continue`, `New Descent`, `Sanctuary`, `Card Archive`
- 인벤토리 오버레이
- 카드 보상 오버레이
- 게임 오버 오버레이
- 승리 오버레이

## 오버레이 상태

오버레이 상태는 `OverlayController`가 관리합니다.

상태 플래그:

- `isTitleScreenOpen`
- `isSanctuaryOpen`
- `isCardCollectionOpen`
- `isInventoryOpen`
- `isGameOver`
- `isVictory`

즉, 실제 DOM 생성은 `GameHud`, 화면 상태 전환은 `OverlayController`, 호출 타이밍은 `MainScene`이 맡습니다.

## 타이틀 화면

타이틀은 단순 시작 화면이 아니라 메타 허브입니다.

포함 기능:

- 저장된 런 이어하기
- 새 런 시작
- 성소 열기
- 카드 모음집 열기
- 누적 영혼 파편 표시

성소 메시지와 업그레이드 부족/구매 성공 문구도 여기서 함께 처리됩니다.

## 전투 UI

`BattleScene`는 자체 전투 레이아웃을 가집니다.

주요 패널:

- 적 패널
- 플레이어 패널
- 손패 패널
- Activity 패널
- 카드 상세 패널
- End Turn 버튼

별도 Phaser `BattleScene`가 활성화되면 DOM HUD는 `battle-scene` viewport 모드로 전환되어 상시 chrome을 숨기고, 전투 관련 정보는 전투 씬 내부 패널에 집중됩니다.

## 입력 흐름

키보드 입력은 `InputController`가 받고 `MainScene` delegate 메서드로 위임합니다.

- 이동: `WASD`, 방향키
- 인벤토리: `I`, `Tab`
- 닫기: `Esc`

전투 입력은 주로 `BattleScene` 내부 마우스 상호작용으로 처리합니다.

## 렌더 동기화

`RenderSynchronizer`는 필드 씬에서 아래 항목을 관리합니다.

- 플레이어 스프라이트
- 적 스프라이트
- 아이템 라벨
- 시야/FOV 반영
- 카메라 위치

이동 애니메이션은 `MovementAnimator`와 `MovementDurationPolicy`가 담당합니다.

## 현재 UI 설계에서 알아둘 점

- 타이틀의 성소와 카드 모음집은 "런 바깥 메타 UI"입니다.
- 인벤토리, 카드 보상, 결과 화면은 DOM 오버레이입니다.
- 카드 전투는 Phaser 씬 내부 레이아웃을 사용하므로 HUD와 씬 레이어가 동시에 존재합니다.
