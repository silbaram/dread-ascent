import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
    resetCardSequence,
} from '../../../src/domain/entities/Card';
import { CardEffectService } from '../../../src/domain/services/CardEffectService';
import { DrawCycleService } from '../../../src/domain/services/DrawCycleService';
import { EnergyService } from '../../../src/domain/services/EnergyService';

vi.mock('phaser', () => ({}));

type BattleSceneModule = typeof import('../../../src/scenes/BattleScene');

interface TestScene {
    readonly onEndTurn: () => void;
    readonly afterEnemyTurn: () => void;
    readonly onPlayCard: (handIndex: number) => void;
    readonly displayHandCards: () => void;
    drawCycleService: DrawCycleService;
    cardEffectService: CardEffectService;
    energyService: EnergyService;
    drawCycleState: ReturnType<DrawCycleService['initialize']>;
    energyState: {
        current: number;
        max: number;
    };
    playerState: {
        health: number;
        maxHealth: number;
        block: number;
    };
    enemyState: {
        health: number;
        maxHealth: number;
        block: number;
    };
    enemyCardPool: ReturnType<typeof createCard>[];
    time: {
        delayedCall: ReturnType<typeof vi.fn>;
    };
    clearCardSprites: ReturnType<typeof vi.fn>;
    clearEffectText: ReturnType<typeof vi.fn>;
    showEffectText: ReturnType<typeof vi.fn>;
    showEnemyActionText: ReturnType<typeof vi.fn>;
    updateAllDisplays: ReturnType<typeof vi.fn>;
    showBattleEnd: ReturnType<typeof vi.fn>;
    startPlayerTurn: ReturnType<typeof vi.fn>;
    createCardVisual: ReturnType<typeof vi.fn>;
    cardSprites: unknown[];
    totalEnemyDamage: number;
    endBattle: ReturnType<typeof vi.fn>;
    isInputLocked: boolean;
}

describe('BattleScene block lifecycle', () => {
    let BattleScene: BattleSceneModule['BattleScene'];

    beforeAll(async () => {
        (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser = {
            Scene: class {
                constructor(_config?: unknown) {}
            },
        };
        ({ BattleScene } = await import('../../../src/scenes/BattleScene'));
    });

    afterAll(() => {
        delete (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser;
    });

    function createImmediateTimer(): TestScene['time'] {
        return {
            delayedCall: vi.fn((_delayMs: number, callback: () => void) => {
                callback();
                return undefined;
            }),
        };
    }

    function createScene(): TestScene {
        resetCardSequence();

        const scene = new BattleScene() as unknown as TestScene;
        const drawCycleService = new DrawCycleService();

        scene.drawCycleService = drawCycleService;
        scene.cardEffectService = new CardEffectService();
        scene.energyService = new EnergyService();
        scene.drawCycleState = drawCycleService.initialize([]);
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 5 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.enemyCardPool = [
            createCard({
                name: 'Enemy Strike',
                type: CARD_TYPE.ATTACK,
                power: 4,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ];
        scene.time = createImmediateTimer();
        scene.clearCardSprites = vi.fn();
        scene.clearEffectText = vi.fn();
        scene.showEffectText = vi.fn();
        scene.showEnemyActionText = vi.fn();
        scene.updateAllDisplays = vi.fn();
        scene.showBattleEnd = vi.fn();
        scene.startPlayerTurn = vi.fn();
        scene.createCardVisual = vi.fn(() => ({}));
        scene.cardSprites = [];
        scene.totalEnemyDamage = 0;
        scene.endBattle = vi.fn();
        scene.isInputLocked = false;

        return scene;
    }

    it('removes player block before the enemy attack resolves after end turn', () => {
        const scene = createScene();

        scene.onEndTurn();

        expect(scene.playerState.block).toBe(0);
        expect(scene.playerState.health).toBe(96);
        expect(scene.startPlayerTurn).toHaveBeenCalledOnce();
    });

    it('clears enemy block when the enemy turn finishes', () => {
        const scene = createScene();
        scene.enemyState = { health: 40, maxHealth: 40, block: 7 };

        scene.afterEnemyTurn();

        expect(scene.enemyState.block).toBe(0);
        expect(scene.startPlayerTurn).toHaveBeenCalledOnce();
    });

    it('disables Last Stand in hand when player health is above the threshold', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 10, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Last Stand',
                    type: CARD_TYPE.ATTACK,
                    power: 30,
                    cost: 3,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    keywords: [CARD_KEYWORD.RETAIN],
                    rarity: CARD_RARITY.RARE,
                    condition: { type: 'HP_THRESHOLD', value: 5 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.displayHandCards();

        expect(scene.createCardVisual).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Last Stand' }),
            expect.any(Number),
            expect.any(Number),
            0,
            false,
        );
    });

    it('prevents Last Stand from being played when player health is above the threshold', () => {
        const scene = createScene();
        const lastStand = createCard({
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 30,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            keywords: [CARD_KEYWORD.RETAIN],
            rarity: CARD_RARITY.RARE,
            condition: { type: 'HP_THRESHOLD', value: 5 },
        });
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 9, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [lastStand],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.energyState.current).toBe(3);
        expect(scene.drawCycleState.hand).toEqual([lastStand]);
        expect(scene.showEffectText).not.toHaveBeenCalled();
    });
});
