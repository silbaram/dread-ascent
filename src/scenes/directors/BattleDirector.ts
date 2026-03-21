import type { Card } from '../../domain/entities/Card';
import { Enemy } from '../../domain/entities/Enemy';
import { Player } from '../../domain/entities/Player';
import { CardBattleService } from '../../domain/services/CardBattleService';
import { CardBattleLoopService, type BattleLoopState } from '../../domain/services/CardBattleLoopService';
import { getEquipmentCardBonus, applyEquipmentBonusToHand } from '../../domain/services/EquipmentCardBonusService';
import { CombatService } from '../../domain/services/CombatService';
import type { DeckService } from '../../domain/services/DeckService';
import { EnemyAiService } from '../../domain/services/EnemyAiService';
import type { ItemService } from '../../domain/services/ItemService';
import { type TurnActor, TurnQueueService } from '../../domain/services/TurnQueueService';
import { RotTurnScheduler } from '../../infra/rot/RotTurnScheduler';
import { RotFovCalculator } from '../../infra/rot/RotFovCalculator';
import { RotPathFinder } from '../../infra/rot/RotPathFinder';
import { isWalkableTile } from '../../shared/types/WorldTiles';
import { GameLocalization } from '../../ui/GameLocalization';
import { RenderSynchronizer } from '../synchronizers/RenderSynchronizer';
import { FloorDirector } from './FloorDirector';
import { MapData } from '../../infra/rot/MapGenerator';

export interface BattleOutcome {
    type: 'none' | 'game-over' | 'victory';
    boss?: Enemy;
    logs: Array<{ line: string; tone: any }>;
}

export interface CardBattleState {
    readonly enemy: Enemy;
    readonly playerHand: readonly Card[];
    readonly enemyCardPool: readonly Card[];
    readonly battleLoopState?: BattleLoopState;
}

export class BattleDirector {
    private turnQueue?: TurnQueueService;
    private cardBattleState?: CardBattleState;
    private readonly battleLoopService: CardBattleLoopService;

    constructor(
        private readonly combatService: CombatService,
        private readonly cardBattleService: CardBattleService,
        private readonly deckService: DeckService,
        private readonly itemService: ItemService,
        private readonly localization: GameLocalization,
        private readonly renderSynchronizer: RenderSynchronizer,
        private readonly floorDirector: FloorDirector,
    ) {
        this.battleLoopService = new CardBattleLoopService(this.cardBattleService);
    }

    public initializeTurnQueue(playerLabel: string) {
        this.turnQueue = new TurnQueueService(new RotTurnScheduler());
        this.turnQueue.initialize(
            {
                id: 'player',
                kind: 'player',
                label: playerLabel,
            },
            this.createEnemyTurnActors(),
        );
    }

    private createEnemyTurnActors(): TurnActor[] {
        return this.floorDirector.getEnemyEntities().map((enemy) => ({
            id: enemy.id,
            kind: 'enemy' as const,
            label: this.localization.getEnemyName(enemy.archetypeId, enemy.elite),
        }));
    }

    public isPlayerTurn(): boolean {
        return this.turnQueue?.getSnapshot().activeActor.kind === 'player';
    }

    public getTurnSnapshot() {
        return this.turnQueue?.getSnapshot();
    }

    /**
     * 카드 배틀 진입: 멀티 라운드 배틀을 실행하여 한 쪽 HP가 0 이하가 될 때까지 반복한다.
     * 덱이 비어있으면 기존 CombatService로 폴백한다.
     */
    public performPlayerAttack(player: Player, enemy: Enemy): BattleOutcome {
        const deckCards = this.deckService.getCards();
        const enemyCardPool = this.cardBattleService.generateEnemyCardPool(enemy.kind, enemy.elite);
        const logs: Array<{ line: string; tone: string }> = [];

        // 덱이 비어있으면 기존 전투로 폴백
        if (deckCards.length === 0) {
            return this.fallbackCombat(player, enemy, logs);
        }

        // 장비 보너스 추출 및 덱에 적용
        const equipmentBonus = getEquipmentCardBonus(this.itemService.getInventory());
        const boostedDeck = applyEquipmentBonusToHand(deckCards, equipmentBonus);

        // 멀티 라운드 배틀 루프 실행 (장비 보너스 적용된 덱 사용)
        const battleResult = this.battleLoopService.runFullBattle({
            deck: boostedDeck,
            enemyCardPool,
            playerHp: player.stats.health,
            playerMaxHp: player.stats.maxHealth,
            enemyHp: enemy.stats.health,
            enemyMaxHp: enemy.stats.maxHealth,
        });

        // 배틀 상태 저장 (UI 참조용 — 장비 보너스 반영된 손패)
        const initialDraw = this.cardBattleService.drawHand(boostedDeck);
        this.cardBattleState = {
            enemy,
            playerHand: initialDraw.hand,
            enemyCardPool,
            battleLoopState: this.battleLoopService.createBattleState({
                deck: boostedDeck,
                enemyCardPool,
                playerHp: player.stats.health,
                playerMaxHp: player.stats.maxHealth,
                enemyHp: enemy.stats.health,
                enemyMaxHp: enemy.stats.maxHealth,
            }),
        };

        // 각 라운드 결과를 로그 및 데미지 이펙트로 반영
        let totalPlayerDamage = 0;
        let totalEnemyDamage = 0;

        for (const round of battleResult.rounds) {
            const { playerCard, enemyCard, clashResult } = round;

            logs.push({
                line: `⚔️ R${round.round}: ${playerCard.name}(${playerCard.power}) vs ${enemyCard.name}(${enemyCard.power}) — ${clashResult.description}`,
                tone: 'combat',
            });

            totalPlayerDamage += clashResult.playerDamage;
            totalEnemyDamage += clashResult.enemyDamage;
        }

        // 최종 데미지를 엔티티에 적용
        if (totalEnemyDamage > 0) {
            enemy.applyDamage(totalEnemyDamage);
            this.renderSynchronizer.spawnFloatingDamage(enemy.position, totalEnemyDamage, false, 'enemy');
        }
        if (totalPlayerDamage > 0) {
            player.applyDamage(totalPlayerDamage);
            this.renderSynchronizer.spawnFloatingDamage(player.position, totalPlayerDamage, false, 'player');
        }

        // 배틀 요약 로그
        logs.push({
            line: `🏁 Battle ended in ${battleResult.totalRounds} round(s) — ${battleResult.outcome === 'player-win' ? 'Victory!' : 'Defeat...'}`,
            tone: battleResult.outcome === 'player-win' ? 'combat' : 'danger',
        });

        // 동시 사망 포함: enemy HP 0 이하이면 플레이어 승리
        if (enemy.isDead()) {
            return this.handleEnemyDefeat(enemy, logs);
        }

        if (player.isDead()) {
            return { type: 'game-over', logs };
        }

        // 여기에 도달하면 안 되지만 안전장치
        this.cardBattleState = undefined;
        return { type: 'none', logs };
    }

    /** 덱이 비어있을 때 기존 CombatService로 폴백한다. */
    private fallbackCombat(player: Player, enemy: Enemy, logs: Array<{ line: string; tone: string }>): BattleOutcome {
        const resolution = this.combatService.resolveAttack(player.stats, enemy.stats);
        enemy.applyDamage(resolution.damage);
        this.renderSynchronizer.spawnFloatingDamage(enemy.position, resolution.damage, resolution.isCritical, 'enemy');
        logs.push({
            line: this.localization.formatAttack(
                this.localization.getPlayerLabel(),
                this.localization.getEnemyName(enemy.archetypeId, enemy.elite),
                resolution.damage,
                resolution.isCritical,
            ),
            tone: 'combat',
        });

        if (resolution.targetDefeated) {
            return this.handleEnemyDefeat(enemy, logs);
        }
        return { type: 'none', logs };
    }

    /** 현재 카드 배틀 상태를 반환한다. */
    public getCardBattleState(): CardBattleState | undefined {
        return this.cardBattleState;
    }

    private handleEnemyDefeat(enemy: Enemy, logs: Array<{ line: string; tone: string }>): BattleOutcome {
        this.cardBattleState = undefined;
        if (enemy.isBoss()) {
            return { type: 'victory', boss: enemy, logs };
        }
        this.floorDirector.removeEnemy(enemy.id);
        this.renderSynchronizer.removeEnemySprite(enemy.id);
        this.refreshTurnQueueRoster();
        return { type: 'none', logs };
    }

    public resolveEnemyTurn(enemyTurn: TurnActor, player: Player, mapData: MapData): BattleOutcome {
        const enemy = this.floorDirector.getEnemyById(enemyTurn.id);
        const outcome: BattleOutcome = { type: 'none', logs: [] };

        if (!enemy) {
            outcome.logs.push({
                line: this.localization.formatActorMissing(enemyTurn.label),
                tone: 'system',
            });
            return outcome;
        }

        const enemyName = this.localization.getEnemyName(enemy.archetypeId, enemy.elite);

        const ai = new EnemyAiService(
            this.createEnemyPathFinder(enemy.id, player, mapData),
            new RotFovCalculator((x, y) => this.isWalkableMapTile(x, y, mapData)),
            8, // fovRadius
        );
        const action = ai.decide(enemy, player.position);

        switch (action.type) {
            case 'move':
                this.renderSynchronizer.synchronizeEnemies([enemy]);
                outcome.logs.push({
                    line: action.pursuit === 'player'
                        ? this.localization.formatEnemyAdvances(enemyName)
                        : this.localization.formatEnemySearches(enemyName),
                    tone: 'travel',
                });
                break;
            case 'attack': {
                const resolution = this.combatService.resolveAttack(enemy.stats, player.stats);
                player.applyDamage(resolution.damage);
                this.renderSynchronizer.spawnFloatingDamage(player.position, resolution.damage, resolution.isCritical, 'player');
                outcome.logs.push({
                    line: this.localization.formatAttack(
                        enemyName,
                        this.localization.getPlayerLabel(),
                        resolution.damage,
                        resolution.isCritical,
                    ),
                    tone: 'danger',
                });

                if (resolution.targetDefeated) {
                    outcome.type = 'game-over';
                }
                break;
            }
            case 'wait':
                outcome.logs.push({
                    line: this.localization.formatEnemyWait(enemyName, action.reason),
                    tone: 'system',
                });
                break;
        }

        return outcome;
    }

    public completePlayerTurn() {
        return this.turnQueue?.completePlayerTurn();
    }

    public refreshTurnQueueRoster() {
        this.turnQueue?.refresh(
            {
                id: 'player',
                kind: 'player',
                label: this.localization.getPlayerLabel(),
            },
            this.createEnemyTurnActors(),
        );
    }

    private createEnemyPathFinder(movingEnemyId: string, player: Player, mapData: MapData) {
        return new RotPathFinder((x, y) => {
            if (!this.isWithinMapBounds(x, y, mapData)) return false;
            if (player.position.x === x && player.position.y === y) return true;

            const movingEnemy = this.floorDirector.getEnemyById(movingEnemyId);
            if (movingEnemy && movingEnemy.position.x === x && movingEnemy.position.y === y) return true;

            if (!this.isWalkableMapTile(x, y, mapData)) return false;

            return !this.floorDirector.getEnemyEntities().some((enemy) =>
                enemy.id !== movingEnemyId && enemy.position.x === x && enemy.position.y === y,
            );
        });
    }

    private isWalkableMapTile(x: number, y: number, mapData: MapData) {
        if (!this.isWithinMapBounds(x, y, mapData)) {
            return false;
        }

        const tile = mapData.tiles[y]?.[x];
        if (tile === undefined) {
            return false;
        }

        return isWalkableTile(tile);
    }

    private isWithinMapBounds(x: number, y: number, mapData: MapData) {
        return x >= 0 && x < mapData.width && y >= 0 && y < mapData.height;
    }
}
