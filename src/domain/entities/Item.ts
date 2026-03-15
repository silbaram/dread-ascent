import type { CombatStatModifier } from './CombatStats';
import type { Position } from './Player';

export const ITEM_TYPE = {
    CONSUMABLE: 'CONSUMABLE',
    EQUIPMENT: 'EQUIPMENT',
    MATERIAL: 'MATERIAL',
    KEY: 'KEY',
} as const;

export type ItemType = (typeof ITEM_TYPE)[keyof typeof ITEM_TYPE];

export const EQUIPMENT_SLOT = {
    WEAPON: 'WEAPON',
    ARMOR: 'ARMOR',
    TRINKET: 'TRINKET',
} as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOT)[keyof typeof EQUIPMENT_SLOT];

export const ITEM_RARITY = {
    COMMON: 'COMMON',
    RARE: 'RARE',
    LEGENDARY: 'LEGENDARY',
} as const;

export type ItemRarity = (typeof ITEM_RARITY)[keyof typeof ITEM_RARITY];

export const ITEM_RARITY_STAT_MULTIPLIER: Record<ItemRarity, number> = {
    [ITEM_RARITY.COMMON]: 1,
    [ITEM_RARITY.RARE]: 1.25,
    [ITEM_RARITY.LEGENDARY]: 1.6,
};

export interface ConsumableEffect {
    kind: 'heal';
    amount: number;
}

export interface EquipmentDefinition {
    slot: EquipmentSlot;
    statModifier: CombatStatModifier;
}

export interface ItemDefinition {
    id: string;
    name: string;
    type: ItemType;
    rarity: ItemRarity;
    icon: string;
    stackable: boolean;
    maxStack: number;
    description: string;
    consumableEffect?: ConsumableEffect;
    equipment?: EquipmentDefinition;
}

export interface InventoryItem extends ItemDefinition {
    instanceId: string;
    quantity: number;
    isEquipped: boolean;
}

export class ItemEntity {
    constructor(
        public readonly instanceId: string,
        public readonly definition: ItemDefinition,
        public position: Position,
    ) {}

    get rarity() {
        return this.definition.rarity;
    }
}

export const ITEM_CATALOG: readonly ItemDefinition[] = [
    {
        id: 'small-potion',
        name: 'Small Potion',
        type: ITEM_TYPE.CONSUMABLE,
        rarity: ITEM_RARITY.COMMON,
        icon: '!',
        stackable: true,
        maxStack: 5,
        description: 'A compact tonic that restores a small amount of health.',
        consumableEffect: {
            kind: 'heal',
            amount: 30,
        },
    },
    {
        id: 'iron-dagger',
        name: 'Iron Dagger',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'A light blade suited for quick strikes.',
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 3,
            },
        },
    },
    {
        id: 'leather-vest',
        name: 'Leather Vest',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'Hardened hide plating that softens incoming blows.',
        equipment: {
            slot: EQUIPMENT_SLOT.ARMOR,
            statModifier: {
                defense: 2,
            },
        },
    },
    {
        id: 'scrap-bundle',
        name: 'Scrap Bundle',
        type: ITEM_TYPE.MATERIAL,
        rarity: ITEM_RARITY.COMMON,
        icon: '*',
        stackable: true,
        maxStack: 10,
        description: 'Loose salvaged parts that may support later upgrades.',
    },
    {
        id: 'bronze-sigil',
        name: 'Bronze Sigil',
        type: ITEM_TYPE.KEY,
        rarity: ITEM_RARITY.COMMON,
        icon: '?',
        stackable: false,
        maxStack: 1,
        description: 'An engraved seal marked for future locked paths.',
    },
    {
        id: 'moonsteel-saber',
        name: 'Moonsteel Saber',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'A rare saber that bites deeper than common iron.',
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 5,
            },
        },
    },
    {
        id: 'warden-plate',
        name: 'Warden Plate',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'Heavy armor recovered from tower wardens.',
        equipment: {
            slot: EQUIPMENT_SLOT.ARMOR,
            statModifier: {
                defense: 4,
            },
        },
    },
    {
        id: 'sunfire-idol',
        name: 'Sunfire Idol',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.LEGENDARY,
        icon: '&',
        stackable: false,
        maxStack: 1,
        description: 'A legendary idol that fortifies body and spirit.',
        equipment: {
            slot: EQUIPMENT_SLOT.TRINKET,
            statModifier: {
                maxHealth: 20,
                attack: 2,
            },
        },
    },
] as const;

export function createInventoryItem(
    definition: ItemDefinition,
    instanceId: string,
): InventoryItem {
    return {
        ...definition,
        instanceId,
        quantity: 1,
        isEquipped: false,
    };
}

export function getItemRarityRank(rarity: ItemRarity) {
    switch (rarity) {
        case ITEM_RARITY.LEGENDARY:
            return 2;
        case ITEM_RARITY.RARE:
            return 1;
        case ITEM_RARITY.COMMON:
        default:
            return 0;
    }
}

export function createGeneratedItemDefinition(
    template: ItemDefinition,
    rarity: ItemRarity,
): ItemDefinition {
    const multiplier = ITEM_RARITY_STAT_MULTIPLIER[rarity];

    return {
        ...template,
        rarity,
        equipment: template.equipment
            ? {
                ...template.equipment,
                statModifier: scaleCombatStatModifier(template.equipment.statModifier, multiplier),
            }
            : undefined,
    };
}

function scaleCombatStatModifier(
    modifier: CombatStatModifier,
    multiplier: number,
): CombatStatModifier {
    return {
        maxHealth: modifier.maxHealth ? Math.max(1, Math.round(modifier.maxHealth * multiplier)) : undefined,
        attack: modifier.attack ? Math.max(1, Math.round(modifier.attack * multiplier)) : undefined,
        defense: modifier.defense ? Math.max(1, Math.round(modifier.defense * multiplier)) : undefined,
    };
}
