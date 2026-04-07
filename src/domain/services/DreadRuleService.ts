import type {
    Enemy,
    EnemyArchetypeId,
} from '../entities/Enemy';

export const DREAD_RULE_ID = {
    BLACKOUT: 'blackout',
    BLOOD_MOON: 'blood-moon',
    PANIC_ROOM: 'panic-room',
    SUFFOCATING_FOG: 'suffocating-fog',
} as const;

export type DreadRuleId = (typeof DREAD_RULE_ID)[keyof typeof DREAD_RULE_ID];

export interface DreadRuleEffects {
    readonly hideEnemyIntentOnEvenTurns?: boolean;
    readonly firstSelfDamageStrength?: number;
    readonly turnEndSelfDamagePerUnspentEnergy?: number;
    readonly poisonDoesNotDecay?: boolean;
}

export interface DreadRuleDefinition {
    readonly id: DreadRuleId;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly effects: DreadRuleEffects;
}

export const BATTLE_DREAD_RULES: Record<DreadRuleId, DreadRuleDefinition> = {
    [DREAD_RULE_ID.BLACKOUT]: {
        id: DREAD_RULE_ID.BLACKOUT,
        name: 'Blackout',
        summary: 'Even turns hide enemy intent.',
        description: '짝수 턴에는 적 intent가 숨겨진다.',
        effects: {
            hideEnemyIntentOnEvenTurns: true,
        },
    },
    [DREAD_RULE_ID.BLOOD_MOON]: {
        id: DREAD_RULE_ID.BLOOD_MOON,
        name: 'Blood Moon',
        summary: 'First self-damage each turn grants +1 STR.',
        description: '매 턴 첫 self-damage 시 Strength +1.',
        effects: {
            firstSelfDamageStrength: 1,
        },
    },
    [DREAD_RULE_ID.PANIC_ROOM]: {
        id: DREAD_RULE_ID.PANIC_ROOM,
        name: 'Panic Room',
        summary: 'Unspent energy deals 1 self-damage each turn end.',
        description: '턴 종료 시 남은 에너지 1당 자해 1.',
        effects: {
            turnEndSelfDamagePerUnspentEnergy: 1,
        },
    },
    [DREAD_RULE_ID.SUFFOCATING_FOG]: {
        id: DREAD_RULE_ID.SUFFOCATING_FOG,
        name: 'Suffocating Fog',
        summary: 'Poison does not decay at turn end.',
        description: 'Poison이 턴 종료에 감소하지 않는다.',
        effects: {
            poisonDoesNotDecay: true,
        },
    },
};

const NORMAL_ARCHETYPE_RULE_MAP: Record<EnemyArchetypeId, DreadRuleId> = {
    'ash-crawler': DREAD_RULE_ID.BLOOD_MOON,
    'blade-raider': DREAD_RULE_ID.PANIC_ROOM,
    'dread-sentinel': DREAD_RULE_ID.SUFFOCATING_FOG,
    'final-boss': DREAD_RULE_ID.BLACKOUT,
};

type DreadRuleBattleEnemy = Pick<Enemy, 'archetypeId' | 'kind' | 'elite'>;

export class DreadRuleService {
    getRule(id: DreadRuleId): DreadRuleDefinition {
        return BATTLE_DREAD_RULES[id];
    }

    resolveForBattle(enemy: DreadRuleBattleEnemy): DreadRuleDefinition {
        if (enemy.kind === 'boss' || enemy.elite) {
            return this.getRule(DREAD_RULE_ID.BLACKOUT);
        }

        return this.getRule(NORMAL_ARCHETYPE_RULE_MAP[enemy.archetypeId]);
    }

    decideRule(enemy: Enemy): DreadRuleDefinition {
        return this.resolveForBattle(enemy);
    }

    isBlackoutTurn(rule: DreadRuleDefinition | undefined, turnNumber: number): boolean {
        return rule?.effects.hideEnemyIntentOnEvenTurns === true
            && turnNumber > 0
            && turnNumber % 2 === 0;
    }
}
