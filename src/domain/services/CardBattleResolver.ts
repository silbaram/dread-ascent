// ---------------------------------------------------------------------------
// Card Battle Resolver — 상성 판정 및 데미지 계산
// ---------------------------------------------------------------------------

import { CARD_TYPE, type Card } from '../entities/Card';

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export type MatchupType = 'ATTACK_VS_GUARD' | 'ATTACK_VS_ATTACK' | 'GUARD_VS_GUARD';

export interface CardClashResult {
    /** 플레이어가 받는 데미지 */
    readonly playerDamage: number;
    /** 적이 받는 데미지 */
    readonly enemyDamage: number;
    /** 플레이어가 사용한 카드 */
    readonly playerCard: Card;
    /** 적이 사용한 카드 */
    readonly enemyCard: Card;
    /** 상성 조합 유형 */
    readonly matchup: MatchupType;
    /** 판정 결과 설명 */
    readonly description: string;
}

// ---------------------------------------------------------------------------
// Resolver (순수 함수)
// ---------------------------------------------------------------------------

/** 양측이 낸 카드의 상성 판정 및 데미지를 계산한다. */
export function resolveCardClash(playerCard: Card, enemyCard: Card): CardClashResult {
    const matchup = determineMatchup(playerCard, enemyCard);

    switch (matchup) {
        case 'ATTACK_VS_GUARD':
            return resolveAttackVsGuard(playerCard, enemyCard);
        case 'ATTACK_VS_ATTACK':
            return resolveAttackVsAttack(playerCard, enemyCard);
        case 'GUARD_VS_GUARD':
            return resolveGuardVsGuard(playerCard, enemyCard);
    }
}

// ---------------------------------------------------------------------------
// Matchup Determination
// ---------------------------------------------------------------------------

function determineMatchup(playerCard: Card, enemyCard: Card): MatchupType {
    const isPlayerAttack = playerCard.type === CARD_TYPE.ATTACK;
    const isEnemyAttack = enemyCard.type === CARD_TYPE.ATTACK;

    if (isPlayerAttack && !isEnemyAttack) return 'ATTACK_VS_GUARD';
    if (!isPlayerAttack && isEnemyAttack) return 'ATTACK_VS_GUARD';
    if (isPlayerAttack && isEnemyAttack) return 'ATTACK_VS_ATTACK';
    return 'GUARD_VS_GUARD';
}

// ---------------------------------------------------------------------------
// Resolution by Matchup
// ---------------------------------------------------------------------------

/**
 * 공격 vs 수비: 공격 측은 (공격 파워 - 수비 파워) 데미지를 수비 측에 가한다.
 * 0 이하면 방어 성공 (데미지 0).
 */
function resolveAttackVsGuard(playerCard: Card, enemyCard: Card): CardClashResult {
    const isPlayerAttacker = playerCard.type === CARD_TYPE.ATTACK;
    const attackCard = isPlayerAttacker ? playerCard : enemyCard;
    const guardCard = isPlayerAttacker ? enemyCard : playerCard;

    const rawDamage = attackCard.power - guardCard.power;
    const effectiveDamage = Math.max(0, rawDamage);

    const playerDamage = isPlayerAttacker ? 0 : effectiveDamage;
    const enemyDamage = isPlayerAttacker ? effectiveDamage : 0;

    const description = effectiveDamage > 0
        ? `${attackCard.name} breaks through ${guardCard.name} for ${effectiveDamage} damage`
        : `${guardCard.name} fully blocks ${attackCard.name}`;

    return {
        playerDamage,
        enemyDamage,
        playerCard,
        enemyCard,
        matchup: 'ATTACK_VS_GUARD',
        description,
    };
}

/**
 * 공격 vs 공격: 양쪽 모두 상대 공격 파워만큼 데미지를 받는다.
 */
function resolveAttackVsAttack(playerCard: Card, enemyCard: Card): CardClashResult {
    const playerDamage = Math.max(0, enemyCard.power);
    const enemyDamage = Math.max(0, playerCard.power);

    return {
        playerDamage,
        enemyDamage,
        playerCard,
        enemyCard,
        matchup: 'ATTACK_VS_ATTACK',
        description: `Both attack! ${playerCard.name}(${playerCard.power}) clashes with ${enemyCard.name}(${enemyCard.power})`,
    };
}

/**
 * 수비 vs 수비: 양쪽 피해 없음 (라운드 소모).
 */
function resolveGuardVsGuard(playerCard: Card, enemyCard: Card): CardClashResult {
    return {
        playerDamage: 0,
        enemyDamage: 0,
        playerCard,
        enemyCard,
        matchup: 'GUARD_VS_GUARD',
        description: `Both guard — no damage dealt`,
    };
}
