// ---------------------------------------------------------------------------
// Card Entity & Deck Data Model
// ---------------------------------------------------------------------------

/**
 * 카드 타입: 공격(ATTACK) 또는 수비(GUARD).
 * 향후 확장(예: 마법)을 위해 const object + union 패턴 사용.
 */
export const CARD_TYPE = {
    ATTACK: 'ATTACK',
    GUARD: 'GUARD',
} as const;

export type CardType = (typeof CARD_TYPE)[keyof typeof CARD_TYPE];

// ---------------------------------------------------------------------------
// Card Keywords (TASK-034)
// ---------------------------------------------------------------------------

/** 카드에 부여할 수 있는 키워드. */
export const CARD_KEYWORD = {
    /** 전투 중 피해 흡수 수치 부여. 턴 종료 시 0으로 초기화. */
    BLOCK: 'BLOCK',
    /** 사용 후 덱/버림패가 아닌 제거 영역으로 이동 (영구 제거). */
    EXHAUST: 'EXHAUST',
    /** 턴 종료 시 버리지 않고 손패에 유지. */
    RETAIN: 'RETAIN',
} as const;

export type CardKeyword = (typeof CARD_KEYWORD)[keyof typeof CARD_KEYWORD];

// ---------------------------------------------------------------------------
// Card Effect Types (TASK-034)
// ---------------------------------------------------------------------------

/** 카드 효과 유형. 데이터 기반 효과 적용에 사용. */
export const CARD_EFFECT_TYPE = {
    DAMAGE: 'DAMAGE',
    BLOCK: 'BLOCK',
    STATUS_EFFECT: 'STATUS_EFFECT',
    FLEE: 'FLEE',
} as const;

export type CardEffectType = (typeof CARD_EFFECT_TYPE)[keyof typeof CARD_EFFECT_TYPE];

// ---------------------------------------------------------------------------
// Card Rarity (TASK-034)
// ---------------------------------------------------------------------------

/** 카드 희귀도. 드랍 확률과 UI 표시에 사용. */
export const CARD_RARITY = {
    COMMON: 'COMMON',
    RARE: 'RARE',
} as const;

export type CardRarity = (typeof CARD_RARITY)[keyof typeof CARD_RARITY];

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

/** 전투에서 사용하는 행동 단위. */
export interface Card {
    readonly id: string;
    readonly name: string;
    readonly type: CardType;
    readonly power: number;
    /** 에너지 비용 (0~3). */
    readonly cost: number;
    /** 키워드 목록. */
    readonly keywords: readonly CardKeyword[];
    /** 효과 유형. */
    readonly effectType: CardEffectType;
    /** 카드 희귀도. */
    readonly rarity: CardRarity;
    /** 상태이상 효과 시 대상 상태와 지속 턴수. */
    readonly statusEffect?: {
        readonly type: string;
        readonly duration: number;
    };
    /** 사용 조건 (예: HP 5 이하). */
    readonly condition?: {
        readonly type: string;
        readonly value: number;
    };
}

// ---------------------------------------------------------------------------
// Card Factory
// ---------------------------------------------------------------------------

let nextCardSequence = 0;

/** createCard 팩토리에 전달하는 파라미터. 확장 필드는 모두 선택적. */
export interface CreateCardParams {
    readonly name: string;
    readonly type: CardType;
    readonly power: number;
    readonly id?: string;
    readonly cost?: number;
    readonly keywords?: readonly CardKeyword[];
    readonly effectType?: CardEffectType;
    readonly rarity?: CardRarity;
    readonly statusEffect?: { readonly type: string; readonly duration: number };
    readonly condition?: { readonly type: string; readonly value: number };
}

/** 고유 ID를 자동 생성하며 카드 인스턴스를 만든다. */
export function createCard(params: CreateCardParams): Card {
    const id = params.id ?? `card-${++nextCardSequence}`;
    const defaultEffectType = params.type === CARD_TYPE.ATTACK
        ? CARD_EFFECT_TYPE.DAMAGE
        : CARD_EFFECT_TYPE.BLOCK;

    return {
        id,
        name: params.name,
        type: params.type,
        power: Math.max(0, Math.floor(params.power)),
        cost: params.cost ?? 0,
        keywords: params.keywords ?? [],
        effectType: params.effectType ?? defaultEffectType,
        rarity: params.rarity ?? CARD_RARITY.COMMON,
        statusEffect: params.statusEffect,
        condition: params.condition,
    };
}

/** 테스트 용도 — 시퀀스 카운터를 리셋한다. */
export function resetCardSequence(): void {
    nextCardSequence = 0;
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

/** 덱 최대 크기 (PLAN-TBD-001 임시 값) */
export const DECK_MAX_SIZE = 20;

/** 플레이어가 보유한 카드의 순서 있는 컬렉션. */
export interface Deck {
    readonly cards: readonly Card[];
    readonly maxSize: number;
}

/** 빈 덱을 생성한다. */
export function createDeck(maxSize: number = DECK_MAX_SIZE): Deck {
    return { cards: [], maxSize };
}

/** 덱에 카드를 추가한다. 상한 초과 시 추가하지 않고 false를 반환한다. */
export function addCardToDeck(deck: Deck, card: Card): { deck: Deck; added: boolean } {
    if (deck.cards.length >= deck.maxSize) {
        return { deck, added: false };
    }
    return {
        deck: { ...deck, cards: [...deck.cards, card] },
        added: true,
    };
}

/** 덱에서 특정 ID의 카드를 제거한다. 해당 카드가 없으면 false를 반환한다. */
export function removeCardFromDeck(deck: Deck, cardId: string): { deck: Deck; removed: boolean } {
    const index = deck.cards.findIndex((c) => c.id === cardId);
    if (index === -1) {
        return { deck, removed: false };
    }
    const nextCards = [...deck.cards.slice(0, index), ...deck.cards.slice(index + 1)];
    return {
        deck: { ...deck, cards: nextCards },
        removed: true,
    };
}

/** 덱이 가득 찼는지 확인한다. */
export function isDeckFull(deck: Deck): boolean {
    return deck.cards.length >= deck.maxSize;
}

/** 덱의 카드 수를 반환한다. */
export function getDeckSize(deck: Deck): number {
    return deck.cards.length;
}
