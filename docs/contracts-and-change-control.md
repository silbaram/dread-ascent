# Contracts and Change Control

## 이 문서의 대상

`docs/`는 온보딩 문서지만, 이 프로젝트는 별도의 내부 계약과 변경 관리 체계를 같이 운영합니다.  
게임 규칙이나 UI 상태를 크게 바꿀 때는 아래 파일들을 함께 봐야 합니다.

## 내부 계약 파일

위치:

- `ai-dev-team/artifacts/contracts/events.schema.json`
- `ai-dev-team/artifacts/contracts/balance.json`
- `ai-dev-team/artifacts/contracts/combat.json`
- `ai-dev-team/artifacts/contracts/ui-states.json`
- `ai-dev-team/artifacts/contracts/validate-contracts.mjs`

역할:

- `events.schema.json`
  이벤트 이름과 payload
- `balance.json`
  밸런스 키와 허용 범위
- `combat.json`
  카드 효과 타입, 상태이상 타입, 카드 밸런스 ID, Dread Rule ID/effect
- `ui-states.json`
  화면 상태, 전이, HUD 바인딩
- `validate-contracts.mjs`
  문서/계약 정합성 검사

실행:

```bash
npm run validate:contracts
```

`npm test`는 Vitest 실행 후 같은 계약 검증을 함께 실행합니다.

## 관련 내부 문서

- `ai-dev-team/artifacts/project.md`
- `ai-dev-team/artifacts/game-systems.md`
- `ai-dev-team/artifacts/hud.md`
- `ai-dev-team/artifacts/change-checklist.md`

이 문서들은 `docs/`보다 더 깊은 설계 의도를 담습니다.

## 변경 분류

내부 체크리스트 기준으로 보면 대략 이렇게 나눌 수 있습니다.

### Major

- 이벤트 이름 변경
- 이벤트 payload 필드 추가/삭제/이름 변경
- UI state/transition 변경
- 밸런스 키 추가/삭제/이름 변경
- 계약 파일과 문서의 기준 자체를 바꾸는 작업

### Minor

- 기존 범위 안의 숫자 튜닝
- 구현 세부 수정
- 의미를 바꾸지 않는 문서 보완

## 권장 작업 순서

1. 변경이 코드만의 일인지, 계약까지 건드리는 일인지 먼저 분류
2. 계약 영향이 있으면 `ai-dev-team/artifacts/*` 문서를 먼저 확인
3. 필요한 경우 계약 파일 수정
4. `npm run validate:contracts` 실행
5. 테스트와 빌드 검증
6. `docs/`를 현재 상태에 맞게 업데이트

## 현재 저장소에서 주의할 점

- `docs/`는 빠른 이해용입니다.
- 시스템 변경의 단일 진실은 내부 계약 파일 쪽입니다.
- 내부 아티팩트 중 일부는 템플릿에서 이어진 흔적이 있을 수 있으므로, 최종 판단은 항상 실제 코드와 함께 해야 합니다.
