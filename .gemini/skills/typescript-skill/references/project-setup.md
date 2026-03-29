# 프로젝트 설정 레퍼런스

> tsconfig, ESLint, Prettier 등 프로젝트 초기 설정 템플릿.
> 새 프로젝트 생성 또는 기존 설정을 점검할 때 참조한다.

## 목차

1. [tsconfig.json](#tsconfigjson)
2. [ESLint (Flat Config)](#eslint-flat-config)
3. [Prettier](#prettier)
4. [package.json Scripts](#packagejson-scripts)
5. [.gitignore](#gitignore)

---

## tsconfig.json

### 엄격 모드 (권장 기본값)

```jsonc
{
  "compilerOptions": {
    // 타입 안전성 — 모두 켜기
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    // 모듈
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    // 출력
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // 품질
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,

    // Path alias
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 주요 옵션 설명

| 옵션 | 이유 |
|------|------|
| `noUncheckedIndexedAccess` | 인덱스 접근 시 `undefined` 가능성 강제 체크 |
| `exactOptionalPropertyTypes` | `?:` 필드에 `undefined` 명시적 할당 방지 |
| `verbatimModuleSyntax` | import/export 구문을 있는 그대로 유지 |
| `moduleResolution: "bundler"` | Vite, esbuild 등 번들러 환경에 최적 |
| `isolatedModules` | 파일 단위 트랜스파일 호환 보장 |

### Node.js 백엔드용 추가 설정

```jsonc
{
  "compilerOptions": {
    // 위 기본값에 추가
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",

    // Node.js 타입
    "types": ["node", "vitest/globals"]
  }
}
```

---

## ESLint (Flat Config)

ESLint 9+ flat config 형식을 사용한다.

### eslint.config.ts

```typescript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 타입 안전성
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // 코드 품질
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // 스타일
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should', 'will', 'did'],
        },
      ],

      // 금지 패턴
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // 테스트 파일 완화
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.*'],
  },
);
```

---

## Prettier

### prettier.config.js

```javascript
/** @type {import('prettier').Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  quoteProps: 'as-needed',
};
```

---

## package.json Scripts

```jsonc
{
  "scripts": {
    // 개발
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.build.json",
    "start": "node dist/index.js",

    // 품질 체크
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts'",

    // 테스트
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",

    // CI
    "ci": "npm run typecheck && npm run lint && npm run test",

    // 유틸
    "clean": "rm -rf dist coverage"
  }
}
```

---

## .gitignore

```gitignore
# Build
dist/
out/
build/

# Dependencies
node_modules/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Test & Coverage
coverage/
*.lcov

# Cache
.eslintcache
.tsbuildinfo
*.tsbuildinfo

# Debug
npm-debug.log*
yarn-debug.log*
```

---

## 의존성 최소 세트

새 프로젝트 시작 시 권장하는 최소 devDependencies:

```bash
# 타입스크립트 코어
npm i -D typescript @types/node tsx

# 린팅 & 포맷팅
npm i -D eslint @eslint/js typescript-eslint eslint-config-prettier prettier

# 테스트
npm i -D vitest @vitest/coverage-v8

# (선택) 런타임 validation
npm i zod
```
