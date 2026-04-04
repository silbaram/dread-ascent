export interface BattleSceneBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface BattleScenePoint {
    readonly x: number;
    readonly y: number;
}

export const BATTLE_SCENE_LAYOUT = {
    enemyPanel: { x: 292, y: 92, width: 520, height: 116 },
    playerPanel: { x: 292, y: 278, width: 520, height: 116 },
    handPanel: { x: 292, y: 458, width: 520, height: 210 },
    logPanel: { x: 668, y: 152, width: 200, height: 236 },
    cardDetailPanel: { x: 668, y: 410, width: 200, height: 248 },
    endTurnButton: { x: 480, y: 384, width: 110, height: 40 },
    cardRow: { x: 292, y: 470 },
    deckCount: { x: 52, y: 546 },
    handCount: { x: 292, y: 546 },
    discardCount: { x: 532, y: 546 },
} as const satisfies {
    readonly enemyPanel: BattleSceneBounds;
    readonly playerPanel: BattleSceneBounds;
    readonly handPanel: BattleSceneBounds;
    readonly logPanel: BattleSceneBounds;
    readonly cardDetailPanel: BattleSceneBounds;
    readonly endTurnButton: BattleSceneBounds;
    readonly cardRow: BattleScenePoint;
    readonly deckCount: BattleScenePoint;
    readonly handCount: BattleScenePoint;
    readonly discardCount: BattleScenePoint;
};

export function battleSceneBoundsOverlap(first: BattleSceneBounds, second: BattleSceneBounds): boolean {
    const firstLeft = first.x - (first.width / 2);
    const firstRight = first.x + (first.width / 2);
    const firstTop = first.y - (first.height / 2);
    const firstBottom = first.y + (first.height / 2);
    const secondLeft = second.x - (second.width / 2);
    const secondRight = second.x + (second.width / 2);
    const secondTop = second.y - (second.height / 2);
    const secondBottom = second.y + (second.height / 2);

    return !(
        firstRight <= secondLeft
        || secondRight <= firstLeft
        || firstBottom <= secondTop
        || secondBottom <= firstTop
    );
}
