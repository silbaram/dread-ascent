---
name: clean-code
description: 클린 코드 원칙. 네이밍, 함수 설계, 구조화, 코드 스멜 제거에 대한 실천 가이드.
---

# Clean Code

이 스킬은 코드를 작성하거나 리팩토링할 때 적용됩니다.
언어/프레임워크에 무관하게 적용되는 보편 원칙입니다.

## 핵심 규칙

1. **코드는 작성하는 시간보다 읽는 시간이 길다**: 항상 읽는 사람 관점에서 작성한다.
2. **이름이 의도를 설명해야 한다**: 주석 없이도 이름만으로 목적을 파악할 수 있어야 한다.
3. **함수는 한 가지 일만 한다**: 함수 내에서 추상화 수준을 섞지 않는다.
4. **중복보다 명확성이 우선한다**: 성급한 추상화(DRY 과적용)보다 읽기 쉬운 코드가 낫다.
5. **부수 효과를 최소화한다**: 함수가 이름 외의 동작을 하면 안 된다.

## 패턴 및 예시

### 패턴 1: 네이밍 규칙

```
// 변수 - 명사/명사구, 무엇인지 명확하게
나쁨: d, data, tmp, flag, val
좋음: elapsedDays, activeUsers, isVerified, maxRetryCount

// 함수 - 동사/동사구, 무엇을 하는지 명확하게
나쁨: process(), handle(), doWork(), manage()
좋음: validateEmail(), calculateDiscount(), sendNotification()

// 불리언 - is/has/can/should 접두사
나쁨: login, active, permission
좋음: isLoggedIn, hasPermission, canEdit, shouldRetry

// 컬렉션 - 복수형
나쁨: userList, itemArray
좋음: users, items, activeOrders

// 상수 - 의미 있는 이름 (매직 넘버 제거)
나쁨: if (retryCount > 3)
좋음: MAX_RETRY_ATTEMPTS = 3
      if (retryCount > MAX_RETRY_ATTEMPTS)
```

### 패턴 2: 함수 설계 원칙

```
// 규칙 1: 한 가지 일만 한다
나쁨:
  function createUserAndSendEmail(data):
    validate(data)
    user = db.insert(data)
    email.send(user.email, "가입 환영")
    log.info("사용자 생성")
    return user

좋음:
  function createUser(data):
    validate(data)
    return db.insert(data)

  function onUserCreated(user):
    sendWelcomeEmail(user)
    logUserCreation(user)

// 규칙 2: 인자는 3개 이하
나쁨: createUser(name, email, age, role, team, department)
좋음: createUser({ name, email, age, role, team, department })

// 규칙 3: 추상화 수준 통일
나쁨:
  function processOrder(order):
    // 높은 수준
    validateOrder(order)
    // 갑자기 낮은 수준
    connection = db.getConnection()
    connection.query("INSERT INTO orders ...")
    connection.close()
    // 다시 높은 수준
    notifyCustomer(order)

좋음:
  function processOrder(order):
    validateOrder(order)
    saveOrder(order)
    notifyCustomer(order)
```

### 패턴 3: 조건문 개선

```
// 규칙 1: 부정 조건보다 긍정 조건 우선
나쁨: if (!isNotValid)
좋음: if (isValid)

// 규칙 2: 복잡한 조건은 의미 있는 이름으로 추출
나쁨:
  if (user.age >= 18 && user.hasAgreed && !user.isBanned && user.emailVerified):
    grantAccess()

좋음:
  isEligible = user.age >= 18 && user.hasAgreed && !user.isBanned && user.emailVerified
  if (isEligible):
    grantAccess()

  // 또는 함수로 추출
  if (isEligibleForAccess(user)):
    grantAccess()

// 규칙 3: 가드 클로즈로 중첩 제거
나쁨:
  function getDiscount(user):
    if (user != null):
      if (user.isMember):
        if (user.grade == "VIP"):
          return 0.2
        else:
          return 0.1
      else:
        return 0
    else:
      return 0

좋음:
  function getDiscount(user):
    if (user == null): return 0
    if (!user.isMember): return 0
    if (user.grade == "VIP"): return 0.2
    return 0.1
```

### 패턴 4: 주석 원칙

```
// 불필요한 주석 - 코드가 이미 말하고 있다
나쁨:
  // 사용자 이름을 가져온다
  name = user.getName()

  // i를 1 증가시킨다
  i = i + 1

// 유용한 주석 - 코드로 표현할 수 없는 정보
좋음:
  // RFC 3339 형식 필수 - 외부 API 요구사항
  timestamp = formatRFC3339(now())

  // 동시성 이슈로 락 획득 순서 변경 금지 (2024-03 장애 대응)
  acquireLock(resourceA)
  acquireLock(resourceB)

// TODO/FIXME - 구체적 맥락 포함
나쁨: // TODO: 나중에 고치기
좋음: // TODO(#123): 벌크 삽입 시 1000건 초과하면 분할 처리 필요
```

### 패턴 5: 코드 스멜 감지

아래 증상이 보이면 리팩토링을 검토한다:

```
1. 긴 함수       → 30줄 초과 시 분리 검토
2. 긴 인자 목록   → 3개 초과 시 객체로 묶기
3. 중첩 3단계 이상 → 가드 클로즈, 함수 추출로 평탄화
4. 같은 조건 반복  → 다형성 또는 전략 패턴 적용
5. 데이터 뭉치    → 항상 함께 다니는 데이터는 하나의 객체로
6. 플래그 인자    → 별도 함수로 분리
7. 죽은 코드      → 사용되지 않는 코드는 즉시 삭제
```

## 주의사항

- 클린 코드는 목표가 아니라 수단이다. 과도한 리팩토링으로 일정을 놓치지 않는다
- 기존 코드를 수정할 때는 **보이스카웃 규칙**(왔을 때보다 깨끗하게)을 적용하되, 변경 범위를 Task 범위 내로 제한한다
- 성능이 중요한 코드에서는 가독성과 성능 사이 트레이드오프를 판단한다
- 팀/프로젝트의 기존 컨벤션이 있으면 이 스킬보다 우선한다 (project.md 기준)
