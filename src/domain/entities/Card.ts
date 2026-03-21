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
// Card
// ---------------------------------------------------------------------------

/** 전투에서 사용하는 행동 단위. 타입과 파워를 가진다. */
export interface Card {
    readonly id: string;
    readonly name: string;
    readonly type: CardType;
    readonly power: number;
}

// ---------------------------------------------------------------------------
// Card Factory
// ---------------------------------------------------------------------------

let nextCardSequence = 0;

/** 고유 ID를 자동 생성하며 카드 인스턴스를 만든다. */
export function createCard(params: {
    name: string;
    type: CardType;
    power: number;
    id?: string;
}): Card {
    const id = params.id ?? `card-${++nextCardSequence}`;
    return {
        id,
        name: params.name,
        type: params.type,
        power: Math.max(0, Math.floor(params.power)),
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
