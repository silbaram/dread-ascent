import type { CardCollectionSnapshot } from '../../domain/services/CardCollectionService';
import { GameHud } from '../../ui/GameHud';
import { GameLocalization } from '../../ui/GameLocalization';
import { SoulShardService } from '../../domain/services/SoulShardService';
import { PermanentUpgradeKey } from '../../domain/services/MetaProgressionService';

export interface OverlayState {
    isTitleScreenOpen: boolean;
    isSanctuaryOpen: boolean;
    isCardCollectionOpen: boolean;
    isInventoryOpen: boolean;
    isGameOver: boolean;
    isVictory: boolean;
}

export type TitleScreenMessage =
    | { key: 'sanctuary-help'; tone: any }
    | {
        key: 'upgrade-purchased';
        tone: any;
        upgradeKey: PermanentUpgradeKey;
        level: number;
    }
    | {
        key: 'upgrade-insufficient';
        tone: any;
        upgradeKey: PermanentUpgradeKey;
        missingSoulShards: number;
    };

export class OverlayController {
    private state: OverlayState = {
        isTitleScreenOpen: false,
        isSanctuaryOpen: false,
        isCardCollectionOpen: false,
        isInventoryOpen: false,
        isGameOver: false,
        isVictory: false,
    };
    private lastGameOverDetails = {
        floorNumber: 1,
        defeatedEnemies: 0,
        earnedSoulShards: 0,
    };
    private lastVictoryDetails = {
        floorNumber: 1,
        defeatedEnemies: 0,
        bossName: '',
    };
    private titleScreenMessage?: TitleScreenMessage;

    constructor(
        private readonly hud: GameHud,
        private readonly localization: GameLocalization,
        private readonly soulShardService: SoulShardService,
    ) {}

    public getState(): OverlayState {
        return { ...this.state };
    }

    public setTitleScreen(open: boolean) {
        this.state.isTitleScreenOpen = open;
    }

    public setSanctuary(open: boolean) {
        this.state.isSanctuaryOpen = open;
    }

    public setCardCollection(open: boolean) {
        this.state.isCardCollectionOpen = open;
    }

    public setInventory(open: boolean) {
        this.state.isInventoryOpen = open;
    }

    public setGameOver(open: boolean) {
        this.state.isGameOver = open;
        if (!open) {
            this.syncGameOverOverlay();
        }
    }

    public setVictory(open: boolean) {
        this.state.isVictory = open;
        if (!open) {
            this.syncVictoryOverlay();
        }
    }

    public setTitleScreenMessage(message?: TitleScreenMessage) {
        this.titleScreenMessage = message;
    }

    public getTitleScreenMessage() {
        return this.titleScreenMessage;
    }

    public syncTitleOverlay(
        canContinueRun: boolean,
        upgrades: any[],
        cardCollection: CardCollectionSnapshot,
    ) {
        this.hud.updateTitleScreen({
            isOpen: this.state.isTitleScreenOpen,
            isSanctuaryOpen: this.state.isSanctuaryOpen,
            isCardCollectionOpen: this.state.isCardCollectionOpen,
            totalSoulShards: this.soulShardService.getTotalSoulShards(),
            canContinueRun,
            sanctuaryMessage: this.getTitleScreenMessageText(),
            sanctuaryMessageTone: this.titleScreenMessage?.tone ?? 'system',
            upgrades,
            cardCollection,
        });
    }

    private getTitleScreenMessageText() {
        if (!this.titleScreenMessage) return undefined;

        switch (this.titleScreenMessage.key) {
            case 'sanctuary-help':
                return this.localization.formatSanctuaryHelp();
            case 'upgrade-purchased':
                return this.localization.formatUpgradeAdvanced(
                    this.titleScreenMessage.upgradeKey,
                    this.titleScreenMessage.level,
                );
            case 'upgrade-insufficient':
                return this.localization.formatUpgradeNeedMore(
                    this.titleScreenMessage.upgradeKey,
                    this.titleScreenMessage.missingSoulShards,
                );
        }
    }

    public updateGameOver(floorNumber: number, defeatedEnemies: number, earnedShards: number) {
        this.lastGameOverDetails = {
            floorNumber,
            defeatedEnemies,
            earnedSoulShards: earnedShards,
        };
        this.syncGameOverOverlay();
    }

    public updateVictory(floorNumber: number, defeatedEnemies: number, bossName: string) {
        this.lastVictoryDetails = {
            floorNumber,
            defeatedEnemies,
            bossName,
        };
        this.syncVictoryOverlay();
    }

    public syncBossHud(isVisible: boolean, name: string, health: number, maxHealth: number) {
        this.hud.updateBoss({
            isVisible: isVisible && !this.state.isTitleScreenOpen && !this.state.isGameOver && !this.state.isVictory,
            name,
            health,
            maxHealth,
        });
    }

    private syncGameOverOverlay() {
        this.hud.updateGameOver({
            isOpen: this.state.isGameOver,
            floorNumber: this.lastGameOverDetails.floorNumber,
            defeatedEnemies: this.lastGameOverDetails.defeatedEnemies,
            earnedSoulShards: this.lastGameOverDetails.earnedSoulShards,
            totalSoulShards: this.soulShardService.getTotalSoulShards(),
        });
    }

    private syncVictoryOverlay() {
        this.hud.updateVictory({
            isOpen: this.state.isVictory,
            floorNumber: this.lastVictoryDetails.floorNumber,
            defeatedEnemies: this.lastVictoryDetails.defeatedEnemies,
            bossName: this.lastVictoryDetails.bossName,
        });
    }
}
