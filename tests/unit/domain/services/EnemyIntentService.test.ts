import { beforeEach, describe, expect, it } from 'vitest';
import type { CombatStats } from '../../../../src/domain/entities/CombatStats';
import { Enemy, type EnemyArchetypeId } from '../../../../src/domain/entities/Enemy';
import {
    CARD_EFFECT_TYPE,
    CARD_TYPE,
    createCard,
    resetCardSequence,
    type Card,
} from '../../../../src/domain/entities/Card';
import {
    ENEMY_INTENT_AMBUSH_REVEAL_RULE,
    ENEMY_INTENT_CHARGE_PHASE,
    ENEMY_INTENT_PATTERN,
    ENEMY_INTENT_TYPE,
    EnemyIntentService,
    type EnemyIntent,
} from '../../../../src/domain/services/EnemyIntentService';

const DEFAULT_STATS: CombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
};

function createEnemy(options?: {
    id?: string;
    archetypeId?: EnemyArchetypeId;
    kind?: 'normal' | 'boss';
    elite?: boolean;
    health?: number;
    maxHealth?: number;
}) {
    const maxHealth = options?.maxHealth ?? DEFAULT_STATS.maxHealth;
    const health = options?.health ?? maxHealth;
    const kind = options?.kind ?? 'normal';
    const archetypeId = options?.archetypeId ?? (kind === 'boss' ? 'final-boss' : 'ash-crawler');

    return new Enemy(
        options?.id ?? (kind === 'boss' ? 'boss-1' : 'enemy-1'),
        'Enemy',
        { x: 1, y: 1 },
        {
            health,
            maxHealth,
            attack: DEFAULT_STATS.attack,
            defense: DEFAULT_STATS.defense,
        },
        25,
        kind,
        archetypeId,
        options?.elite ?? false,
    );
}

function createFamilyCardPool(archetypeId: EnemyArchetypeId): Card[] {
    switch (archetypeId) {
        case 'ash-crawler':
            return [
                createCard({
                    id: 'ash-strike',
                    name: 'Ash Cult Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    id: 'ash-ritual',
                    name: 'Ash Ritual',
                    type: CARD_TYPE.POWER,
                    power: 0,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                }),
                createCard({
                    id: 'ash-curse',
                    name: 'Ash Curse Dread',
                    type: CARD_TYPE.POWER,
                    power: 0,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                }),
            ];
        case 'mire-broodling':
            return [
                createCard({
                    id: 'mire-venom',
                    name: 'Mire Venom',
                    type: CARD_TYPE.ATTACK,
                    power: 4,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    id: 'mire-frailty',
                    name: 'Mire Frailty',
                    type: CARD_TYPE.ATTACK,
                    power: 3,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    id: 'mire-cleanse',
                    name: 'Mire Cleanse Poison',
                    type: CARD_TYPE.GUARD,
                    power: 5,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                }),
            ];
        case 'blade-raider':
            return [
                createCard({
                    id: 'blade-flurry',
                    name: 'Blade Flurry 3',
                    type: CARD_TYPE.ATTACK,
                    power: 3,
                    effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                    hitCount: 3,
                    effectPayload: { hitCount: 3 },
                }),
                createCard({
                    id: 'blade-charge',
                    name: 'Blade Charge 12',
                    type: CARD_TYPE.ATTACK,
                    power: 12,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    id: 'blade-ambush',
                    name: 'Blade Ambush 7',
                    type: CARD_TYPE.ATTACK,
                    power: 7,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ];
        case 'dread-sentinel':
            return [
                createCard({
                    id: 'sentinel-strike',
                    name: 'Sentinel Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 7,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    id: 'sentinel-guard',
                    name: 'Sentinel Guard',
                    type: CARD_TYPE.GUARD,
                    power: 8,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                }),
                createCard({
                    id: 'sentinel-thorn-guard',
                    name: 'Sentinel Thorn Guard',
                    type: CARD_TYPE.GUARD,
                    power: 5,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    effectPayload: {
                        buff: { type: 'THORNS', value: 2, duration: 2, target: 'SELF' },
                    },
                }),
            ];
        case 'final-boss':
            return [
                createCard({
                    id: 'boss-charge',
                    name: 'Boss Charge 18',
                    type: CARD_TYPE.ATTACK,
                    power: 18,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    id: 'boss-flurry',
                    name: 'Boss Flurry 4',
                    type: CARD_TYPE.ATTACK,
                    power: 4,
                    effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                    hitCount: 4,
                    effectPayload: { hitCount: 4 },
                }),
                createCard({
                    id: 'boss-purge',
                    name: 'Boss Purge Poison',
                    type: CARD_TYPE.GUARD,
                    power: 7,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                }),
                createCard({
                    id: 'boss-dread-curse',
                    name: 'Boss Dread Curse',
                    type: CARD_TYPE.POWER,
                    power: 0,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                }),
            ];
    }
}

function decideMany(
    service: EnemyIntentService,
    enemy: Enemy,
    enemyCardPool: readonly Card[],
    count: number,
): EnemyIntent[] {
    return Array.from({ length: count }, () =>
        service.decideNextIntent({ enemy, enemyCardPool }));
}

describe('EnemyIntentService', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    it('runs normal enemy families through deterministic 3-turn pattern tables', () => {
        const cases = [
            {
                archetypeId: 'ash-crawler' as const,
                patterns: [
                    ENEMY_INTENT_PATTERN.STRIKE,
                    ENEMY_INTENT_PATTERN.RITUAL,
                    ENEMY_INTENT_PATTERN.STRIKE,
                    ENEMY_INTENT_PATTERN.STRIKE,
                ],
            },
            {
                archetypeId: 'mire-broodling' as const,
                patterns: [
                    ENEMY_INTENT_PATTERN.CURSE,
                    ENEMY_INTENT_PATTERN.STRIKE,
                    ENEMY_INTENT_PATTERN.CLEANSE,
                    ENEMY_INTENT_PATTERN.CURSE,
                ],
            },
            {
                archetypeId: 'blade-raider' as const,
                patterns: [
                    ENEMY_INTENT_PATTERN.AMBUSH,
                    ENEMY_INTENT_PATTERN.CHARGE,
                    ENEMY_INTENT_PATTERN.CHARGE,
                    ENEMY_INTENT_PATTERN.AMBUSH,
                ],
            },
            {
                archetypeId: 'dread-sentinel' as const,
                patterns: [
                    ENEMY_INTENT_PATTERN.GUARD,
                    ENEMY_INTENT_PATTERN.STRIKE,
                    ENEMY_INTENT_PATTERN.GUARD,
                    ENEMY_INTENT_PATTERN.GUARD,
                ],
            },
        ];

        cases.forEach(({ archetypeId, patterns }) => {
            const enemy = createEnemy({ id: `enemy-${archetypeId}`, archetypeId });
            const service = new EnemyIntentService();
            const intents = decideMany(service, enemy, createFamilyCardPool(archetypeId), 4);

            expect(intents.map((intent) => intent.pattern)).toEqual(patterns);
        });
    });

    it('uses a 4-turn elite timeline with hidden ambush and a delayed charge burst', () => {
        const enemy = createEnemy({
            archetypeId: 'blade-raider',
            elite: true,
        });
        const service = new EnemyIntentService();

        const intents = decideMany(service, enemy, createFamilyCardPool('blade-raider'), 5);

        expect(intents.map((intent) => intent.pattern)).toEqual([
            ENEMY_INTENT_PATTERN.AMBUSH,
            ENEMY_INTENT_PATTERN.CHARGE,
            ENEMY_INTENT_PATTERN.CHARGE,
            ENEMY_INTENT_PATTERN.FLURRY,
            ENEMY_INTENT_PATTERN.AMBUSH,
        ]);
        expect(intents[0]).toMatchObject({
            revealRule: ENEMY_INTENT_AMBUSH_REVEAL_RULE.HIDDEN,
            damage: 7,
            sourceCardId: 'blade-ambush',
        });
        expect(intents[1]).toMatchObject({
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
            damage: 0,
            burstDamage: 12,
            sourceCardId: undefined,
        });
        expect(intents[2]).toMatchObject({
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.BURST,
            damage: 12,
            sourceCardId: 'blade-charge',
        });
    });

    it('uses fixed boss and showdown phase tables instead of weighted rolls', () => {
        const boss = createEnemy({
            id: 'final-boss',
            kind: 'boss',
            archetypeId: 'final-boss',
        });
        const showdownBoss = createEnemy({
            id: 'showdown-final-boss',
            kind: 'boss',
            archetypeId: 'final-boss',
        });
        const bossService = new EnemyIntentService();
        const showdownService = new EnemyIntentService();

        const bossIntents = decideMany(bossService, boss, createFamilyCardPool('final-boss'), 5);
        const showdownIntents = decideMany(showdownService, showdownBoss, createFamilyCardPool('final-boss'), 5);

        expect(bossIntents.map((intent) => intent.pattern)).toEqual([
            ENEMY_INTENT_PATTERN.CHARGE,
            ENEMY_INTENT_PATTERN.CHARGE,
            ENEMY_INTENT_PATTERN.FLURRY,
            ENEMY_INTENT_PATTERN.CLEANSE,
            ENEMY_INTENT_PATTERN.CURSE,
        ]);
        expect(bossIntents[0]).toMatchObject({
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
            damage: 0,
            burstDamage: 18,
        });
        expect(showdownIntents.map((intent) => intent.pattern)).toEqual([
            ENEMY_INTENT_PATTERN.CURSE,
            ENEMY_INTENT_PATTERN.CHARGE,
            ENEMY_INTENT_PATTERN.CHARGE,
            ENEMY_INTENT_PATTERN.FLURRY,
            ENEMY_INTENT_PATTERN.GUARD,
        ]);
    });

    it('picks cards by timeline pattern instead of strongest-card threat score', () => {
        const enemy = createEnemy({ archetypeId: 'blade-raider' });
        const service = new EnemyIntentService();

        const ambush = service.decideNextIntent({
            enemy,
            enemyCardPool: createFamilyCardPool('blade-raider'),
        });

        expect(ambush).toMatchObject({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            damage: 7,
            previewDamage: 4,
            revealRule: ENEMY_INTENT_AMBUSH_REVEAL_RULE.PARTIAL,
            label: 'Blade Ambush 7',
            sourceCardId: 'blade-ambush',
        });
    });

    it('prefers Iron Warden thorn guard as the family guard mechanic', () => {
        const enemy = createEnemy({ archetypeId: 'dread-sentinel' });
        const service = new EnemyIntentService();

        const guard = service.decideNextIntent({
            enemy,
            enemyCardPool: createFamilyCardPool('dread-sentinel'),
        });

        expect(guard).toMatchObject({
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: 5,
            label: 'Sentinel Thorn Guard',
            sourceCardId: 'sentinel-thorn-guard',
        });
    });

    it('stores the most recent intent and resets the timeline cursor when cleared', () => {
        const enemy = createEnemy({ archetypeId: 'mire-broodling' });
        const service = new EnemyIntentService();
        const enemyCardPool = createFamilyCardPool('mire-broodling');

        const firstIntent = service.decideNextIntent({ enemy, enemyCardPool });
        service.decideNextIntent({ enemy, enemyCardPool });

        expect(service.getIntent(enemy.id)?.pattern).toBe(ENEMY_INTENT_PATTERN.STRIKE);

        service.clearIntent(enemy.id);

        expect(service.getIntent(enemy.id)).toBeUndefined();
        expect(service.decideNextIntent({ enemy, enemyCardPool })).toEqual(firstIntent);
    });

    it('falls back to enemy stats when a timeline step has no matching card', () => {
        const enemy = createEnemy({ archetypeId: 'ash-crawler' });
        const service = new EnemyIntentService();

        const intent = service.decideNextIntent({ enemy });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 10,
            label: 'Attack',
        });
    });
});
