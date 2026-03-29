# 테스트 작성 가이드

> TypeScript 프로젝트의 테스트 컨벤션과 패턴.
> 테스트 코드를 작성하거나 리뷰할 때 이 문서를 참조한다.

## 목차

1. [테스트 구조](#테스트-구조)
2. [네이밍 규칙](#네이밍-규칙)
3. [Arrange-Act-Assert](#arrange-act-assert)
4. [모킹 패턴](#모킹-패턴)
5. [비동기 테스트](#비동기-테스트)
6. [테스트 유틸리티](#테스트-유틸리티)
7. [안티패턴](#안티패턴)

---

## 테스트 구조

### 파일 배치

```
src/
├── services/
│   ├── user-service.ts
│   └── user-service.test.ts    # ← colocated
├── utils/
│   ├── parser.ts
│   └── parser.test.ts
└── __tests__/
    └── integration/            # 통합 테스트만 별도 디렉토리
        └── api.test.ts
```

### describe 블록 구조

```typescript
describe('UserService', () => {
  // 공통 setup
  let service: UserService;
  let mockRepo: MockRepository;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new UserService(mockRepo);
  });

  describe('findById', () => {
    it('returns user when found', async () => { ... });
    it('returns NOT_FOUND error when user does not exist', async () => { ... });
    it('returns NETWORK error when repository fails', async () => { ... });
  });

  describe('create', () => {
    it('creates user with valid input', async () => { ... });
    it('returns VALIDATION error for invalid email', async () => { ... });
  });
});
```

---

## 네이밍 규칙

### 테스트 파일

- `*.test.ts` (unit) / `*.integration.test.ts` / `*.e2e.test.ts`
- 원본 파일명과 동일하게: `parser.ts` → `parser.test.ts`

### describe 블록

- 최상위: 테스트 대상 (클래스명, 모듈명)
- 중첩: 메서드명 또는 시나리오 그룹

### it/test 문장

**패턴: `동사 + 결과 + 조건`**

```typescript
// ✅ 좋은 예
it('returns user when found', ...);
it('throws VALIDATION error for empty name', ...);
it('retries up to 3 times on network failure', ...);

// ❌ 나쁜 예
it('should work', ...);
it('test findById', ...);
it('user test', ...);
```

---

## Arrange-Act-Assert

모든 테스트는 AAA 패턴을 따른다:

```typescript
it('calculates total with discount applied', () => {
  // Arrange — 테스트 데이터와 환경 준비
  const items: Item[] = [
    { name: 'Widget', price: 100, quantity: 2 },
    { name: 'Gadget', price: 50, quantity: 1 },
  ];
  const discount = 0.1; // 10%

  // Act — 테스트 대상 실행
  const total = calculateTotal(items, { discount });

  // Assert — 결과 검증
  expect(total).toBe(225); // (200 + 50) * 0.9
});
```

### 규칙

- 각 섹션 사이에 빈 줄 하나
- Act는 **단일 호출**이어야 한다
- Assert에서 **하나의 동작**만 검증한다 (하나의 논리적 단위)

---

## 모킹 패턴

### 의존성 주입 + 인터페이스 모킹

```typescript
// 인터페이스 정의
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// 모킹 팩토리
function createMockUserRepository(
  overrides: Partial<UserRepository> = {},
): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// 테스트에서 사용
it('returns NOT_FOUND when user does not exist', async () => {
  const repo = createMockUserRepository({
    findById: vi.fn().mockResolvedValue(null),
  });
  const service = createUserService(repo);

  const result = await service.findById('non-existent');

  expect(result).toEqual({
    ok: false,
    error: expect.objectContaining({ code: 'NOT_FOUND' }),
  });
});
```

### 외부 모듈 모킹

```typescript
// 모듈 레벨 모킹
vi.mock('@/adapters/http-client', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// 테스트별 동작 지정
import { httpClient } from '@/adapters/http-client';
const mockGet = vi.mocked(httpClient.get);

it('fetches data from API', async () => {
  mockGet.mockResolvedValueOnce({ data: testData, status: 200 });
  // ...
});
```

---

## 비동기 테스트

```typescript
// ✅ async/await 사용
it('fetches user data', async () => {
  const result = await service.fetchUser('u-123');
  expect(result.ok).toBe(true);
});

// ✅ 에러 비동기 테스트
it('rejects with NetworkError on timeout', async () => {
  mockClient.get.mockRejectedValueOnce(new TimeoutError());

  const result = await service.fetchUser('u-123');

  expect(result).toEqual({
    ok: false,
    error: expect.objectContaining({ code: 'NETWORK' }),
  });
});

// ✅ 타이머 테스트
it('retries after delay', async () => {
  vi.useFakeTimers();

  const promise = service.fetchWithRetry('u-123');
  await vi.advanceTimersByTimeAsync(3000);
  const result = await promise;

  expect(mockClient.get).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});
```

---

## 테스트 유틸리티

### 팩토리 함수 (Test Fixtures)

```typescript
// test-utils/factories.ts
function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'member',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'test-order-id',
    userId: 'test-user-id',
    items: [],
    status: 'pending',
    ...overrides,
  };
}

// 테스트에서
it('activates user', async () => {
  const user = createTestUser({ role: 'admin' });
  // ...
});
```

### Custom Matchers

```typescript
// test-utils/matchers.ts
expect.extend({
  toBeOk(received: Result<unknown>) {
    return {
      pass: received.ok === true,
      message: () =>
        `Expected Result to be ok, got error: ${
          !received.ok ? JSON.stringify(received.error) : ''
        }`,
    };
  },

  toBeErr(received: Result<unknown>, expectedCode?: string) {
    const pass = received.ok === false &&
      (!expectedCode || received.error.code === expectedCode);
    return {
      pass,
      message: () =>
        `Expected Result to be error${expectedCode ? ` with code ${expectedCode}` : ''}`,
    };
  },
});
```

---

## 안티패턴

### ❌ 피해야 할 것들

```typescript
// ❌ 구현 세부사항 테스트
it('calls repository.save exactly once', async () => {
  await service.create(input);
  expect(repo.save).toHaveBeenCalledTimes(1); // 행동이 아닌 구현 검증
});

// ❌ 스냅샷 남용
it('renders correctly', () => {
  expect(renderComponent()).toMatchSnapshot(); // 무엇을 검증하는지 불명확
});

// ❌ 테스트 간 상태 공유
let sharedUser: User;
beforeAll(() => { sharedUser = createUser(); }); // 테스트 간 결합

// ❌ 조건부 로직이 있는 테스트
it('handles both cases', () => {
  if (env === 'prod') {
    expect(result).toBe(a);
  } else {
    expect(result).toBe(b); // 테스트 안에 if문 금지
  }
});
```

### ✅ 대신 이렇게

```typescript
// ✅ 행동(결과) 검증
it('creates user and returns created user', async () => {
  const result = await service.create(input);
  expect(result).toBeOk();
  expect(result.data.name).toBe(input.name);
});

// ✅ 명시적 assertion
it('renders user name in header', () => {
  const { getByRole } = render(<Header user={testUser} />);
  expect(getByRole('heading')).toHaveTextContent('Test User');
});

// ✅ 각 테스트 독립적
beforeEach(() => {
  user = createTestUser(); // 매 테스트마다 새로 생성
});

// ✅ 케이스 분리
it.each([
  ['prod', expectedA],
  ['dev', expectedB],
])('returns %s result in %s env', (env, expected) => {
  expect(getResult(env)).toBe(expected);
});
```
