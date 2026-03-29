---
name: error-handling
description: 에러 처리 및 로깅 패턴. 에러 분류 체계, 사용자 친화 메시지, 로깅 전략을 포함한다.
---

# Error Handling

이 스킬은 에러 처리 로직을 작성하거나 기존 에러 처리를 개선할 때 적용됩니다.
언어/프레임워크에 무관하게 적용되는 보편 원칙입니다.

## 핵심 규칙

1. **에러를 삼키지 않는다**: 빈 catch 블록은 금지. 반드시 로깅하거나 재전파한다.
2. **에러는 발생 지점에서 가장 가까운 곳에서 처리한다**: 처리할 수 없으면 상위로 전파한다.
3. **사용자에게는 행동 가능한 메시지를 보여준다**: 내부 에러 상세(스택 트레이스, DB 쿼리)를 노출하지 않는다.
4. **예상된 에러와 예상치 못한 에러를 구분한다**: 비즈니스 규칙 위반(예상)과 시스템 장애(비예상)는 다르게 처리한다.
5. **에러 복구가 가능하면 복구하고, 불가능하면 빠르게 실패한다**: 반복 재시도는 명확한 조건과 제한이 있어야 한다.

## 패턴 및 예시

### 패턴 1: 에러 분류 체계

에러를 계층으로 구분하여 처리 전략을 명확히 한다.

```
// 에러 계층 설계
ApplicationError          // 최상위 커스텀 에러
  ├── ValidationError     // 입력 검증 실패 (400)
  ├── AuthenticationError // 인증 실패 (401)
  ├── AuthorizationError  // 권한 부족 (403)
  ├── NotFoundError       // 리소스 없음 (404)
  ├── ConflictError       // 상태 충돌 (409)
  └── ExternalServiceError // 외부 서비스 장애 (502)

// 사용 예
function findUser(id):
  user = db.findById(id)
  if user is null:
    throw NotFoundError("사용자를 찾을 수 없습니다", { userId: id })
  return user
```

### 패턴 2: 에러 응답 형식 통일

모든 에러 응답은 동일한 구조를 사용한다.

```
// 에러 응답 표준 형식
{
  "error": {
    "code": "VALIDATION_ERROR",       // 기계가 읽는 코드
    "message": "이메일 형식이 올바르지 않습니다",  // 사용자가 읽는 메시지
    "details": [                       // (선택) 상세 정보
      { "field": "email", "reason": "invalid_format" }
    ]
  }
}

// 성공 시에도 일관된 래퍼 사용
{
  "data": { ... },
  "meta": { "timestamp": "..." }
}
```

### 패턴 3: 에러 전파 원칙

각 계층에서의 처리 책임을 명확히 한다.

```
// 계층별 에러 처리 책임
[데이터 계층]   → 기술적 에러를 비즈니스 에러로 변환
[비즈니스 계층] → 비즈니스 규칙 위반을 명시적 에러로 생성
[표현 계층]     → 에러를 사용자 친화 응답으로 변환

// 예시: 데이터 계층
function saveUser(user):
  try:
    db.insert(user)
  catch DatabaseUniqueViolation:
    throw ConflictError("이미 등록된 이메일입니다")  // 변환
  catch DatabaseConnectionError:
    log.error("DB 연결 실패", { error })
    throw ExternalServiceError("일시적 오류가 발생했습니다")  // 변환

// 예시: 표현 계층 (최상위 핸들러)
function globalErrorHandler(error, request, response):
  if error is ApplicationError:
    response.status(error.statusCode).json(error.toResponse())
  else:
    log.error("예상치 못한 에러", { error, request })
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" }
    })
```

### 패턴 4: 재시도 전략

일시적 실패에 대한 재시도는 명확한 조건과 제한을 둔다.

```
// 재시도 설정
retryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,        // ms
  backoffMultiplier: 2,    // 지수 백오프
  retryableErrors: [NetworkError, TimeoutError]
}

function withRetry(operation, config):
  for attempt in 1..config.maxAttempts:
    try:
      return operation()
    catch error:
      if error not in config.retryableErrors:
        throw error   // 재시도 불가 에러는 즉시 전파
      if attempt == config.maxAttempts:
        throw error   // 최대 횟수 초과
      delay = config.baseDelay * (config.backoffMultiplier ^ (attempt - 1))
      wait(delay)
```

### 패턴 5: 로깅 전략

에러 로그는 디버깅에 필요한 맥락 정보를 포함한다.

```
// 로그 레벨 기준
ERROR  → 즉시 조치 필요 (서비스 장애, 데이터 손실 위험)
WARN   → 주의 필요하나 서비스는 정상 (재시도 성공, 폴백 사용)
INFO   → 정상 동작 기록 (요청 처리, 상태 변경)
DEBUG  → 개발/디버깅용 상세 정보

// 로그에 포함할 정보
log.error("주문 생성 실패", {
  orderId: order.id,
  userId: user.id,
  amount: order.amount,
  error: error.message,
  stack: error.stack,       // ERROR 레벨에서만
  requestId: context.requestId,
  timestamp: now()
})

// 민감 정보 제외
// 비밀번호, 토큰, 카드번호, 개인정보 등은 절대 로깅하지 않는다
```

## 주의사항

- 에러 메시지에 내부 구현 상세를 노출하지 않는다 (SQL 쿼리, 파일 경로, 스택 트레이스)
- 프로덕션 환경에서 DEBUG 레벨 로그가 활성화되지 않도록 한다
- 에러 처리 로직 자체에서 에러가 발생하지 않도록 방어적으로 작성한다
- 비동기 작업의 에러는 반드시 처리한다 (unhandled rejection/exception 방지)
- 외부 API 호출 시 타임아웃을 반드시 설정한다
