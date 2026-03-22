// ---------------------------------------------------------------------------
// Deck Management Service
// ---------------------------------------------------------------------------

import {
    CARD_TYPE,
    DECK_MAX_SIZE,
    addCardToDeck,
    createDeck,
    getDeckSize,
    isDeckFull,
    removeCardFromDeck,
    type Card,
    type Deck,
} from '../entities/Card';
import { createStarterDeckCards } from '../entities/CardCatalog';

// ---------------------------------------------------------------------------
// Legacy Default Deck Constants (Cycle 2 — 후방 호환용)
// ---------------------------------------------------------------------------

export const DEFAULT_ATTACK_CARD_POWER = 8;
export const DEFAULT_GUARD_CARD_POWER = 5;
export const DEFAULT_ATTACK_CARD_COUNT = 3;
export const DEFAULT_GUARD_CARD_COUNT = 2;

/** @deprecated Cycle 3에서는 CardCatalog의 STARTER_DECK_COMPOSITION 사용. */
export const STARTER_DECK_TEMPLATE: readonly { name: string; type: Card['type']; power: number }[] = [
    { name: 'Slash', type: CARD_TYPE.ATTACK, power: DEFAULT_ATTACK_CARD_POWER },
    { name: 'Thrust', type: CARD_TYPE.ATTACK, power: DEFAULT_ATTACK_CARD_POWER },
    { name: 'Cleave', type: CARD_TYPE.ATTACK, power: DEFAULT_ATTACK_CARD_POWER },
    { name: 'Shield Block', type: CARD_TYPE.GUARD, power: DEFAULT_GUARD_CARD_POWER },
    { name: 'Brace', type: CARD_TYPE.GUARD, power: DEFAULT_GUARD_CARD_POWER },
];

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface DeckSnapshot {
    readonly cards: readonly Card[];
    readonly size: number;
    readonly maxSize: number;
    readonly isFull: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DeckService {
    private deck: Deck;

    constructor(private readonly maxSize: number = DECK_MAX_SIZE) {
        this.deck = createDeck(maxSize);
    }

    /** 새 런 시작 시 기본 덱으로 초기화한다. Cycle 3 카드 카탈로그 기반. */
    initializeStarterDeck(): DeckSnapshot {
        this.deck = createDeck(this.maxSize);

        const starterCards = createStarterDeckCards();
        for (const card of starterCards) {
            const result = addCardToDeck(this.deck, card);
            this.deck = result.deck;
        }

        return this.getSnapshot();
    }

    /** 덱에 카드를 추가한다. 상한 초과 시 false를 반환한다. */
    addCard(card: Card): boolean {
        const result = addCardToDeck(this.deck, card);
        if (!result.added) {
            return false;
        }
        this.deck = result.deck;
        return true;
    }

    /** 덱에서 카드를 ID로 제거한다. 해당 카드가 없으면 false를 반환한다. */
    removeCard(cardId: string): boolean {
        const result = removeCardFromDeck(this.deck, cardId);
        if (!result.removed) {
            return false;
        }
        this.deck = result.deck;
        return true;
    }

    /** 현재 덱의 모든 카드를 반환한다 (읽기 전용). */
    getCards(): readonly Card[] {
        return this.deck.cards;
    }

    /** 특정 ID의 카드를 반환한다. */
    findCard(cardId: string): Card | undefined {
        return this.deck.cards.find((c) => c.id === cardId);
    }

    /** 덱이 가득 찼는지 확인한다. */
    isFull(): boolean {
        return isDeckFull(this.deck);
    }

    /** 현재 덱 상태의 스냅샷을 반환한다. */
    getSnapshot(): DeckSnapshot {
        return {
            cards: [...this.deck.cards],
            size: getDeckSize(this.deck),
            maxSize: this.deck.maxSize,
            isFull: isDeckFull(this.deck),
        };
    }

    /** 런 종료 시 덱을 비운다. */
    resetDeck(): void {
        this.deck = createDeck(this.maxSize);
    }

    /** 저장된 카드 배열로 덱을 복원한다. */
    restoreDeck(cards: readonly Card[]): void {
        this.deck = createDeck(this.maxSize);
        for (const card of cards) {
            const result = addCardToDeck(this.deck, card);
            this.deck = result.deck;
        }
    }
}
