import type {
    InventoryItem,
    ItemRarity,
} from '../entities/Item';
import { ITEM_ID } from '../entities/Item';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    type Card,
} from '../entities/Card';
import { CARD_CATALOG_ID, createCardFromCatalog } from '../entities/CardCatalog';
import type { EnemyIntentType } from './EnemyIntentService';
import {
    STATUS_EFFECT_TYPE,
    type StatusEffectApplication,
} from './StatusEffectService';

export interface EquipmentBattleConfig {
    readonly battleStartSelfDamage: number;
    readonly battleStartPlayerStatuses: readonly StatusEffectApplication[];
    readonly battleStartEnemyStatuses: readonly StatusEffectApplication[];
    readonly battleStartCurseCards: readonly Card[];
    readonly extraDrawPerTurn: number;
    readonly extraDrawOnFirstTurn: number;
    readonly firstTurnExtraEnergy: number;
    readonly openingHandCardPower: number;
    readonly turnStartHeal: number;
    readonly turnStartEnergy: number;
    readonly turnStartSelfDamage: number;
    readonly turnStartEnergyChance: number;
    readonly turnStartEnergyChanceRate: number;
    readonly previewEnemyIntentCount: number;
    readonly hideEnemyIntent: boolean;
    readonly poisonDoesNotDecay: boolean;
    readonly blockPersistRatio: number;
}

export interface EquipmentCardModifierContext {
    readonly turnNumber: number;
    readonly isOpeningHandCard: boolean;
    readonly playerHealth: number;
    readonly playerMaxHealth: number;
    readonly playerBlock: number;
    readonly enemyIntentType?: EnemyIntentType;
    readonly nextAttackPowerBonus: number;
}

export interface EquipmentCardModifierResult {
    readonly card: Card;
    readonly extraSelfDamage: number;
    readonly extraEnemyStatusEffects: readonly StatusEffectApplication[];
    readonly consumesNextAttackBonus: boolean;
}

export interface EquipmentTurnEndContext {
    readonly handCount: number;
    readonly remainingEnergy: number;
}

export interface EquipmentTurnEndResult {
    readonly nextTurnDrawBonus: number;
}

export interface EquipmentHealthLossResult {
    readonly nextAttackPowerBonus: number;
}

export interface EquipmentDamageTakenResult {
    readonly reflectedDamage: number;
    readonly strengthGained: number;
    readonly strengthGainConsumedThisTurn: number;
}

export interface EquipmentDefeatReward {
    readonly heal: number;
    readonly extraEnergy: number;
}

const EMPTY_BATTLE_CONFIG: EquipmentBattleConfig = {
    battleStartSelfDamage: 0,
    battleStartPlayerStatuses: [],
    battleStartEnemyStatuses: [],
    battleStartCurseCards: [],
    extraDrawPerTurn: 0,
    extraDrawOnFirstTurn: 0,
    firstTurnExtraEnergy: 0,
    openingHandCardPower: 0,
    turnStartHeal: 0,
    turnStartEnergy: 0,
    turnStartSelfDamage: 0,
    turnStartEnergyChance: 0,
    turnStartEnergyChanceRate: 0,
    previewEnemyIntentCount: 1,
    hideEnemyIntent: false,
    poisonDoesNotDecay: false,
    blockPersistRatio: 0,
};

function getEquippedItems(inventory: readonly InventoryItem[]): readonly InventoryItem[] {
    return inventory.filter((item) => item.isEquipped && item.type === 'EQUIPMENT' && item.equipment);
}

function hasEquippedItem(inventory: readonly InventoryItem[], itemId: InventoryItem['id']): boolean {
    return getEquippedItems(inventory).some((item) => item.id === itemId);
}

function createDurationStatus(
    type: typeof STATUS_EFFECT_TYPE.VULNERABLE
        | typeof STATUS_EFFECT_TYPE.WEAK
        | typeof STATUS_EFFECT_TYPE.REGENERATION
        | typeof STATUS_EFFECT_TYPE.FRAIL,
    duration: number,
    target: string,
): StatusEffectApplication {
    return {
        type,
        duration,
        target,
    };
}

function createStackStatus(
    type: typeof STATUS_EFFECT_TYPE.POISON
        | typeof STATUS_EFFECT_TYPE.STRENGTH
        | typeof STATUS_EFFECT_TYPE.THORNS,
    stacks: number,
    target: string,
): StatusEffectApplication {
    return {
        type,
        stacks,
        target,
    };
}

function adjustCard(
    card: Card,
    modifiers: {
        powerDelta?: number;
        costDelta?: number;
        removeKeywords?: readonly string[];
    },
): Card {
    const removeKeywords = new Set(modifiers.removeKeywords ?? []);
    const keywords = removeKeywords.size > 0
        ? card.keywords.filter((keyword) => !removeKeywords.has(keyword))
        : card.keywords;

    return {
        ...card,
        power: Math.max(0, card.power + (modifiers.powerDelta ?? 0)),
        cost: Math.max(0, card.cost + (modifiers.costDelta ?? 0)),
        keywords,
    };
}

export function transformDeckForBattle(
    deck: readonly Card[],
    inventory: readonly InventoryItem[],
): readonly Card[] {
    const hasTowerMace = hasEquippedItem(inventory, ITEM_ID.TOWER_MACE);
    const hasSpineWhip = hasEquippedItem(inventory, ITEM_ID.SPINE_WHIP);
    const hasCursedEdge = hasEquippedItem(inventory, ITEM_ID.CURSED_EDGE);
    const hasWardenPlate = hasEquippedItem(inventory, ITEM_ID.WARDEN_PLATE);
    const hasPactArmor = hasEquippedItem(inventory, ITEM_ID.PACT_ARMOR);
    const hasEscapeArtistsBoots = hasEquippedItem(inventory, ITEM_ID.ESCAPE_ARTISTS_BOOTS);

    return deck.map((card) => {
        let nextCard = { ...card };

        if (hasTowerMace && nextCard.type === 'ATTACK') {
            nextCard = adjustCard(nextCard, {
                powerDelta: 4,
                costDelta: 1,
            });
        }

        if (hasSpineWhip && nextCard.effectType === CARD_EFFECT_TYPE.MULTI_HIT) {
            nextCard = adjustCard(nextCard, { powerDelta: 1 });
        }

        if (hasCursedEdge && nextCard.type === 'ATTACK') {
            nextCard = adjustCard(nextCard, { powerDelta: 2 });
        }

        if (hasWardenPlate && nextCard.type === 'GUARD') {
            nextCard = adjustCard(nextCard, { powerDelta: 1 });
        }

        if (hasPactArmor) {
            if (nextCard.type === 'GUARD') {
                nextCard = adjustCard(nextCard, { powerDelta: 3 });
            }
            if (nextCard.type === 'ATTACK') {
                nextCard = adjustCard(nextCard, { powerDelta: -2 });
            }
        }

        if (hasEscapeArtistsBoots && nextCard.name === 'Shadow Step') {
            nextCard = adjustCard(nextCard, {
                removeKeywords: [CARD_KEYWORD.EXHAUST],
            });
        }

        return nextCard;
    });
}

export function getBattleEquipmentConfig(inventory: readonly InventoryItem[]): EquipmentBattleConfig {
    const equippedItems = getEquippedItems(inventory);
    if (equippedItems.length === 0) {
        return EMPTY_BATTLE_CONFIG;
    }

    const battleStartPlayerStatuses: StatusEffectApplication[] = [];
    const battleStartEnemyStatuses: StatusEffectApplication[] = [];
    const battleStartCurseCards: Card[] = [];

    if (hasEquippedItem(inventory, ITEM_ID.SOULFIRE_BRAND)) {
        battleStartPlayerStatuses.push(
            createStackStatus(STATUS_EFFECT_TYPE.STRENGTH, 2, 'Player'),
        );
    }

    if (hasEquippedItem(inventory, ITEM_ID.MADMANS_HOOD)) {
        battleStartPlayerStatuses.push(
            createDurationStatus(STATUS_EFFECT_TYPE.VULNERABLE, 2, 'Player'),
        );
    }

    if (hasEquippedItem(inventory, ITEM_ID.SHADOW_ROBE)) {
        battleStartEnemyStatuses.push(
            createDurationStatus(STATUS_EFFECT_TYPE.WEAK, 1, 'Enemy'),
        );
    }

    if (hasEquippedItem(inventory, ITEM_ID.SILENT_STEPS)) {
        battleStartEnemyStatuses.push(
            createStackStatus(STATUS_EFFECT_TYPE.POISON, 2, 'Enemy'),
        );
    }

    if (hasEquippedItem(inventory, ITEM_ID.CURSED_EDGE)) {
        battleStartCurseCards.push(createCardFromCatalog(CARD_CATALOG_ID.DREAD));
    }

    return {
        battleStartSelfDamage: hasEquippedItem(inventory, ITEM_ID.BLOOD_TREADS) ? 3 : 0,
        battleStartPlayerStatuses,
        battleStartEnemyStatuses,
        battleStartCurseCards,
        extraDrawPerTurn: hasEquippedItem(inventory, ITEM_ID.RUNIC_BLINDFOLD) ? 1 : 0,
        extraDrawOnFirstTurn: hasEquippedItem(inventory, ITEM_ID.SCOUTS_VISOR) ? 1 : 0,
        firstTurnExtraEnergy: hasEquippedItem(inventory, ITEM_ID.SWIFT_GREAVES) ? 1 : 0,
        openingHandCardPower: hasEquippedItem(inventory, ITEM_ID.MADMANS_HOOD) ? 3 : 0,
        turnStartHeal: hasEquippedItem(inventory, ITEM_ID.VITALITY_ARMOR) ? 2 : 0,
        turnStartEnergy: hasEquippedItem(inventory, ITEM_ID.GAMBLERS_SHOES) ? 1 : 0,
        turnStartSelfDamage:
            (hasEquippedItem(inventory, ITEM_ID.SOUL_LEECH) ? 2 : 0)
            + (hasEquippedItem(inventory, ITEM_ID.GAMBLERS_SHOES) ? 3 : 0),
        turnStartEnergyChance: hasEquippedItem(inventory, ITEM_ID.WINDRUNNER_BOOTS) ? 1 : 0,
        turnStartEnergyChanceRate: hasEquippedItem(inventory, ITEM_ID.WINDRUNNER_BOOTS) ? 0.3 : 0,
        previewEnemyIntentCount: hasEquippedItem(inventory, ITEM_ID.ALL_SEEING_CROWN) ? 2 : 1,
        hideEnemyIntent: hasEquippedItem(inventory, ITEM_ID.RUNIC_BLINDFOLD),
        poisonDoesNotDecay: hasEquippedItem(inventory, ITEM_ID.PLAGUE_DOCTORS_MASK),
        blockPersistRatio: hasEquippedItem(inventory, ITEM_ID.BASTION_ARMOR) ? 0.3 : 0,
    };
}

export function getPlayerCardModifier(
    card: Card,
    inventory: readonly InventoryItem[],
    context: EquipmentCardModifierContext,
): EquipmentCardModifierResult {
    const battleConfig = getBattleEquipmentConfig(inventory);
    let nextCard = { ...card };
    let extraSelfDamage = 0;
    const extraEnemyStatusEffects: StatusEffectApplication[] = [];
    let consumesNextAttackBonus = false;

    if (context.turnNumber === 1 && context.isOpeningHandCard && nextCard.power > 0) {
        nextCard = adjustCard(nextCard, {
            powerDelta: battleConfig.openingHandCardPower,
        });
    }

    if (nextCard.type === 'ATTACK') {
        if (hasEquippedItem(inventory, ITEM_ID.BLOOD_FANG)) {
            nextCard = adjustCard(nextCard, { powerDelta: 3 });
            extraSelfDamage += 1;
        }

        if (hasEquippedItem(inventory, ITEM_ID.BLOOD_TREADS) && context.turnNumber === 1) {
            nextCard = adjustCard(nextCard, { powerDelta: 4 });
        }

        if (hasEquippedItem(inventory, ITEM_ID.IRONCLAD_SABATONS) && context.playerBlock >= 10) {
            nextCard = adjustCard(nextCard, { powerDelta: 2 });
        }

        if (context.nextAttackPowerBonus > 0) {
            nextCard = adjustCard(nextCard, { powerDelta: context.nextAttackPowerBonus });
            consumesNextAttackBonus = true;
        }

        if (hasEquippedItem(inventory, ITEM_ID.VENOM_FANG)) {
            extraEnemyStatusEffects.push(
                createStackStatus(STATUS_EFFECT_TYPE.POISON, 1, 'Enemy'),
            );
        }
    }

    if (nextCard.type === 'GUARD') {
        if (
            hasEquippedItem(inventory, ITEM_ID.BERSERKER_HIDE)
            && context.playerHealth <= Math.floor(context.playerMaxHealth / 2)
        ) {
            nextCard = adjustCard(nextCard, { powerDelta: 3 });
        }

        if (
            hasEquippedItem(inventory, ITEM_ID.WATCHERS_EYE)
            && context.enemyIntentType === 'attack'
        ) {
            nextCard = adjustCard(nextCard, { powerDelta: 2 });
        }

        if (hasEquippedItem(inventory, ITEM_ID.ESCAPE_ARTISTS_BOOTS)) {
            nextCard = adjustCard(nextCard, { powerDelta: -2 });
        }
    }

    return {
        card: nextCard,
        extraSelfDamage,
        extraEnemyStatusEffects,
        consumesNextAttackBonus,
    };
}

export function getTurnEndEquipmentBonus(
    inventory: readonly InventoryItem[],
    context: EquipmentTurnEndContext,
): EquipmentTurnEndResult {
    let nextTurnDrawBonus = 0;

    if (hasEquippedItem(inventory, ITEM_ID.TACTICIANS_CIRCLET)) {
        nextTurnDrawBonus += Math.min(2, Math.max(0, context.handCount));
    }

    if (hasEquippedItem(inventory, ITEM_ID.PHANTOM_STRIDE)) {
        nextTurnDrawBonus += Math.max(0, context.remainingEnergy);
    }

    return { nextTurnDrawBonus };
}

export function getHealthLossEquipmentBonus(
    inventory: readonly InventoryItem[],
    healthLost: number,
): EquipmentHealthLossResult {
    if (healthLost <= 0 || !hasEquippedItem(inventory, ITEM_ID.BLOOD_CROWN)) {
        return { nextAttackPowerBonus: 0 };
    }

    return { nextAttackPowerBonus: 2 };
}

export function getDamageTakenEquipmentBonus(
    inventory: readonly InventoryItem[],
    healthLost: number,
    strengthGainConsumedThisTurn: number,
): EquipmentDamageTakenResult {
    const reflectedDamage = healthLost > 0 && hasEquippedItem(inventory, ITEM_ID.THORN_MAIL)
        ? 2
        : 0;

    if (healthLost <= 0 || !hasEquippedItem(inventory, ITEM_ID.MARTYRDOM_PLATE)) {
        return {
            reflectedDamage,
            strengthGained: 0,
            strengthGainConsumedThisTurn,
        };
    }

    const availableStrength = Math.max(0, 3 - strengthGainConsumedThisTurn);
    const desiredStrength = Math.floor(healthLost * 0.5);
    const strengthGained = Math.min(availableStrength, desiredStrength);

    return {
        reflectedDamage,
        strengthGained,
        strengthGainConsumedThisTurn: strengthGainConsumedThisTurn + strengthGained,
    };
}

export function getEnemyDefeatEquipmentReward(
    inventory: readonly InventoryItem[],
): EquipmentDefeatReward {
    if (hasEquippedItem(inventory, ITEM_ID.SOUL_LEECH)) {
        return {
            heal: 12,
            extraEnergy: 1,
        };
    }

    if (hasEquippedItem(inventory, ITEM_ID.DREAD_REAPER)) {
        return {
            heal: 6,
            extraEnergy: 0,
        };
    }

    return {
        heal: 0,
        extraEnergy: 0,
    };
}

export function rollTurnStartBonusEnergy(
    config: EquipmentBattleConfig,
    randomValue: number,
): number {
    if (config.turnStartEnergyChance <= 0 || config.turnStartEnergyChanceRate <= 0) {
        return 0;
    }

    return randomValue < config.turnStartEnergyChanceRate
        ? config.turnStartEnergyChance
        : 0;
}

export function getRarityWeightBonus(
    inventory: readonly InventoryItem[],
    rarity: ItemRarity,
): number {
    if (rarity !== 'UNCOMMON') {
        return 0;
    }

    return hasEquippedItem(inventory, ITEM_ID.WORN_SANDALS)
        ? 0.03
        : 0;
}
