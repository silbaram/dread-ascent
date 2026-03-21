// ---------------------------------------------------------------------------
// Card Drop Service — 적 처치 시 카드 드롭 및 덱 추가 (순수 도메인 로직)
// ---------------------------------------------------------------------------

import { CARD_TYPE, createCard, type Card, type CardType } from '../entities/Card';
import type { EnemyKind } from '../entities/Enemy';
import type { DeckService } from './DeckService';

// ---------------------------------------------------------------------------
// Random Source (DI for testing)
// ---------------------------------------------------------------------------

export interface DropRandomSource {
    /** 0 이상 1 미만의 난수를 반환한다. */
    next(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 일반 적 카드 드롭 확률 (PLAN-TBD-002 임시 값) */
export const NORMAL_DROP_RATE = 0.3;

/** 엘리트 적 카드 드롭 확률 */
export const ELITE_DROP_RATE = 0.6;

/** 보스 카드 드롭 확률 */
export const BOSS_DROP_RATE = 1.0;

/** 드롭 카드 기본 파워 */
export const BASE_DROP_CARD_POWER = 5;

/** 층당 파워 스케일링 계수 (PLAN-TBD-003 임시 값) */
export const POWER_SCALING_PER_FLOOR = 0.5;

/** 드롭 카드 이름 — 공격 */
const ATTACK_CARD_NAMES: readonly string[] = [
    'Wild Slash',
    'Reckless Strike',
    'Savage Blow',
    'Piercing Thrust',
];

/** 드롭 카드 이름 — 수비 */
const GUARD_CARD_NAMES: readonly string[] = [
    'Iron Guard',
    'Stalwart Block',
    'Stone Wall',
    'Parry Stance',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 카드 드롭 판정 결과 */
export type CardDropResult =
    | { readonly dropped: false }
    | {
          readonly dropped: true;
          readonly card: Card;
          readonly addedToDeck: boolean;
          readonly deckFull: boolean;
      };

/** 덱이 가득 찼을 때 교체 처리 결과 */
export type CardSwapResult =
    | { readonly swapped: true; readonly removedCard: Card; readonly addedCard: Card }
    | { readonly swapped: false; readonly reason: 'card-not-found' | 'cancelled' };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * 적 처치 시 카드 드롭 확률 판정 및 덱 추가를 담당한다.
 * 도메인 순수 로직으로, Phaser 의존 없음.
 */
export class CardDropService {
    private readonly random: DropRandomSource;

    constructor(random?: DropRandomSource) {
        this.random = random ?? { next: () => Math.random() };
    }

    /**
     * 적 처치 시 카드 드롭을 판정한다.
     *
     * @param enemyKind 적 종류 (normal / boss)
     * @param isElite 엘리트 여부
     * @param floorNumber 현재 층 번호
     * @param deckService 플레이어 덱 서비스
     * @returns 드롭 결과
     */
    rollCardDrop(
        enemyKind: EnemyKind,
        isElite: boolean,
        floorNumber: number,
        deckService: DeckService,
    ): CardDropResult {
        const dropRate = this.getDropRate(enemyKind, isElite);
        const roll = this.random.next();

        if (roll >= dropRate) {
            return { dropped: false };
        }

        const card = this.generateDropCard(floorNumber);
        const added = deckService.addCard(card);

        return {
            dropped: true,
            card,
            addedToDeck: added,
            deckFull: !added,
        };
    }

    /**
     * 덱이 가득 찬 상태에서 기존 카드를 교체한다.
     *
     * @param removeCardId 제거할 기존 카드 ID
     * @param newCard 추가할 새 카드
     * @param deckService 플레이어 덱 서비스
     * @returns 교체 결과
     */
    swapCard(
        removeCardId: string,
        newCard: Card,
        deckService: DeckService,
    ): CardSwapResult {
        const existingCard = deckService.findCard(removeCardId);
        if (!existingCard) {
            return { swapped: false, reason: 'card-not-found' };
        }

        const removedCard: Card = { ...existingCard };
        deckService.removeCard(removeCardId);
        deckService.addCard(newCard);

        return {
            swapped: true,
            removedCard,
            addedCard: newCard,
        };
    }

    /**
     * 적 종류에 따른 드롭 확률을 반환한다.
     */
    getDropRate(enemyKind: EnemyKind, isElite: boolean): number {
        if (enemyKind === 'boss') {
            return BOSS_DROP_RATE;
        }
        if (isElite) {
            return ELITE_DROP_RATE;
        }
        return NORMAL_DROP_RATE;
    }

    /**
     * 층 기반 파워를 계산하여 드롭 카드를 생성한다.
     * 타입(공격/수비)은 무작위로 결정된다.
     */
    generateDropCard(floorNumber: number): Card {
        const power = this.calculateScaledPower(floorNumber);
        const type = this.randomCardType();
        const name = this.randomCardName(type);

        return createCard({ name, type, power });
    }

    /**
     * 층 기반 파워 스케일링 공식.
     * basePower + floor * 0.5 (소수점 반올림)
     */
    calculateScaledPower(floorNumber: number): number {
        return Math.round(BASE_DROP_CARD_POWER + floorNumber * POWER_SCALING_PER_FLOOR);
    }

    // -----------------------------------------------------------------------
    // Private Helpers
    // -----------------------------------------------------------------------

    private randomCardType(): CardType {
        return this.random.next() < 0.5 ? CARD_TYPE.ATTACK : CARD_TYPE.GUARD;
    }

    private randomCardName(type: CardType): string {
        const names = type === CARD_TYPE.ATTACK ? ATTACK_CARD_NAMES : GUARD_CARD_NAMES;
        const index = Math.floor(this.random.next() * names.length);
        return names[index];
    }
}
