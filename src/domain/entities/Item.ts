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
    HELMET: 'HELMET',
    BODY_ARMOR: 'BODY_ARMOR',
    BOOTS: 'BOOTS',
    ARMOR: 'ARMOR',
    TRINKET: 'TRINKET',
} as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOT)[keyof typeof EQUIPMENT_SLOT];

export const PRIMARY_EQUIPMENT_SLOTS = [
    EQUIPMENT_SLOT.WEAPON,
    EQUIPMENT_SLOT.HELMET,
    EQUIPMENT_SLOT.BODY_ARMOR,
    EQUIPMENT_SLOT.BOOTS,
] as const satisfies readonly EquipmentSlot[];

export const ITEM_RARITY = {
    COMMON: 'COMMON',
    UNCOMMON: 'UNCOMMON',
    RARE: 'RARE',
    EPIC: 'EPIC',
    CURSED: 'CURSED',
} as const;

export type ItemRarity = (typeof ITEM_RARITY)[keyof typeof ITEM_RARITY];

export const ITEM_SPAWN_SOURCE = {
    FIELD: 'field',
    REWARD: 'reward',
    SPECIAL: 'special',
} as const;

export type ItemSpawnSource = (typeof ITEM_SPAWN_SOURCE)[keyof typeof ITEM_SPAWN_SOURCE];

export const ITEM_ID = {
    SMALL_POTION: 'small-potion',
    IRON_DAGGER: 'iron-dagger',
    RUSTY_AXE: 'rusty-axe',
    BONE_CLUB: 'bone-club',
    BLOOD_FANG: 'blood-fang',
    VENOM_FANG: 'venom-fang',
    TOWER_MACE: 'tower-mace',
    DREAD_REAPER: 'dread-reaper',
    SPINE_WHIP: 'spine-whip',
    SOULFIRE_BRAND: 'soulfire-brand',
    CURSED_EDGE: 'cursed-edge',
    SOUL_LEECH: 'soul-leech',
    LEATHER_CAP: 'leather-cap',
    IRON_HELM: 'iron-helm',
    SCOUTS_VISOR: 'scouts-visor',
    BLOOD_CROWN: 'blood-crown',
    WATCHERS_EYE: 'watchers-eye',
    PLAGUE_DOCTORS_MASK: 'plague-doctors-mask',
    TACTICIANS_CIRCLET: 'tacticians-circlet',
    ALL_SEEING_CROWN: 'all-seeing-crown',
    RUNIC_BLINDFOLD: 'runic-blindfold',
    MADMANS_HOOD: 'madmans-hood',
    LEATHER_VEST: 'leather-vest',
    CHAIN_MAIL: 'chain-mail',
    THORN_MAIL: 'thorn-mail',
    SHADOW_ROBE: 'shadow-robe',
    BERSERKER_HIDE: 'berserker-hide',
    WARDEN_PLATE: 'warden-plate',
    VITALITY_ARMOR: 'vitality-armor',
    BASTION_ARMOR: 'bastion-armor',
    MARTYRDOM_PLATE: 'martyrdom-plate',
    PACT_ARMOR: 'pact-armor',
    WORN_SANDALS: 'worn-sandals',
    IRON_BOOTS: 'iron-boots',
    SWIFT_GREAVES: 'swift-greaves',
    BLOOD_TREADS: 'blood-treads',
    SILENT_STEPS: 'silent-steps',
    WINDRUNNER_BOOTS: 'windrunner-boots',
    IRONCLAD_SABATONS: 'ironclad-sabatons',
    PHANTOM_STRIDE: 'phantom-stride',
    GAMBLERS_SHOES: 'gamblers-shoes',
    ESCAPE_ARTISTS_BOOTS: 'escape-artists-boots',
    SCRAP_BUNDLE: 'scrap-bundle',
    BRONZE_SIGIL: 'bronze-sigil',
    MOONSTEEL_SABER: 'moonsteel-saber',
    SUNFIRE_IDOL: 'sunfire-idol',
} as const;

export type ItemId = (typeof ITEM_ID)[keyof typeof ITEM_ID];

export interface ConsumableEffect {
    kind: 'heal';
    amount: number;
}

export interface EquipmentPassive {
    kind: string;
    value?: number;
}

export type EquipmentPassiveKind = EquipmentPassive['kind'];

export interface EquipmentDefinition {
    slot: EquipmentSlot;
    statModifier: CombatStatModifier;
    passives?: readonly EquipmentPassive[];
}

export interface ItemDefinition {
    id: ItemId;
    name: string;
    type: ItemType;
    rarity: ItemRarity;
    icon: string;
    stackable: boolean;
    maxStack: number;
    description: string;
    spawnSources?: readonly ItemSpawnSource[];
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
        id: ITEM_ID.SMALL_POTION,
        name: 'Small Potion',
        type: ITEM_TYPE.CONSUMABLE,
        rarity: ITEM_RARITY.COMMON,
        icon: '!',
        stackable: true,
        maxStack: 5,
        description: 'Restore 30 HP.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        consumableEffect: {
            kind: 'heal',
            amount: 30,
        },
    },
    {
        id: ITEM_ID.IRON_DAGGER,
        name: 'Iron Dagger',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'A light blade with ATK +2.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 2,
            },
        },
    },
    {
        id: ITEM_ID.RUSTY_AXE,
        name: 'Rusty Axe',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'A battered axe with ATK +3.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 3,
            },
        },
    },
    {
        id: ITEM_ID.BONE_CLUB,
        name: 'Bone Club',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'A crude club with ATK +2.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 2,
            },
        },
    },
    {
        id: ITEM_ID.BLOOD_FANG,
        name: 'Blood Fang',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +2. Attack cards lose 1 HP and gain +3 power.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 2,
            },
        },
    },
    {
        id: ITEM_ID.VENOM_FANG,
        name: 'Venom Fang',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +3. Attack cards apply Poison 1.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 3,
            },
        },
    },
    {
        id: ITEM_ID.TOWER_MACE,
        name: 'Tower Mace',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +4. Attack cards cost +1 and gain +4 power.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 4,
            },
        },
    },
    {
        id: ITEM_ID.DREAD_REAPER,
        name: 'Dread Reaper',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +5. Defeating an enemy restores 6 HP.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 5,
            },
        },
    },
    {
        id: ITEM_ID.SPINE_WHIP,
        name: 'Spine Whip',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +4. Multi-hit cards gain +1 damage per hit.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 4,
            },
        },
    },
    {
        id: ITEM_ID.SOULFIRE_BRAND,
        name: 'Soulfire Brand',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.EPIC,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +6. Start battle with Strength +2.',
        spawnSources: [ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 6,
            },
        },
    },
    {
        id: ITEM_ID.CURSED_EDGE,
        name: 'Cursed Edge',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +7. Attack cards gain +2 power, but battle starts with a Curse card in the deck.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 7,
            },
        },
    },
    {
        id: ITEM_ID.SOUL_LEECH,
        name: 'Soul Leech',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'ATK +5. Kills restore 12 HP and start the next battle with +1 Energy, but each turn starts with HP -2.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 5,
            },
        },
    },
    {
        id: ITEM_ID.LEATHER_CAP,
        name: 'Leather Cap',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'Max HP +5.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                maxHealth: 5,
            },
        },
    },
    {
        id: ITEM_ID.IRON_HELM,
        name: 'Iron Helm',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.SCOUTS_VISOR,
        name: "Scout's Visor",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'Max HP +5. Draw 1 extra card on the first turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                maxHealth: 5,
            },
        },
    },
    {
        id: ITEM_ID.BLOOD_CROWN,
        name: 'Blood Crown',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'Whenever you lose HP, the next attack gains +2 power.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.WATCHERS_EYE,
        name: "Watcher's Eye",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Guard cards gain +2 Block while the enemy intends to attack.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.PLAGUE_DOCTORS_MASK,
        name: "Plague Doctor's Mask",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Poison on the enemy no longer decays each turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.TACTICIANS_CIRCLET,
        name: "Tactician's Circlet",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Cards left in hand grant up to +2 draw next turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.ALL_SEEING_CROWN,
        name: 'All-Seeing Crown',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.EPIC,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1, Max HP +10. Reveal the enemy intent queue two turns ahead.',
        spawnSources: [ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {
                defense: 1,
                maxHealth: 10,
            },
        },
    },
    {
        id: ITEM_ID.RUNIC_BLINDFOLD,
        name: 'Runic Blindfold',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'Draw 1 extra card each turn, but enemy intent is hidden.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.MADMANS_HOOD,
        name: "Madman's Hood",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: '^',
        stackable: false,
        maxStack: 1,
        description: 'Opening hand cards gain +3 power, but battle starts with Vulnerable 2.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.HELMET,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.LEATHER_VEST,
        name: 'Leather Vest',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +2.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 2,
            },
        },
    },
    {
        id: ITEM_ID.CHAIN_MAIL,
        name: 'Chain Mail',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +2 and Max HP +5.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 2,
                maxHealth: 5,
            },
        },
    },
    {
        id: ITEM_ID.THORN_MAIL,
        name: 'Thorn Mail',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +2. Being hit reflects 2 damage.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 2,
            },
        },
    },
    {
        id: ITEM_ID.SHADOW_ROBE,
        name: 'Shadow Robe',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +2. Battle starts by applying Weak 1 to the enemy.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 2,
            },
        },
    },
    {
        id: ITEM_ID.BERSERKER_HIDE,
        name: 'Berserker Hide',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Guard cards gain +3 Block while at or below 50% HP.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.WARDEN_PLATE,
        name: 'Warden Plate',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +4. Guard cards gain +1 Block.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 4,
            },
        },
    },
    {
        id: ITEM_ID.VITALITY_ARMOR,
        name: 'Vitality Armor',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +3. Recover 2 HP at the start of each turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 3,
            },
        },
    },
    {
        id: ITEM_ID.BASTION_ARMOR,
        name: 'Bastion Armor',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.EPIC,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +5. Keep 30% of Block between turns.',
        spawnSources: [ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 5,
            },
        },
    },
    {
        id: ITEM_ID.MARTYRDOM_PLATE,
        name: 'Martyrdom Plate',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +3, Max HP -15. Taking damage grants Strength up to +3 per turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 3,
                maxHealth: -15,
            },
        },
    },
    {
        id: ITEM_ID.PACT_ARMOR,
        name: 'Pact Armor',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: ']',
        stackable: false,
        maxStack: 1,
        description: 'DEF +4. Guard cards gain +3 Block, but attack cards lose 2 power.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.BODY_ARMOR,
            statModifier: {
                defense: 4,
            },
        },
    },
    {
        id: ITEM_ID.WORN_SANDALS,
        name: 'Worn Sandals',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'UNCOMMON item rolls gain +3% chance.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.IRON_BOOTS,
        name: 'Iron Boots',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.SWIFT_GREAVES,
        name: 'Swift Greaves',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'Gain +1 energy on the first turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.BLOOD_TREADS,
        name: 'Blood Treads',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'Battle starts with HP -3. Attack cards gain +4 power on the first turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.SILENT_STEPS,
        name: 'Silent Steps',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'Battle starts by applying Poison 2 to the enemy.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.WINDRUNNER_BOOTS,
        name: 'Windrunner Boots',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Each turn has a 30% chance to gain +1 energy.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.IRONCLAD_SABATONS,
        name: 'Ironclad Sabatons',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.RARE,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Attack cards gain +2 power while you have at least 10 Block.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD, ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.PHANTOM_STRIDE,
        name: 'Phantom Stride',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.EPIC,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'DEF +1. Unspent energy grants that much extra draw next turn.',
        spawnSources: [ITEM_SPAWN_SOURCE.REWARD],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {
                defense: 1,
            },
        },
    },
    {
        id: ITEM_ID.GAMBLERS_SHOES,
        name: "Gambler's Shoes",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'Each turn starts with +1 energy and HP -3.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.ESCAPE_ARTISTS_BOOTS,
        name: "Escape Artist's Boots",
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.CURSED,
        icon: 'v',
        stackable: false,
        maxStack: 1,
        description: 'Guard cards lose 2 Block, but Shadow Step no longer exhausts and escape no longer costs an item.',
        spawnSources: [ITEM_SPAWN_SOURCE.SPECIAL],
        equipment: {
            slot: EQUIPMENT_SLOT.BOOTS,
            statModifier: {},
        },
    },
    {
        id: ITEM_ID.SCRAP_BUNDLE,
        name: 'Scrap Bundle',
        type: ITEM_TYPE.MATERIAL,
        rarity: ITEM_RARITY.COMMON,
        icon: '*',
        stackable: true,
        maxStack: 10,
        description: 'Loose salvaged parts for future upgrades.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD],
    },
    {
        id: ITEM_ID.BRONZE_SIGIL,
        name: 'Bronze Sigil',
        type: ITEM_TYPE.KEY,
        rarity: ITEM_RARITY.COMMON,
        icon: '?',
        stackable: false,
        maxStack: 1,
        description: 'Break the seal to reveal a special cache.',
        spawnSources: [ITEM_SPAWN_SOURCE.FIELD],
    },
    {
        id: ITEM_ID.MOONSTEEL_SABER,
        name: 'Moonsteel Saber',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.UNCOMMON,
        icon: '/',
        stackable: false,
        maxStack: 1,
        description: 'A legacy saber with ATK +5.',
        equipment: {
            slot: EQUIPMENT_SLOT.WEAPON,
            statModifier: {
                attack: 5,
            },
        },
    },
    {
        id: ITEM_ID.SUNFIRE_IDOL,
        name: 'Sunfire Idol',
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.EPIC,
        icon: '&',
        stackable: false,
        maxStack: 1,
        description: 'A legacy trinket with Max HP +20 and ATK +2.',
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
        ...cloneItemDefinition(definition),
        instanceId,
        quantity: 1,
        isEquipped: false,
    };
}

export function cloneConsumableEffect(
    effect?: ConsumableEffect,
): ConsumableEffect | undefined {
    return effect
        ? { ...effect }
        : undefined;
}

export function cloneEquipmentDefinition(
    equipment?: EquipmentDefinition,
): EquipmentDefinition | undefined {
    return equipment
        ? {
            slot: equipment.slot,
            statModifier: { ...equipment.statModifier },
            passives: equipment.passives?.map((passive) => ({ ...passive })),
        }
        : undefined;
}

export function cloneItemDefinition(
    definition: ItemDefinition,
): ItemDefinition {
    return {
        id: definition.id,
        name: definition.name,
        type: definition.type,
        rarity: definition.rarity,
        icon: definition.icon,
        stackable: definition.stackable,
        maxStack: definition.maxStack,
        description: definition.description,
        spawnSources: definition.spawnSources ? [...definition.spawnSources] : undefined,
        consumableEffect: cloneConsumableEffect(definition.consumableEffect),
        equipment: cloneEquipmentDefinition(definition.equipment),
    };
}

export function cloneInventoryItem(
    item: InventoryItem,
): InventoryItem {
    return {
        ...cloneItemDefinition(item),
        instanceId: item.instanceId,
        quantity: item.quantity,
        isEquipped: item.isEquipped,
    };
}

export function getItemRarityRank(rarity: ItemRarity): number {
    switch (rarity) {
        case ITEM_RARITY.CURSED:
            return 4;
        case ITEM_RARITY.EPIC:
            return 3;
        case ITEM_RARITY.RARE:
            return 2;
        case ITEM_RARITY.UNCOMMON:
            return 1;
        case ITEM_RARITY.COMMON:
        default:
            return 0;
    }
}

export function isPrimaryEquipmentSlot(slot: EquipmentSlot): slot is (typeof PRIMARY_EQUIPMENT_SLOTS)[number] {
    return PRIMARY_EQUIPMENT_SLOTS.includes(slot as (typeof PRIMARY_EQUIPMENT_SLOTS)[number]);
}
