# 고급 타입 패턴 레퍼런스

> SKILL.md에서 참조하는 상세 타입 패턴 문서.
> 복잡한 타입 설계가 필요할 때만 이 문서를 로드한다.

## 목차

1. [Branded Types](#branded-types)
2. [Discriminated Union 심화](#discriminated-union-심화)
3. [Builder 패턴과 타입](#builder-패턴과-타입)
4. [Template Literal Types](#template-literal-types)
5. [Conditional & Mapped Types](#conditional--mapped-types)
6. [Type Guard 패턴](#type-guard-패턴)
7. [Utility Type 조합](#utility-type-조합)

---

## Branded Types

동일한 primitive를 도메인 의미로 구분할 때 사용한다.

```typescript
// 브랜드 타입 정의
type Brand<T, B extends string> = T & { readonly __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

// 팩토리 함수로 생성
function userId(raw: string): UserId {
  return raw as UserId;
}

function orderId(raw: string): OrderId {
  return raw as OrderId;
}

// 컴파일 타임에 혼용 방지
function getOrder(id: OrderId): Promise<Order> { ... }

const uid = userId('u-123');
const oid = orderId('o-456');

getOrder(oid);  // ✅ OK
getOrder(uid);  // ❌ 컴파일 에러
```

### 실전: Validated 브랜드

```typescript
type Email = Brand<string, 'Email'>;
type NonEmptyString = Brand<string, 'NonEmptyString'>;

function validateEmail(raw: string): Result<Email> {
  const parsed = z.string().email().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: validationError('Invalid email') };
  }
  return { ok: true, data: parsed.data as Email };
}
```

---

## Discriminated Union 심화

### 상태 머신 모델링

```typescript
type ConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; attempt: number }
  | { status: 'connected'; socket: WebSocket; connectedAt: Date }
  | { status: 'error'; error: AppError; lastAttempt: Date };

// exhaustive switch — 새 상태 추가 시 컴파일 에러 발생
function renderStatus(state: ConnectionState): string {
  switch (state.status) {
    case 'disconnected':
      return 'Offline';
    case 'connecting':
      return `Connecting (attempt ${state.attempt})...`;
    case 'connected':
      return `Online since ${state.connectedAt.toISOString()}`;
    case 'error':
      return `Error: ${state.error.message}`;
    default:
      // exhaustiveness check
      const _exhaustive: never = state;
      return _exhaustive;
  }
}
```

### 이벤트 시스템

```typescript
type AppEvent =
  | { type: 'USER_LOGIN'; payload: { userId: string } }
  | { type: 'USER_LOGOUT'; payload: { reason: string } }
  | { type: 'DATA_LOADED'; payload: { items: Item[]; total: number } }
  | { type: 'ERROR'; payload: { error: AppError } };

// 특정 이벤트 타입 추출
type EventPayload<T extends AppEvent['type']> =
  Extract<AppEvent, { type: T }>['payload'];

// EventPayload<'USER_LOGIN'> → { userId: string }

// 타입 안전한 이벤트 핸들러
type EventHandler<T extends AppEvent['type']> = (
  payload: EventPayload<T>,
) => void | Promise<void>;
```

---

## Builder 패턴과 타입

설정 객체를 단계적으로 구성할 때 타입 안전한 빌더를 사용한다.

```typescript
interface QueryConfig {
  table: string;
  where?: Record<string, unknown>;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

// 필수 필드를 강제하는 빌더
class QueryBuilder<T extends Partial<QueryConfig> = {}> {
  private config: T;

  private constructor(config: T) {
    this.config = config;
  }

  static create(): QueryBuilder<{}> {
    return new QueryBuilder({});
  }

  from(table: string): QueryBuilder<T & { table: string }> {
    return new QueryBuilder({ ...this.config, table });
  }

  where(conditions: Record<string, unknown>): QueryBuilder<T & { where: Record<string, unknown> }> {
    return new QueryBuilder({ ...this.config, where: conditions });
  }

  // build는 table이 설정된 경우에만 호출 가능
  build(this: QueryBuilder<T & { table: string }>): QueryConfig {
    return this.config as unknown as QueryConfig;
  }
}

// 사용
QueryBuilder.create().from('users').where({ active: true }).build(); // ✅
// QueryBuilder.create().where({ active: true }).build(); // ❌ 컴파일 에러
```

---

## Template Literal Types

```typescript
// API 경로 타입 안전하게 정의
type ApiVersion = 'v1' | 'v2';
type Resource = 'users' | 'orders' | 'products';
type ApiPath = `/${ApiVersion}/${Resource}`;
// → '/v1/users' | '/v1/orders' | '/v1/products' | '/v2/users' | ...

// 이벤트 이름 패턴
type DomainEvent = `${Lowercase<Resource>}.${'created' | 'updated' | 'deleted'}`;
// → 'users.created' | 'users.updated' | ... | 'products.deleted'

// CSS 값 타입
type CSSUnit = 'px' | 'rem' | 'em' | '%';
type CSSValue = `${number}${CSSUnit}`;
```

---

## Conditional & Mapped Types

```typescript
// 조건부 타입: 비동기 함수만 추출
type AsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never;
}[keyof T];

// Readonly deep
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// Optional 필드만 추출
type OptionalKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];

// API 응답 타입 자동 생성
type ApiResponse<T> = {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
  };
};

type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
```

---

## Type Guard 패턴

```typescript
// 기본 type guard
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Discriminated union guard
function isConnected(
  state: ConnectionState,
): state is Extract<ConnectionState, { status: 'connected' }> {
  return state.status === 'connected';
}

// Assertion function (throw on failure)
function assertDefined<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value == null) {
    throw new Error(`Expected ${name} to be defined, got ${String(value)}`);
  }
}

// Zod 기반 type guard
function isUser(data: unknown): data is User {
  return userSchema.safeParse(data).success;
}

// Array narrowing
function isNonEmpty<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}
```

---

## Utility Type 조합

자주 사용하는 프로젝트 전용 유틸리티 타입:

```typescript
// Nullable
type Nullable<T> = T | null;

// 특정 필드만 필수로
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// 특정 필드만 Optional로
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// 재귀적 Partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 함수의 첫 번째 파라미터 타입 추출
type FirstParam<T extends (...args: any[]) => any> = Parameters<T>[0];

// Promise 내부 타입 추출
type Awaited<T> = T extends Promise<infer U> ? U : T;

// 엄격한 Omit (존재하는 키만 생략 가능)
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```
