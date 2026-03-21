---
name: typescript-style
description: >-
  TypeScript 코드를 작성할 때의 코딩 스타일, 컨벤션, 아키텍처 가이드.
  이 스킬은 TypeScript 파일(.ts, .tsx)을 생성하거나 수정할 때 항상 적용한다.
  트리거: TypeScript 코드 작성, 리팩토링, 코드 리뷰, 새 모듈/컴포넌트 생성, 타입 설계,
  에러 핸들링 구현, 테스트 작성, 프로젝트 구조 설계 시 반드시 참조.
  "코드 스타일", "컨벤션", "타입스크립트", "TS", "코드 품질" 등의 키워드에도 반응.
---

# TypeScript Style Guide for ADA

> AI 에이전트가 일관되고 확장 가능한 TypeScript 코드를 생성하기 위한 가이드.
> 모든 규칙은 **예측 가능성**, **타입 안전성**, **최소 인지 부하**를 기준으로 설계되었다.

---

## 핵심 원칙

1. **Explicit over Implicit** — 타입, 반환값, 의도를 명시한다
2. **Functional over Class-based** — 함수형·선언적 패턴을 우선한다
3. **Immutable by Default** — `const`, `readonly`, `as const`를 기본으로 한다
4. **Fail Fast, Fail Clearly** — 에러는 빠르게 발생시키고 명확하게 전달한다
5. **Colocation** — 관련 코드는 가까이 둔다 (타입, 테스트, 유틸)
6. **Minimal Surface Area** — 필요한 것만 export하고, 필요한 것만 의존한다

---

## 타입 시스템

### 절대 금지

```typescript
// ❌ NEVER
let data: any
let items: object
enum Status { Active, Inactive }
```

### 필수 패턴

```typescript
// ✅ ALWAYS — interface for object shapes
interface User {
  readonly id: string;
  name: string;
  email: string;
}

// ✅ ALWAYS — union over enum
type Status = 'active' | 'inactive' | 'pending';

// ✅ ALWAYS — discriminated union for variants
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

// ✅ ALWAYS — explicit function signatures
function findUser(id: string): Promise<Result<User>> { ... }
```

### 타입 설계 규칙

| 규칙 | 설명 |
|------|------|
| `interface` > `type` | 객체 형태는 interface, 유니온/교차/유틸리티는 type |
| `unknown` > `any` | 외부 데이터는 반드시 `unknown` → 타입 가드로 좁힌다 |
| `readonly` 기본 | 변경이 필요한 경우에만 mutable 허용 |
| Utility types 활용 | `Partial`, `Pick`, `Omit`, `Record`, `Required` 적극 사용 |
| 제네릭 제약 | `<T extends Base>` 형태로 항상 제약을 건다 |
| `satisfies` 활용 | 타입 추론 유지하면서 타입 검증: `const cfg = {...} satisfies Config` |
| Branded types | 동일 primitive 구분 시 사용 (UserId vs OrderId) |

> 상세 타입 패턴은 `references/type-patterns.md` 참조

---

## 네이밍 컨벤션

```
파일/디렉토리  : kebab-case     → user-profile/, auth-service.ts
인터페이스      : PascalCase     → UserProfile, AuthConfig
타입 별칭       : PascalCase     → RequestParams, ApiResponse
함수            : camelCase      → getUserById, handleSubmit
변수 (불리언)   : 보조동사 접두  → isLoading, hasError, canEdit, shouldRetry
상수            : UPPER_SNAKE    → MAX_RETRY_COUNT, DEFAULT_TIMEOUT
제네릭 파라미터 : 서술적 이름    → TResult, TInput (단일 문자 T는 단순한 경우만)
```

### 금지 패턴

- `I` 접두사 (`IUser`) → 그냥 `User`
- `Impl` 접미사 → 구현체는 구체적 이름 사용
- 축약어 (`usr`, `btn`, `mgr`) → 풀네임 사용
- 부정형 불리언 (`isNotVisible`) → 긍정형 사용 (`isVisible`)

---

## 파일 구조 & 모듈 구성

### 단일 파일 구조 (위에서 아래로)

```typescript
// 1. 외부 imports
import { z } from 'zod';

// 2. 내부 imports  
import { AppError } from '@/errors';

// 3. Types / Interfaces (이 파일 전용)
interface Props { ... }

// 4. Constants
const MAX_ITEMS = 100;

// 5. Helper functions (private, 내부용)
function validate(input: unknown): Result<Data> { ... }

// 6. Main export
export function createService(config: Config): Service { ... }
```

### 프로젝트 디렉토리 구조

```
src/
├── types/              # 공유 타입 정의
│   ├── index.ts        # re-export barrel
│   ├── domain.ts       # 도메인 모델
│   └── api.ts          # API 요청/응답 타입
├── errors/             # 에러 타입 + 팩토리
├── utils/              # 순수 유틸리티 함수
├── services/           # 비즈니스 로직
├── adapters/           # 외부 시스템 연동
└── __tests__/          # 또는 각 모듈 옆 *.test.ts
```

### Export 규칙

- **Named export** 우선 (default export 최소화)
- Barrel file (`index.ts`)은 public API 경계에서만 사용
- 순환 의존 절대 금지 — 발견 시 즉시 구조 리팩토링

---

## 함수 작성

### 기본 규칙

```typescript
// ✅ 순수 함수 → function 키워드
function calculateTotal(items: readonly Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ 콜백/인라인 → 화살표 함수
const sorted = items.filter((item) => item.isActive);

// ✅ Early return으로 depth 최소화
function processOrder(order: Order): Result<Invoice> {
  if (!order.items.length) {
    return { ok: false, error: new EmptyOrderError() };
  }

  if (!order.customer.isVerified) {
    return { ok: false, error: new UnverifiedCustomerError() };
  }

  const invoice = generateInvoice(order);
  return { ok: true, data: invoice };
}
```

### 함수 크기 가이드

- 하나의 함수는 **하나의 책임**만 갖는다
- 30줄 이하 권장 — 넘으면 분리 검토
- 파라미터 3개 초과 시 → 객체 파라미터로 전환
- 중첩 depth 3 이상 금지

```typescript
// ❌ 파라미터가 많은 경우
function createUser(name: string, email: string, age: number, role: Role): User

// ✅ 객체 파라미터
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  role: Role;
}
function createUser(params: CreateUserParams): User
```

---

## 에러 핸들링

### Result 패턴 (권장)

```typescript
// 에러 타입 정의
type AppError =
  | { code: 'NOT_FOUND'; message: string; entityId: string }
  | { code: 'VALIDATION'; message: string; fields: string[] }
  | { code: 'NETWORK'; message: string; statusCode: number };

type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// 사용
function parseConfig(raw: unknown): Result<Config> {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: parsed.error.message, fields: [] },
    };
  }
  return { ok: true, data: parsed.data };
}
```

### try-catch 규칙

- `catch(error: unknown)` — 항상 `unknown`으로 받는다
- catch 블록에서 즉시 타입 좁히기
- 에러를 삼키지 않는다 (빈 catch 금지)
- 경계 레이어(API endpoint, CLI entry)에서만 최종 catch

```typescript
try {
  await riskyOperation();
} catch (error: unknown) {
  if (error instanceof NetworkError) {
    logger.warn('Network issue', { error });
    return { ok: false, error: toAppError(error) };
  }
  // 예상 못한 에러는 상위로 전파
  throw error;
}
```

---

## 비동기 코드

```typescript
// ✅ async/await 기본 — .then() 체이닝 지양
async function fetchUsers(): Promise<Result<User[]>> {
  const response = await api.get<User[]>('/users');
  if (!response.ok) {
    return { ok: false, error: toAppError(response.error) };
  }
  return { ok: true, data: response.data };
}

// ✅ 병렬 실행 — Promise.all / Promise.allSettled
const [users, orders] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
]);

// ✅ 에러 격리가 필요할 때 — Promise.allSettled
const results = await Promise.allSettled([taskA(), taskB(), taskC()]);
const succeeded = results
  .filter((r): r is PromiseFulfilledResult<Data> => r.status === 'fulfilled')
  .map((r) => r.value);
```

---

## Validation (Zod 권장)

```typescript
import { z } from 'zod';

// 스키마 정의 → 타입 자동 추출
const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

// 타입 추출
type User = z.infer<typeof userSchema>;

// 외부 입력은 반드시 validate
function handleRequest(body: unknown): Result<User> {
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: toValidationError(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
```

---

## 코드 품질 체크리스트

코드 작성 후 아래 체크리스트를 **자동으로** 검증한다:

- [ ] `any` 타입이 없는가?
- [ ] 모든 함수에 반환 타입이 명시되어 있는가?
- [ ] `readonly`가 적절히 사용되었는가?
- [ ] Early return으로 중첩을 최소화했는가?
- [ ] 에러를 삼키는 빈 catch 블록이 없는가?
- [ ] Named export를 사용했는가?
- [ ] 매직 넘버/문자열 대신 상수를 사용했는가?
- [ ] 함수 파라미터가 3개 이하인가?
- [ ] 순환 의존이 없는가?
- [ ] TODO 주석에 이슈 번호나 설명이 있는가?

---

## AI 에이전트 작업 프로토콜

AI가 TypeScript 코드를 생성·수정할 때 따라야 하는 프로토콜:

### 1. 코드 생성 시

- 새 파일 생성 시 위 **단일 파일 구조** 순서를 따른다
- 타입을 먼저 정의하고, 구현은 그 다음에 작성한다
- 외부 의존성 추가 시 반드시 명시하고 이유를 설명한다
- 생성 후 **코드 품질 체크리스트**를 자동 검증한다

### 2. 코드 수정 시

- 수정 범위를 최소화한다 — 관련 없는 코드를 건드리지 않는다
- 기존 코드 스타일과 패턴을 따른다 (일관성 우선)
- 리팩토링과 기능 변경을 같은 커밋에 섞지 않는다
- 변경 사유를 주석이 아닌 커밋 메시지로 전달한다

### 3. 불완전한 구현

- 완성하지 못한 부분은 `// TODO(이슈번호): 설명` 형식으로 남긴다
- 임시 코드에는 `// HACK:` 또는 `// FIXME:` 태그를 사용한다
- 절대로 조용히 실패하는 코드를 작성하지 않는다

### 4. 커밋 메시지

Conventional Commits를 따른다:

```
feat: 사용자 프로필 API 추가
fix: 토큰 갱신 시 race condition 수정
refactor: 인증 모듈 Result 패턴 적용
test: OrderService 단위 테스트 추가
chore: eslint 설정 업데이트
```

---

## 참조 문서

추가 상세 패턴이 필요할 때 아래 파일을 참조한다:

- `references/type-patterns.md` — 고급 타입 패턴 (Branded types, Template literals, Conditional types 등)
- `references/testing-guide.md` — 테스트 작성 가이드 (구조, 네이밍, 모킹 패턴)
- `references/project-setup.md` — tsconfig, ESLint, Prettier 설정 템플릿
