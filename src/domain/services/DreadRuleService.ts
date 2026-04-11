import type {
    Enemy,
    EnemyArchetypeId,
} from '../entities/Enemy';

export const DREAD_RULE_ID = {
    BLACKOUT: 'blackout',
    BLOOD_MOON: 'blood-moon',
    PANIC_ROOM: 'panic-room',
    SUFFOCATING_FOG: 'suffocating-fog',
    THIN_WALL: 'thin-wall',
    LAST_LANTERN: 'last-lantern',
} as const;

export type DreadRuleId = (typeof DREAD_RULE_ID)[keyof typeof DREAD_RULE_ID];

export interface DreadRuleEffects {
    readonly hideEnemyIntentOnEvenTurns?: boolean;
    readonly firstSelfDamageStrength?: number;
    readonly turnEndSelfDamagePerUnspentEnergy?: number;
    readonly poisonDoesNotDecay?: boolean;
    readonly blockRetainRatio?: number;
    readonly lastCardPowerBonus?: number;
    readonly lastSkillExhausts?: boolean;
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
    [DREAD_RULE_ID.THIN_WALL]: {
        id: DREAD_RULE_ID.THIN_WALL,
        name: 'Thin Wall',
        summary: 'Retained Block is cut in half.',
        description: '턴 경계에 남는 Block은 절반만 유지된다.',
        effects: {
            blockRetainRatio: 0.5,
        },
    },
    [DREAD_RULE_ID.LAST_LANTERN]: {
        id: DREAD_RULE_ID.LAST_LANTERN,
        name: 'Last Lantern',
        summary: 'The last card each turn gains +4 power; Skills Exhaust.',
        description: '이번 턴 마지막 카드의 위력 +4. Skill이면 Exhaust.',
        effects: {
            lastCardPowerBonus: 4,
            lastSkillExhausts: true,
        },
    },
};

const NORMAL_ARCHETYPE_RULE_MAP: Record<EnemyArchetypeId, DreadRuleId> = {
    'ash-crawler': DREAD_RULE_ID.BLOOD_MOON,
    'mire-broodling': DREAD_RULE_ID.THIN_WALL,
    'blade-raider': DREAD_RULE_ID.PANIC_ROOM,
    'dread-sentinel': DREAD_RULE_ID.SUFFOCATING_FOG,
    'final-boss': DREAD_RULE_ID.BLACKOUT,
};

type DreadRuleBattleEnemy = Pick<Enemy, 'archetypeId' | 'kind' | 'elite'>;

export const LATE_FLOOR_DREAD_RULE_STACK_START = 60;

export interface DreadRuleBattleContext {
    readonly floorNumber?: number;
    readonly isShowdown?: boolean;
    readonly explicitRuleIds?: readonly DreadRuleId[];
}

export class DreadRuleService {
    getRule(id: DreadRuleId): DreadRuleDefinition {
        return BATTLE_DREAD_RULES[id];
    }

    resolveForBattle(
        enemy: DreadRuleBattleEnemy,
        context: DreadRuleBattleContext = {},
    ): DreadRuleDefinition {
        const explicitRules = this.resolveExplicitRules(context.explicitRuleIds);
        if (explicitRules.length > 0) {
            return this.combineRuleSet(explicitRules);
        }

        if (context.isShowdown === true || enemy.kind === 'boss') {
            return this.combineRuleSet([
                this.getRule(DREAD_RULE_ID.BLACKOUT),
                this.getRule(DREAD_RULE_ID.LAST_LANTERN),
            ]);
        }

        const archetypeRule = this.getRule(
            NORMAL_ARCHETYPE_RULE_MAP[enemy.archetypeId] ?? DREAD_RULE_ID.BLOOD_MOON,
        );
        if (enemy.elite) {
            return this.combineRuleSet([
                this.getRule(DREAD_RULE_ID.BLACKOUT),
                archetypeRule,
            ]);
        }

        if (this.isLateFloor(context.floorNumber)) {
            return this.combineRuleSet([
                archetypeRule,
                this.getRule(DREAD_RULE_ID.LAST_LANTERN),
            ]);
        }

        return archetypeRule;
    }

    decideRule(enemy: Enemy, context: DreadRuleBattleContext = {}): DreadRuleDefinition {
        return this.resolveForBattle(enemy, context);
    }

    isBlackoutTurn(rule: DreadRuleDefinition | undefined, turnNumber: number): boolean {
        return rule?.effects.hideEnemyIntentOnEvenTurns === true
            && turnNumber > 0
            && turnNumber % 2 === 0;
    }

    private combineRules(
        primaryRule: DreadRuleDefinition,
        secondaryRule: DreadRuleDefinition,
    ): DreadRuleDefinition {
        if (primaryRule.id === secondaryRule.id) {
            return primaryRule;
        }

        return {
            id: primaryRule.id,
            name: `${primaryRule.name} + ${secondaryRule.name}`,
            summary: `${primaryRule.summary} ${secondaryRule.summary}`,
            description: `${primaryRule.description} ${secondaryRule.description}`,
            effects: {
                ...primaryRule.effects,
                ...secondaryRule.effects,
            },
        };
    }

    private combineRuleSet(rules: readonly DreadRuleDefinition[]): DreadRuleDefinition {
        const uniqueRules = rules.filter((rule, index, allRules) =>
            allRules.findIndex((candidate) => candidate.id === rule.id) === index,
        );
        const [firstRule, ...remainingRules] = uniqueRules;
        if (!firstRule) {
            return this.getRule(DREAD_RULE_ID.BLOOD_MOON);
        }

        return remainingRules.reduce(
            (combinedRule, nextRule) => this.combineRules(combinedRule, nextRule),
            firstRule,
        );
    }

    private resolveExplicitRules(ruleIds: readonly DreadRuleId[] | undefined): readonly DreadRuleDefinition[] {
        if (!ruleIds || ruleIds.length === 0) {
            return [];
        }

        return ruleIds.map((ruleId) => this.getRule(ruleId));
    }

    private isLateFloor(floorNumber: number | undefined): boolean {
        return Number.isFinite(floorNumber)
            && Math.floor(floorNumber ?? 0) >= LATE_FLOOR_DREAD_RULE_STACK_START;
    }
}
