import { beforeEach, describe, expect, it } from 'vitest';
import type { CombatStats } from '../../../../src/domain/entities/CombatStats';
import { Enemy } from '../../../../src/domain/entities/Enemy';
import {
    CARD_EFFECT_TYPE,
    CARD_TYPE,
    createCard,
    resetCardSequence,
    type Card,
} from '../../../../src/domain/entities/Card';
import {
    ENEMY_INTENT_PATTERN,
    ENEMY_INTENT_BUFF_STAT,
    ENEMY_INTENT_TYPE,
    EnemyIntentService,
} from '../../../../src/domain/services/EnemyIntentService';

const DEFAULT_STATS: CombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
};

class FixedRandom {
    constructor(private readonly value: number) {}

    next(): number {
        return this.value;
    }
}

function createEnemy(options?: {
    health?: number;
    maxHealth?: number;
    kind?: 'normal' | 'boss';
    elite?: boolean;
}) {
    const maxHealth = options?.maxHealth ?? DEFAULT_STATS.maxHealth;
    const health = options?.health ?? maxHealth;
    return new Enemy(
        options?.kind === 'boss' ? 'boss-1' : 'enemy-1',
        'Enemy',
        { x: 1, y: 1 },
        {
            health,
            maxHealth,
            attack: DEFAULT_STATS.attack,
            defense: DEFAULT_STATS.defense,
        },
        25,
        options?.kind ?? 'normal',
        options?.kind === 'boss' ? 'final-boss' : 'ash-crawler',
        options?.elite ?? false,
    );
}

function createEnemyCardPool(): Card[] {
    return [
        createCard({
            id: 'enemy-strike-6',
            name: 'Enemy Strike 6',
            type: CARD_TYPE.ATTACK,
            power: 6,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        }),
        createCard({
            id: 'enemy-strike-8',
            name: 'Enemy Strike 8',
            type: CARD_TYPE.ATTACK,
            power: 8,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        }),
        createCard({
            id: 'enemy-guard-5',
            name: 'Enemy Guard 5',
            type: CARD_TYPE.GUARD,
            power: 5,
            effectType: CARD_EFFECT_TYPE.BLOCK,
        }),
    ];
}

function createEnemyPatternCardPool(): Card[] {
    return [
        ...createEnemyCardPool(),
        createCard({
            id: 'enemy-flurry-3x3',
            name: 'Enemy Flurry 3',
            type: CARD_TYPE.ATTACK,
            power: 3,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            hitCount: 3,
            effectPayload: { hitCount: 3 },
        }),
    ];
}

describe('EnemyIntentService', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    it('stores and exposes an attack intent with expected damage', () => {
        const enemy = createEnemy();
        const service = new EnemyIntentService(new FixedRandom(0));

        const intent = service.decideNextIntent({
            enemy,
            enemyCardPool: createEnemyCardPool(),
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 8,
            label: 'Enemy Strike 8',
            sourceCardId: 'enemy-strike-8',
        });
        expect(service.getIntent(enemy.id)).toEqual(intent);
    });

    it('leans toward a defend intent when the enemy is low on health', () => {
        const enemy = createEnemy({ health: 20, maxHealth: 100 });
        const service = new EnemyIntentService(new FixedRandom(0.5));

        const intent = service.decideNextIntent({
            enemy,
            enemyCardPool: createEnemyCardPool(),
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: 5,
            label: 'Enemy Guard 5',
            sourceCardId: 'enemy-guard-5',
        });
    });

    it('can choose a buff intent for bosses and exposes its data structure', () => {
        const boss = createEnemy({ kind: 'boss' });
        const service = new EnemyIntentService(new FixedRandom(0.8));

        const intent = service.decideNextIntent({ enemy: boss });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.RITUAL,
            stat: ENEMY_INTENT_BUFF_STAT.ATTACK,
            amount: 4,
            label: 'Battle Cry',
        });
    });

    it('applies floor-band weight scaling to elite intents on later floors', () => {
        const enemy = createEnemy({ health: 60, maxHealth: 100, elite: true });
        const earlyService = new EnemyIntentService(new FixedRandom(0.75));
        const lateService = new EnemyIntentService(new FixedRandom(0.75));

        const earlyIntent = earlyService.decideNextIntent({
            enemy,
            enemyCardPool: createEnemyCardPool(),
            floorNumber: 1,
        });
        const lateIntent = lateService.decideNextIntent({
            enemy,
            enemyCardPool: createEnemyCardPool(),
            floorNumber: 21,
        });

        expect(earlyIntent).toEqual({
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: 5,
            label: 'Enemy Guard 5',
            sourceCardId: 'enemy-guard-5',
        });
        expect(lateIntent).toEqual({
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.RITUAL,
            stat: ENEMY_INTENT_BUFF_STAT.ATTACK,
            amount: 3,
            label: 'Battle Cry',
        });
    });

    it('falls back to enemy stats when no enemy card pool is provided', () => {
        const enemy = createEnemy();
        const service = new EnemyIntentService(new FixedRandom(0));

        const intent = service.decideNextIntent({ enemy });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 10,
            label: 'Attack',
        });
    });

    it('promotes multi-hit cards into flurry intent previews', () => {
        const enemy = createEnemy();
        const service = new EnemyIntentService(new FixedRandom(0));

        const intent = service.decideNextIntent({
            enemy,
            enemyCardPool: createEnemyPatternCardPool(),
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.FLURRY,
            damage: 9,
            hitCount: 3,
            damagePerHit: 3,
            label: 'Enemy Flurry 3',
            sourceCardId: 'enemy-flurry-3x3',
        });
    });

    it('recognizes charge cards as charge intent previews', () => {
        const enemy = createEnemy();
        const service = new EnemyIntentService(new FixedRandom(0));

        const intent = service.decideNextIntent({
            enemy,
            enemyCardPool: [
                createCard({
                    id: 'enemy-charge-12',
                    name: 'Enemy Charge 12',
                    type: CARD_TYPE.ATTACK,
                    power: 12,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            damage: 12,
            label: 'Enemy Charge 12',
            warning: 'Next turn burst',
            sourceCardId: 'enemy-charge-12',
        });
    });

    it('recognizes ambush cards as ambush intent previews', () => {
        const enemy = createEnemy();
        const service = new EnemyIntentService(new FixedRandom(0));

        const intent = service.decideNextIntent({
            enemy,
            enemyCardPool: [
                createCard({
                    id: 'enemy-ambush-7',
                    name: 'Enemy Ambush 7',
                    type: CARD_TYPE.ATTACK,
                    power: 7,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            damage: 7,
            label: 'Enemy Ambush 7',
            warning: 'Hidden prep',
            sourceCardId: 'enemy-ambush-7',
        });
    });

    it('recognizes cleanse cards as cleanse intent previews', () => {
        const enemy = createEnemy({ health: 20, maxHealth: 100 });
        const service = new EnemyIntentService(new FixedRandom(0.5));

        const intent = service.decideNextIntent({
            enemy,
            enemyCardPool: [
                createCard({
                    id: 'enemy-cleanse-shell',
                    name: 'Enemy Cleanse Poison',
                    type: CARD_TYPE.GUARD,
                    power: 7,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                }),
            ],
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.CLEANSE,
            block: 7,
            label: 'Enemy Cleanse Poison',
            cleansedStatuses: ['Poison'],
            sourceCardId: 'enemy-cleanse-shell',
        });
    });

    it('recognizes curse cards as curse intent previews', () => {
        const boss = createEnemy({ kind: 'boss' });
        const service = new EnemyIntentService(new FixedRandom(0.8));

        const intent = service.decideNextIntent({
            enemy: boss,
            enemyCardPool: [
                createCard({
                    id: 'enemy-dread-hex',
                    name: 'Enemy Dread Hex',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
                }),
            ],
        });

        expect(intent).toEqual({
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.CURSE,
            label: 'Enemy Dread Hex',
            curseCardName: 'Hex',
            curseCount: 1,
            sourceCardId: 'enemy-dread-hex',
        });
    });

    it('clears stored intents when requested', () => {
        const enemy = createEnemy();
        const service = new EnemyIntentService(new FixedRandom(0));

        service.decideNextIntent({ enemy, enemyCardPool: createEnemyCardPool() });
        service.clearIntent(enemy.id);

        expect(service.getIntent(enemy.id)).toBeUndefined();
    });
});
