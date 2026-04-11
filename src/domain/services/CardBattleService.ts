// ---------------------------------------------------------------------------
// Card Battle Service — 배틀 진입, 드로우, 적 카드 풀 관리
// ---------------------------------------------------------------------------

import {
    CARD_EFFECT_TYPE,
    CARD_TYPE,
    createCard,
    type Card,
} from '../entities/Card';
import type { EnemyArchetypeId, EnemyKind } from '../entities/Enemy';

// ---------------------------------------------------------------------------
// Random Source (DI for testing)
// ---------------------------------------------------------------------------

export interface BattleRandomSource {
    /** 0 이상 1 미만의 난수를 반환한다. */
    next(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HAND_SIZE = 3;

// ---------------------------------------------------------------------------
// Enemy Card Pool Templates
// ---------------------------------------------------------------------------

export interface EnemyCardPoolTemplate {
    readonly attackCount: number;
    readonly guardCount: number;
    readonly attackPower: number;
    readonly guardPower: number;
    readonly flurryHitCount: number;
    readonly flurryPower: number;
}

/**
 * 적 종류별 카드 풀 템플릿.
 * - normal: 공격 2장, 수비 1장
 * - elite: 공격 3장, 수비 2장
 * - boss: 공격 4장, 수비 3장
 */
export const ENEMY_CARD_POOL_TEMPLATES: Record<string, EnemyCardPoolTemplate> = {
    normal: { attackCount: 2, guardCount: 1, attackPower: 6, guardPower: 4, flurryHitCount: 2, flurryPower: 3 },
    elite: { attackCount: 3, guardCount: 2, attackPower: 8, guardPower: 6, flurryHitCount: 3, flurryPower: 3 },
    boss: { attackCount: 4, guardCount: 3, attackPower: 10, guardPower: 8, flurryHitCount: 4, flurryPower: 3 },
};

// ---------------------------------------------------------------------------
// Draw Result
// ---------------------------------------------------------------------------

export interface DrawResult {
    readonly hand: readonly Card[];
    readonly deckSize: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CardBattleService {
    constructor(
        private readonly random: BattleRandomSource = { next: () => Math.random() },
    ) {}

    /**
     * 덱에서 무작위 카드를 뽑아 손패를 구성한다.
     * - 덱을 소모하지 않음 (매 라운드 전체 덱에서 새로 뽑음)
     * - 최대 HAND_SIZE(3)장, 덱이 부족하면 남은 전부
     * - 중복 없이 선택
     */
    drawHand(deck: readonly Card[], handSize: number = HAND_SIZE): DrawResult {
        const drawCount = Math.min(handSize, deck.length);

        if (drawCount === 0) {
            return { hand: [], deckSize: deck.length };
        }

        // Fisher-Yates 셔플의 부분 적용 (drawCount만큼만 셔플)
        const indices = deck.map((_, i) => i);
        for (let i = indices.length - 1; i > indices.length - 1 - drawCount && i > 0; i--) {
            const j = Math.floor(this.random.next() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const hand = indices.slice(indices.length - drawCount).map((idx) => deck[idx]);

        return { hand, deckSize: deck.length };
    }

    /**
     * 적의 카드 풀에서 무작위 1장을 선택한다.
     */
    selectEnemyCard(enemyCardPool: readonly Card[]): Card {
        if (enemyCardPool.length === 0) {
            throw new Error('Enemy card pool is empty');
        }
        const index = Math.floor(this.random.next() * enemyCardPool.length);
        return enemyCardPool[index];
    }

    /**
     * 적 종류(normal/elite/boss)에 따른 카드 풀을 생성한다.
     * floorNumber로 파워를 스케일링할 수 있다 (기본값: 스케일링 없음).
     */
    generateEnemyCardPool(
        kind: EnemyKind,
        isElite: boolean,
        archetypeId?: EnemyArchetypeId,
    ): readonly Card[] {
        if (archetypeId) {
            return this.generateEnemyFamilyCardPool(kind, isElite, archetypeId);
        }

        const templateKey = isElite ? 'elite' : kind;
        const template = ENEMY_CARD_POOL_TEMPLATES[templateKey] ?? ENEMY_CARD_POOL_TEMPLATES['normal'];

        const cards: Card[] = [];

        const strikeCount = Math.max(0, template.attackCount - 1);

        for (let i = 0; i < strikeCount; i++) {
            cards.push(createCard({
                name: `Enemy Strike ${i + 1}`,
                type: CARD_TYPE.ATTACK,
                power: template.attackPower,
            }));
        }

        if (template.attackCount > 0) {
            cards.push(createCard({
                name: `Enemy Flurry ${template.flurryHitCount}`,
                type: CARD_TYPE.ATTACK,
                power: template.flurryPower,
                effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                hitCount: template.flurryHitCount,
                effectPayload: { hitCount: template.flurryHitCount },
            }));
        }

        for (let i = 0; i < template.guardCount; i++) {
            cards.push(createCard({
                name: `Enemy Block ${i + 1}`,
                type: CARD_TYPE.GUARD,
                power: template.guardPower,
            }));
        }

        return cards;
    }

    private generateEnemyFamilyCardPool(
        kind: EnemyKind,
        isElite: boolean,
        archetypeId: EnemyArchetypeId,
    ): readonly Card[] {
        const multiplier = kind === 'boss' ? 2 : isElite ? 1.35 : 1;
        const scale = (value: number) => Math.max(1, Math.round(value * multiplier));

        switch (archetypeId) {
            case 'ash-crawler':
                return [
                    this.createEnemyAttack('Ash Cult Strike', scale(6)),
                    createCard({
                        name: 'Ash Ritual',
                        type: CARD_TYPE.POWER,
                        power: 0,
                        effectType: CARD_EFFECT_TYPE.BUFF,
                    }),
                    createCard({
                        name: 'Ash Curse Dread',
                        type: CARD_TYPE.POWER,
                        power: 0,
                        effectType: CARD_EFFECT_TYPE.BUFF,
                    }),
                ];
            case 'mire-broodling':
                return [
                    createCard({
                        name: 'Mire Venom',
                        type: CARD_TYPE.ATTACK,
                        power: scale(4),
                        effectType: CARD_EFFECT_TYPE.DAMAGE,
                        statusEffects: [
                            { type: 'POISON', duration: 3 },
                            { type: 'FRAIL', duration: 1 },
                        ],
                    }),
                    createCard({
                        name: 'Mire Frailty',
                        type: CARD_TYPE.ATTACK,
                        power: scale(3),
                        effectType: CARD_EFFECT_TYPE.DAMAGE,
                        statusEffect: { type: 'FRAIL', duration: 1 },
                    }),
                    createCard({
                        name: 'Mire Cleanse Poison',
                        type: CARD_TYPE.GUARD,
                        power: scale(5),
                        effectType: CARD_EFFECT_TYPE.BLOCK,
                    }),
                ];
            case 'blade-raider':
                return [
                    createCard({
                        name: 'Blade Flurry 3',
                        type: CARD_TYPE.ATTACK,
                        power: scale(3),
                        effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                        hitCount: 3,
                        effectPayload: { hitCount: 3 },
                    }),
                    this.createEnemyAttack('Blade Charge 12', scale(12)),
                    this.createEnemyAttack('Blade Ambush 7', scale(7)),
                ];
            case 'dread-sentinel':
                return [
                    this.createEnemyAttack('Sentinel Strike', scale(7)),
                    createCard({
                        name: 'Sentinel Guard',
                        type: CARD_TYPE.GUARD,
                        power: scale(8),
                        effectType: CARD_EFFECT_TYPE.BLOCK,
                    }),
                    createCard({
                        name: 'Sentinel Thorn Guard',
                        type: CARD_TYPE.GUARD,
                        power: scale(5),
                        effectType: CARD_EFFECT_TYPE.BLOCK,
                        effectPayload: {
                            buff: { type: 'THORNS', value: scale(2), duration: 2, target: 'SELF' },
                        },
                    }),
                ];
            case 'final-boss':
                return [
                    this.createEnemyAttack('Boss Charge 18', scale(9)),
                    createCard({
                        name: 'Boss Flurry 4',
                        type: CARD_TYPE.ATTACK,
                        power: scale(3),
                        effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                        hitCount: 4,
                        effectPayload: { hitCount: 4 },
                    }),
                    createCard({
                        name: 'Boss Purge Poison',
                        type: CARD_TYPE.GUARD,
                        power: scale(7),
                        effectType: CARD_EFFECT_TYPE.BLOCK,
                    }),
                    createCard({
                        name: 'Boss Dread Curse',
                        type: CARD_TYPE.POWER,
                        power: 0,
                        effectType: CARD_EFFECT_TYPE.BUFF,
                    }),
                ];
        }
    }

    private createEnemyAttack(name: string, power: number): Card {
        return createCard({
            name,
            type: CARD_TYPE.ATTACK,
            power,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
    }
}
