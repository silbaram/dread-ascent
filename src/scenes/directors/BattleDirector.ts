import { Player } from '../../domain/entities/Player';
import { CombatService } from '../../domain/services/CombatService';
import { EnemyAiService } from '../../domain/services/EnemyAiService';
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
    type: 'none' | 'game-over';
    logs: Array<{ line: string; tone: any }>;
    /** Promise that resolves when the move animation completes. Undefined if no animation was triggered. */
    animationPromise?: Promise<void>;
}

export class BattleDirector {
    private turnQueue?: TurnQueueService;

    constructor(
        private readonly combatService: CombatService,
        private readonly localization: GameLocalization,
        private readonly renderSynchronizer: RenderSynchronizer,
        private readonly floorDirector: FloorDirector,
    ) {}

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

    public resolveEnemyTurn(
        enemyTurn: TurnActor,
        player: Player,
        mapData: MapData,
        animationOptions: { duration?: number; immediate?: boolean } = {},
    ): BattleOutcome {
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
                outcome.animationPromise = this.renderSynchronizer.synchronizeEnemies([enemy], animationOptions);
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
