---
name: testing-patterns
description: 테스트 코드 작성 시 적용되는 패턴. 단위/통합/E2E 테스트 구조, 네이밍 규칙, 모킹 전략을 포함한다.
---

# Testing Patterns

이 스킬은 테스트 코드를 작성하거나 기존 테스트를 수정할 때 적용됩니다.
언어/프레임워크에 무관하게 적용되는 보편 원칙입니다.

## 핵심 규칙

1. **테스트는 독립적이어야 한다**: 각 테스트는 다른 테스트에 의존하지 않고 단독 실행 가능해야 한다.
2. **하나의 테스트는 하나의 동작만 검증한다**: 여러 동작을 한 테스트에 넣지 않는다.
3. **테스트 이름만으로 의도를 파악할 수 있어야 한다**: 실패 시 이름만 보고 원인을 추론할 수 있어야 한다.
4. **외부 의존성은 반드시 격리한다**: DB, 네트워크, 파일시스템 등은 모킹하거나 테스트용 인스턴스를 사용한다.
5. **테스트 코드도 프로덕션 코드와 동일한 품질 기준을 적용한다**: 중복 제거, 가독성, 유지보수성을 유지한다.

## 패턴 및 예시

### 패턴 1: AAA (Arrange-Act-Assert)

모든 테스트는 3단계로 구성한다. 단계 사이에 빈 줄로 구분하여 가독성을 확보한다.

```
test "장바구니에 상품 추가 시 총액이 갱신된다":
  // Arrange - 테스트 전제 조건 설정
  cart = new Cart()
  item = { id: "item-1", name: "키보드", price: 50000 }

  // Act - 테스트 대상 동작 실행
  cart.addItem(item)

  // Assert - 결과 검증
  assert cart.totalPrice == 50000
  assert cart.items.length == 1
```

### 패턴 2: 테스트 네이밍 규칙

테스트 이름은 **[대상]_[조건]_[기대결과]** 또는 자연어 서술 형식을 사용한다.

```
// 형식 1: 구조화된 네이밍
test "calculateDiscount_회원등급이_VIP일때_20퍼센트_할인"

// 형식 2: 자연어 서술 (권장)
test "VIP 회원은 20% 할인을 받는다"

// 형식 3: 그룹 + 개별 테스트 조합
group "할인 계산":
  test "VIP 회원은 20% 할인을 받는다"
  test "일반 회원은 할인이 없다"
  test "쿠폰과 등급 할인은 중복 적용되지 않는다"
```

### 패턴 3: 테스트 픽스처 (Test Fixture)

반복되는 설정은 헬퍼 함수로 추출한다. 단, 테스트 내에서 핵심 값은 명시적으로 보여야 한다.

```
// 팩토리 함수 - 기본값 + 오버라이드
function createUser(overrides):
  return merge({
    id: "user-1",
    name: "테스트유저",
    email: "test@example.com",
    role: "member",
  }, overrides)

test "관리자는 사용자를 삭제할 수 있다":
  admin = createUser({ role: "admin" })   // 핵심 값 명시
  target = createUser({ id: "user-2" })

  result = deleteUser(admin, target.id)

  assert result.success == true
```

### 패턴 4: 모킹 전략

외부 의존성의 모킹 범위를 최소한으로 유지한다.

```
// 의존성 주입 방식 (권장)
test "주문 생성 시 결제 서비스를 호출한다":
  mockPayment = mock({ charge: returns({ success: true }) })
  orderService = new OrderService(mockPayment)

  orderService.createOrder({ amount: 10000 })

  assert mockPayment.charge.calledOnce == true

// 모듈 모킹 (외부 라이브러리)
// 프레임워크별 방식을 따르되, 모킹 범위를 테스트 단위로 제한한다.
```

### 패턴 5: 경계값 테스트

비즈니스 로직의 경계 조건을 명시적으로 테스트한다.

```
group "비밀번호 검증":
  // 경계값: 최소 길이
  test "7자 비밀번호는 거부된다":
    assert validatePassword("1234567") == false

  test "8자 비밀번호는 허용된다":
    assert validatePassword("12345678") == true

  // 특수 케이스
  test "빈 문자열은 거부된다":
    assert validatePassword("") == false
```

## 테스트 유형별 가이드

### 단위 테스트 (Unit)
- 단일 함수/클래스의 로직 검증
- 외부 의존성 전부 모킹
- 실행 시간: 각 테스트 100ms 이내
- 커버리지 목표: 비즈니스 로직 80% 이상

### 통합 테스트 (Integration)
- 여러 모듈 간 상호작용 검증
- 실제 DB/파일시스템 사용 가능 (테스트용 인스턴스)
- 테스트 간 상태 격리 필수 (setup/teardown)

### E2E 테스트 (End-to-End)
- 사용자 시나리오 기반 전체 흐름 검증
- 핵심 사용자 경로(happy path)에 집중
- 불안정한 테스트(flaky test)는 즉시 수정하거나 격리

## 주의사항

- 구현 세부사항이 아닌 **동작(행위)**을 테스트한다
- 100% 커버리지를 목표로 하지 않는다. 의미 있는 테스트에 집중한다
- 테스트가 깨지면 프로덕션 코드보다 먼저 확인한다
- 테스트 실행 속도가 느려지면 병렬 실행, 모킹 범위 조정 등을 검토한다
- sleep/delay 기반의 대기 테스트는 피한다. 이벤트/폴링 기반으로 대체한다
