import { describe, expect, it } from 'vitest';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_TYPE,
    createCard,
} from '../../../../src/domain/entities/Card';
import {
    getBattleEquipmentConfig,
    getPlayerCardModifier,
    transformDeckForBattle,
} from '../../../../src/domain/services/EquipmentEffectService';
import { ITEM_RARITY, ITEM_TYPE, type InventoryItem } from '../../../../src/domain/entities/Item';

function createEquippedItem(id: string): InventoryItem {
    return {
        id,
        instanceId: `${id}-1`,
        name: id,
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: '!',
        stackable: false,
        maxStack: 1,
        quantity: 1,
        description: id,
        isEquipped: true,
        equipment: {
            slot: 'WEAPON',
            statModifier: {},
        },
    };
}

describe('EquipmentEffectService', () => {
    it('builds an aggregated battle profile from equipped item ids', () => {
        const config = getBattleEquipmentConfig([
            createEquippedItem('blood-fang'),
            createEquippedItem('watchers-eye'),
            createEquippedItem('runic-blindfold'),
            createEquippedItem('bastion-armor'),
        ]);

        expect(config.extraDrawPerTurn).toBe(1);
        expect(config.hideEnemyIntent).toBe(true);
        expect(config.blockPersistRatio).toBe(0.3);
    });

    it('applies attack and guard modifiers to rendered player cards', () => {
        const strike = createCard({
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 6,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const fortify = createCard({
            name: 'Fortify',
            type: CARD_TYPE.GUARD,
            power: 5,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.BLOCK,
        });

        const inventory = [
            createEquippedItem('tower-mace'),
            createEquippedItem('blood-treads'),
            createEquippedItem('watchers-eye'),
            createEquippedItem('escape-artists-boots'),
        ];

        const boostedStrike = getPlayerCardModifier(strike, inventory, {
            turnNumber: 1,
            isOpeningHandCard: false,
            enemyIntentType: 'defend',
            playerHealth: 50,
            playerMaxHealth: 100,
            playerBlock: 0,
            nextAttackPowerBonus: 0,
        });
        const boostedFortify = getPlayerCardModifier(fortify, inventory, {
            turnNumber: 2,
            isOpeningHandCard: false,
            enemyIntentType: 'attack',
            playerHealth: 50,
            playerMaxHealth: 100,
            playerBlock: 0,
            nextAttackPowerBonus: 0,
        });

        expect(boostedStrike.card.cost).toBe(1);
        expect(boostedStrike.card.power).toBe(10);
        expect(boostedStrike.extraSelfDamage).toBe(0);
        expect(boostedFortify.card.power).toBe(5);
    });

    it("limits Madman's Hood power bonus to opening hand cards on the first turn only", () => {
        const strike = createCard({
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 6,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const inventory = [createEquippedItem('madmans-hood')];

        const openingHandStrike = getPlayerCardModifier(strike, inventory, {
            turnNumber: 1,
            isOpeningHandCard: true,
            enemyIntentType: 'attack',
            playerHealth: 50,
            playerMaxHealth: 100,
            playerBlock: 0,
            nextAttackPowerBonus: 0,
        });
        const laterDrawStrike = getPlayerCardModifier(strike, inventory, {
            turnNumber: 1,
            isOpeningHandCard: false,
            enemyIntentType: 'attack',
            playerHealth: 50,
            playerMaxHealth: 100,
            playerBlock: 0,
            nextAttackPowerBonus: 0,
        });
        const retainedOpeningStrike = getPlayerCardModifier(strike, inventory, {
            turnNumber: 2,
            isOpeningHandCard: true,
            enemyIntentType: 'attack',
            playerHealth: 50,
            playerMaxHealth: 100,
            playerBlock: 0,
            nextAttackPowerBonus: 0,
        });

        expect(openingHandStrike.card.power).toBe(9);
        expect(laterDrawStrike.card.power).toBe(6);
        expect(retainedOpeningStrike.card.power).toBe(6);
    });

    it('adds a curse card and removes exhaust from flee cards when needed', () => {
        const fleeCard = createCard({
            name: 'Shadow Step',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.FLEE,
            keywords: [CARD_KEYWORD.EXHAUST],
        });

        const inventory = [
            createEquippedItem('cursed-edge'),
            createEquippedItem('escape-artists-boots'),
        ];
        const config = getBattleEquipmentConfig(inventory);
        const deck = [
            ...transformDeckForBattle([fleeCard], inventory),
            ...config.battleStartCurseCards,
        ];

        expect(deck).toHaveLength(2);
        expect(deck[0]?.keywords).not.toContain(CARD_KEYWORD.EXHAUST);
        expect(deck[1]?.keywords).toContain(CARD_KEYWORD.UNPLAYABLE);
        expect(deck[1]?.type).toBe(CARD_TYPE.CURSE);
    });
});
