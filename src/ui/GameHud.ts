import type { InventoryItem } from '../domain/entities/Item';
import type {
    MetaUpgradeSnapshot,
    PermanentUpgradeKey,
} from '../domain/services/MetaProgressionService';
import type { SoulShardAwardSummary } from '../domain/services/SoulShardService';
import { formatSignedNumber } from '../shared/utils/formatSignedNumber';
import { GameLocalization } from './GameLocalization';

export type HudLogTone = 'combat' | 'danger' | 'item' | 'travel' | 'system';

export interface HudStatusSnapshot {
    floorNumber: number;
    floorType: string;
    health: number;
    maxHealth: number;
    experience: number;
    activeTurn: string;
    enemyCount: number;
    isGameOver: boolean;
    runState?: 'playing' | 'game-over' | 'victory';
}

interface HudLogEntry {
    message: string;
    tone: HudLogTone;
}

interface HudEventBannerSnapshot {
    isVisible: boolean;
    message: string;
    tone: HudLogTone;
}

export interface InventoryOverlaySnapshot {
    isOpen: boolean;
    items: InventoryItem[];
    selectedItemId?: string;
    slotCapacity: number;
    usedSlots: number;
}

export interface InventoryOverlayHandlers {
    onClose: () => void;
    onUseItem: () => void;
    onDropItem: () => void;
    onSelectItem: (instanceId: string) => void;
}

export interface GameOverOverlaySnapshot extends SoulShardAwardSummary {
    isOpen: boolean;
}

export interface BossHudSnapshot {
    isVisible: boolean;
    name: string;
    health: number;
    maxHealth: number;
}

export interface VictoryOverlaySnapshot {
    isOpen: boolean;
    floorNumber: number;
    defeatedEnemies: number;
    bossName: string;
}

export interface TitleOverlaySnapshot {
    isOpen: boolean;
    totalSoulShards: number;
    canContinueRun: boolean;
    isSanctuaryOpen: boolean;
    sanctuaryMessage?: string;
    sanctuaryMessageTone?: HudLogTone;
    upgrades: MetaUpgradeSnapshot[];
}

export interface RunOverlayHandlers {
    onContinueRun: () => void;
    onReturnToTitle: () => void;
    onStartNewRun: () => void;
    onOpenSanctuary: () => void;
    onCloseSanctuary: () => void;
    onPurchaseUpgrade: (key: PermanentUpgradeKey) => void;
}

export class GameHud {
    private readonly logs: HudLogEntry[] = [];
    private readonly maxLogs = 50;
    private readonly eventBannerQueue: Array<{
        message: string;
        tone: HudLogTone;
        durationMs: number;
    }> = [];
    private eventBannerTimeoutId?: ReturnType<typeof setTimeout>;
    private eventBannerSnapshot: HudEventBannerSnapshot = {
        isVisible: false,
        message: '',
        tone: 'system',
    };
    private gameOverSnapshot: GameOverOverlaySnapshot = {
        isOpen: false,
        floorNumber: 1,
        defeatedEnemies: 0,
        earnedSoulShards: 0,
        totalSoulShards: 0,
    };
    private bossSnapshot: BossHudSnapshot = {
        isVisible: false,
        name: 'Final Boss',
        health: 0,
        maxHealth: 0,
    };
    private victorySnapshot: VictoryOverlaySnapshot = {
        isOpen: false,
        floorNumber: 100,
        defeatedEnemies: 0,
        bossName: 'Final Boss',
    };
    private titleSnapshot: TitleOverlaySnapshot = {
        isOpen: false,
        totalSoulShards: 0,
        canContinueRun: false,
        isSanctuaryOpen: false,
        sanctuaryMessageTone: 'system',
        upgrades: [],
    };
    private statusSnapshot?: HudStatusSnapshot;
    private inventorySnapshot: InventoryOverlaySnapshot = {
        isOpen: false,
        items: [],
        slotCapacity: 12,
        usedSlots: 0,
    };
    private inventoryHandlers?: InventoryOverlayHandlers;
    private runOverlayHandlers?: RunOverlayHandlers;
    private healthValue!: HTMLElement;
    private expValue!: HTMLElement;
    private floorValue!: HTMLElement;
    private turnValue!: HTMLElement;
    private enemyValue!: HTMLElement;
    private stateValue!: HTMLElement;
    private bossPanel!: HTMLElement;
    private bossNameValue!: HTMLElement;
    private bossHealthValue!: HTMLElement;
    private bossBarValue!: HTMLElement;
    private logList!: HTMLElement;
    private eventBanner!: HTMLElement;
    private eventBannerText!: HTMLElement;
    private titleOverlay!: HTMLElement;
    private titleSoulShardsValue!: HTMLElement;
    private titleContinueButton!: HTMLButtonElement;
    private titleMessage!: HTMLElement;
    private titleSanctuary!: HTMLElement;
    private gameOverOverlay!: HTMLElement;
    private gameOverFloorValue!: HTMLElement;
    private gameOverKillsValue!: HTMLElement;
    private gameOverEarnedValue!: HTMLElement;
    private gameOverTotalValue!: HTMLElement;
    private victoryOverlay!: HTMLElement;
    private victoryFloorValue!: HTMLElement;
    private victoryKillsValue!: HTMLElement;
    private victoryBossValue!: HTMLElement;
    private inventoryOverlay!: HTMLElement;
    private inventoryCapacityValue!: HTMLElement;
    private inventoryList!: HTMLElement;
    private inventoryDetail!: HTMLElement;
    private inventoryUseButton!: HTMLButtonElement;
    private inventoryDropButton!: HTMLButtonElement;

    constructor(
        private readonly root: HTMLElement,
        private readonly localization: GameLocalization = new GameLocalization(),
    ) {
        this.renderShell();
        this.root.addEventListener('click', (event) => {
            this.handleClick(event);
        });
        this.localization.subscribe(() => {
            this.renderShell();
            this.renderAll();
        });
        this.renderAll();
    }

    updateStatus(snapshot: HudStatusSnapshot) {
        this.statusSnapshot = { ...snapshot };
        this.renderStatus();
    }

    private renderShell() {
        const { ui } = this.localization.getBundle();

        this.root.innerHTML = `
            <div class="game-hud">
                <section class="game-hud__top">
                    <div class="game-hud__brand">
                        <span class="game-hud__eyebrow">${ui.brand}</span>
                        <strong class="game-hud__title">${ui.hudTitle}</strong>
                        ${this.renderLanguageSwitch('compact')}
                    </div>
                    <div class="game-hud__stats">
                        <article class="game-hud__card">
                            <span class="game-hud__label">${ui.floorLabel}</span>
                            <strong class="game-hud__value" data-role="floor"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">${ui.healthLabel}</span>
                            <strong class="game-hud__value" data-role="health"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">${ui.experienceLabel}</span>
                            <strong class="game-hud__value" data-role="exp"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">${ui.turnLabel}</span>
                            <strong class="game-hud__value" data-role="turn"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">${ui.enemiesLabel}</span>
                            <strong class="game-hud__value" data-role="enemies"></strong>
                        </article>
                        <article class="game-hud__card game-hud__card--state">
                            <span class="game-hud__label">${ui.stateLabel}</span>
                            <strong class="game-hud__value" data-role="state"></strong>
                        </article>
                    </div>
                    <aside class="game-hud__boss-panel" data-role="boss-panel" data-open="false">
                        <div class="game-hud__boss-head">
                            <span class="game-hud__eyebrow">${ui.bossEyebrow}</span>
                            <strong class="game-hud__title" data-role="boss-name"></strong>
                            <span class="game-hud__value" data-role="boss-health"></span>
                        </div>
                        <div class="game-hud__boss-bar">
                            <div class="game-hud__boss-bar-fill" data-role="boss-bar"></div>
                        </div>
                    </aside>
                </section>
                <section class="game-hud__bottom">
                    <div class="game-hud__log-shell">
                        <div class="game-hud__log-header">
                            <span class="game-hud__eyebrow">${ui.logEyebrow}</span>
                            <strong class="game-hud__title">${ui.logTitle}</strong>
                        </div>
                        <ol
                            class="game-hud__log-list"
                            data-role="log-list"
                            aria-live="polite"
                            aria-atomic="false"
                        ></ol>
                    </div>
                </section>
                <div
                    class="game-hud__event-banner"
                    data-role="event-banner"
                    data-open="false"
                    data-tone="system"
                >
                    <strong class="game-hud__event-banner-text" data-role="event-banner-text"></strong>
                </div>
                <section class="game-hud__title-overlay" data-role="title-overlay" data-open="false">
                    <div class="game-hud__title-panel">
                        <span class="game-hud__eyebrow">${ui.titleEyebrow}</span>
                        <strong class="game-hud__title game-hud__title--hero">${ui.titleHero}</strong>
                        <p class="game-hud__title-copy">
                            ${ui.titleCopy}
                        </p>
                        ${this.renderLanguageSwitch('full')}
                        <div class="game-hud__title-stats">
                            <span class="game-hud__label">${ui.soulShardsLabel}</span>
                            <strong class="game-hud__value" data-role="title-soul-shards"></strong>
                        </div>
                        <div class="game-hud__title-actions">
                            <button class="game-hud__title-action" type="button" data-role="title-continue">
                                ${ui.continueLabel}
                            </button>
                            <button class="game-hud__title-action" type="button" data-role="title-start">
                                ${ui.newRunLabel}
                            </button>
                            <button class="game-hud__title-action game-hud__title-action--secondary" type="button" data-role="title-open-sanctuary">
                                ${ui.sanctuaryLabel}
                            </button>
                        </div>
                        <p class="game-hud__title-message" data-role="title-message"></p>
                        <div class="game-hud__title-sanctuary" data-role="title-sanctuary" data-open="false"></div>
                    </div>
                </section>
                <section class="game-hud__gameover-overlay" data-role="gameover-overlay" data-open="false">
                    <div class="game-hud__gameover-panel">
                        <span class="game-hud__eyebrow">${ui.runEndedEyebrow}</span>
                        <strong class="game-hud__title game-hud__title--hero">${ui.gameOverTitle}</strong>
                        <div class="game-hud__gameover-stats">
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.floorReachedLabel}</span>
                                <strong class="game-hud__value" data-role="gameover-floor"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.enemiesDefeatedLabel}</span>
                                <strong class="game-hud__value" data-role="gameover-kills"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.earnedShardsLabel}</span>
                                <strong class="game-hud__value" data-role="gameover-earned"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.totalShardsLabel}</span>
                                <strong class="game-hud__value" data-role="gameover-total"></strong>
                            </article>
                        </div>
                        <button class="game-hud__title-action" type="button" data-role="gameover-return-title">
                            ${ui.returnToTitleLabel}
                        </button>
                    </div>
                </section>
                <section class="game-hud__victory-overlay" data-role="victory-overlay" data-open="false">
                    <div class="game-hud__victory-panel">
                        <span class="game-hud__eyebrow">${ui.endingEyebrow}</span>
                        <strong class="game-hud__title game-hud__title--hero">${ui.victoryTitle}</strong>
                        <p class="game-hud__title-copy">
                            ${ui.victoryCopy}
                        </p>
                        <div class="game-hud__gameover-stats">
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.floorClearedLabel}</span>
                                <strong class="game-hud__value" data-role="victory-floor"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.enemiesDefeatedLabel}</span>
                                <strong class="game-hud__value" data-role="victory-kills"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">${ui.bossDefeatedLabel}</span>
                                <strong class="game-hud__value" data-role="victory-boss"></strong>
                            </article>
                        </div>
                        <button class="game-hud__title-action" type="button" data-role="victory-return-title">
                            ${ui.returnToTitleLabel}
                        </button>
                    </div>
                </section>
                <section class="game-hud__inventory-overlay" data-role="inventory-overlay" data-open="false">
                    <div class="game-hud__inventory-panel">
                        <header class="game-hud__inventory-header">
                            <button
                                class="game-hud__inventory-close"
                                type="button"
                                data-role="inventory-close"
                            >
                                ${ui.inventoryCloseLabel}
                            </button>
                            <div>
                                <span class="game-hud__eyebrow">${ui.inventoryEyebrow}</span>
                                <strong class="game-hud__title">${ui.inventoryTitle}</strong>
                            </div>
                            <strong class="game-hud__inventory-capacity" data-role="inventory-capacity"></strong>
                        </header>
                        <div class="game-hud__inventory-body">
                            <div class="game-hud__inventory-grid" data-role="inventory-list"></div>
                            <aside class="game-hud__inventory-detail" data-role="inventory-detail"></aside>
                        </div>
                        <footer class="game-hud__inventory-actions">
                            <button
                                class="game-hud__inventory-action"
                                type="button"
                                data-role="inventory-use"
                            >
                                ${ui.useLabel}
                            </button>
                            <button
                                class="game-hud__inventory-action game-hud__inventory-action--accent"
                                type="button"
                                data-role="inventory-drop"
                            >
                                ${ui.dropLabel}
                            </button>
                        </footer>
                    </div>
                </section>
            </div>
        `;
        this.bindElements();
    }

    private bindElements() {
        this.healthValue = this.requireRole('health');
        this.expValue = this.requireRole('exp');
        this.floorValue = this.requireRole('floor');
        this.turnValue = this.requireRole('turn');
        this.enemyValue = this.requireRole('enemies');
        this.stateValue = this.requireRole('state');
        this.bossPanel = this.requireRole('boss-panel');
        this.bossNameValue = this.requireRole('boss-name');
        this.bossHealthValue = this.requireRole('boss-health');
        this.bossBarValue = this.requireRole('boss-bar');
        this.logList = this.requireRole('log-list');
        this.eventBanner = this.requireRole('event-banner');
        this.eventBannerText = this.requireRole('event-banner-text');
        this.titleOverlay = this.requireRole('title-overlay');
        this.titleSoulShardsValue = this.requireRole('title-soul-shards');
        this.titleContinueButton = this.requireRole<HTMLButtonElement>('title-continue');
        this.titleMessage = this.requireRole('title-message');
        this.titleSanctuary = this.requireRole('title-sanctuary');
        this.gameOverOverlay = this.requireRole('gameover-overlay');
        this.gameOverFloorValue = this.requireRole('gameover-floor');
        this.gameOverKillsValue = this.requireRole('gameover-kills');
        this.gameOverEarnedValue = this.requireRole('gameover-earned');
        this.gameOverTotalValue = this.requireRole('gameover-total');
        this.victoryOverlay = this.requireRole('victory-overlay');
        this.victoryFloorValue = this.requireRole('victory-floor');
        this.victoryKillsValue = this.requireRole('victory-kills');
        this.victoryBossValue = this.requireRole('victory-boss');
        this.inventoryOverlay = this.requireRole('inventory-overlay');
        this.inventoryCapacityValue = this.requireRole('inventory-capacity');
        this.inventoryList = this.requireRole('inventory-list');
        this.inventoryDetail = this.requireRole('inventory-detail');
        this.inventoryUseButton = this.requireRole<HTMLButtonElement>('inventory-use');
        this.inventoryDropButton = this.requireRole<HTMLButtonElement>('inventory-drop');
    }

    private renderAll() {
        this.renderStatus();
        this.renderLogs();
        this.renderTitleOverlay();
        this.renderGameOverOverlay();
        this.renderVictoryOverlay();
        this.renderBossPanel();
        this.renderInventory();
        this.renderEventBanner();
    }

    private renderStatus() {
        if (!this.statusSnapshot) {
            return;
        }

        const runState = this.statusSnapshot.runState
            ?? (this.statusSnapshot.isGameOver ? 'game-over' : 'playing');
        this.floorValue.textContent = this.localization.formatFloorValue(
            this.statusSnapshot.floorNumber,
            this.statusSnapshot.floorType,
        );
        this.healthValue.textContent = `${this.statusSnapshot.health} / ${this.statusSnapshot.maxHealth}`;
        this.expValue.textContent = this.localization.formatExperience(this.statusSnapshot.experience);
        this.turnValue.textContent = this.statusSnapshot.activeTurn;
        this.enemyValue.textContent = `${this.statusSnapshot.enemyCount}`;
        this.stateValue.textContent = this.localization.formatRunState(runState);
        this.root.dataset.state = runState;
    }

    private renderLanguageSwitch(variant: 'compact' | 'full') {
        const { ui } = this.localization.getBundle();
        return `
            <div class="game-hud__locale-switch game-hud__locale-switch--${variant}" aria-label="${ui.languageLabel}">
                ${this.localization.getSupportedLocales().map((locale) => `
                    <button
                        class="game-hud__locale-button"
                        type="button"
                        data-locale="${locale}"
                        aria-pressed="${this.localization.getLocale() === locale ? 'true' : 'false'}"
                    >
                        ${locale.toUpperCase()}
                    </button>
                `).join('')}
            </div>
        `;
    }

    pushLog(message: string, tone: HudLogTone = 'system') {
        this.logs.push({ message, tone });
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        this.renderLogs();
    }

    clearLogs() {
        this.logs.length = 0;
        this.renderLogs();
    }

    queueEventBanner(message: string, tone: HudLogTone = 'travel', durationMs = 2000) {
        this.eventBannerQueue.push({ message, tone, durationMs });
        if (!this.eventBannerSnapshot.isVisible) {
            this.renderNextEventBanner();
        }
    }

    clearEventBanner() {
        if (this.eventBannerTimeoutId) {
            clearTimeout(this.eventBannerTimeoutId);
            this.eventBannerTimeoutId = undefined;
        }

        this.eventBannerQueue.length = 0;
        this.eventBannerSnapshot = {
            isVisible: false,
            message: '',
            tone: 'system',
        };
        this.renderEventBanner();
    }

    setInventoryHandlers(handlers: InventoryOverlayHandlers) {
        this.inventoryHandlers = handlers;
    }

    setRunOverlayHandlers(handlers: RunOverlayHandlers) {
        this.runOverlayHandlers = handlers;
    }

    updateInventory(snapshot: InventoryOverlaySnapshot) {
        this.inventorySnapshot = {
            ...snapshot,
            items: snapshot.items.map((item) => ({ ...item })),
        };
        this.renderInventory();
    }

    updateGameOver(snapshot: GameOverOverlaySnapshot) {
        this.gameOverSnapshot = { ...snapshot };
        this.renderGameOverOverlay();
    }

    updateBoss(snapshot: BossHudSnapshot) {
        this.bossSnapshot = { ...snapshot };
        this.renderBossPanel();
    }

    updateVictory(snapshot: VictoryOverlaySnapshot) {
        this.victorySnapshot = { ...snapshot };
        this.renderVictoryOverlay();
    }

    updateTitleScreen(snapshot: TitleOverlaySnapshot) {
        this.titleSnapshot = {
            ...snapshot,
            upgrades: snapshot.upgrades.map((upgrade) => ({ ...upgrade })),
        };
        this.renderTitleOverlay();
    }

    private renderLogs() {
        this.logList.innerHTML = this.logs
            .map((entry) => `
                <li class="game-hud__log-entry game-hud__log-entry--${entry.tone}">
                    <span class="game-hud__log-dot"></span>
                    <span>${entry.message}</span>
                </li>
            `)
            .join('');
        this.logList.scrollTop = this.logList.scrollHeight;
    }

    private renderNextEventBanner() {
        const nextBanner = this.eventBannerQueue.shift();
        if (!nextBanner) {
            this.eventBannerSnapshot = {
                isVisible: false,
                message: '',
                tone: 'system',
            };
            this.renderEventBanner();
            return;
        }

        if (this.eventBannerTimeoutId) {
            clearTimeout(this.eventBannerTimeoutId);
        }

        this.eventBannerSnapshot = {
            isVisible: true,
            message: nextBanner.message,
            tone: nextBanner.tone,
        };
        this.renderEventBanner();
        this.eventBannerTimeoutId = setTimeout(() => {
            this.eventBannerTimeoutId = undefined;
            this.eventBannerSnapshot = {
                isVisible: false,
                message: '',
                tone: 'system',
            };
            this.renderEventBanner();
            if (this.eventBannerQueue.length > 0) {
                this.renderNextEventBanner();
            }
        }, nextBanner.durationMs);
    }

    private renderEventBanner() {
        this.eventBanner.dataset.open = this.eventBannerSnapshot.isVisible ? 'true' : 'false';
        this.eventBanner.dataset.tone = this.eventBannerSnapshot.tone;
        this.eventBannerText.textContent = this.eventBannerSnapshot.message;
    }

    private renderTitleOverlay() {
        const { ui } = this.localization.getBundle();
        this.titleOverlay.dataset.open = this.titleSnapshot.isOpen ? 'true' : 'false';
        this.titleSoulShardsValue.textContent = `${this.titleSnapshot.totalSoulShards}`;
        this.titleContinueButton.disabled = !this.titleSnapshot.canContinueRun;
        this.titleMessage.textContent = this.titleSnapshot.sanctuaryMessage ?? '';
        this.titleMessage.dataset.visible = this.titleSnapshot.sanctuaryMessage ? 'true' : 'false';
        this.titleMessage.dataset.tone = this.titleSnapshot.sanctuaryMessageTone ?? 'system';
        this.titleSanctuary.dataset.open = this.titleSnapshot.isSanctuaryOpen ? 'true' : 'false';
        this.titleSanctuary.innerHTML = this.titleSnapshot.isSanctuaryOpen
            ? `
                <div class="game-hud__sanctuary-header">
                    <div>
                        <span class="game-hud__eyebrow">${ui.sanctuaryEyebrow}</span>
                        <strong class="game-hud__title">${ui.sanctuaryLabel}</strong>
                    </div>
                    <button
                        class="game-hud__title-action game-hud__title-action--secondary"
                        type="button"
                        data-role="title-close-sanctuary"
                    >
                        ${ui.sanctuaryBackLabel}
                    </button>
                </div>
                <div class="game-hud__sanctuary-grid">
                    ${this.titleSnapshot.upgrades.map((upgrade) => {
                        const localizedUpgrade = this.localization.getUpgradeText(upgrade.key);
                        return `
                        <article class="game-hud__sanctuary-card">
                            <span class="game-hud__eyebrow">${this.escapeHtml(localizedUpgrade.statLabel)}</span>
                            <strong class="game-hud__title">${this.escapeHtml(localizedUpgrade.label)}</strong>
                            <p class="game-hud__sanctuary-copy">${this.escapeHtml(localizedUpgrade.description)}</p>
                            <dl class="game-hud__sanctuary-stats">
                                <div>
                                    <dt>${ui.levelLabel}</dt>
                                    <dd>${upgrade.level}</dd>
                                </div>
                                <div>
                                    <dt>${ui.currentLabel}</dt>
                                    <dd>${this.escapeHtml(localizedUpgrade.statLabel)} ${upgrade.currentValue}</dd>
                                </div>
                                <div>
                                    <dt>${ui.nextLabel}</dt>
                                    <dd>${this.escapeHtml(localizedUpgrade.statLabel)} ${upgrade.nextValue}</dd>
                                </div>
                                <div>
                                    <dt>${ui.costLabel}</dt>
                                    <dd>${upgrade.cost} ${ui.soulShardsLabel}</dd>
                                </div>
                            </dl>
                            <button
                                class="game-hud__sanctuary-buy"
                                type="button"
                                data-upgrade-key="${upgrade.key}"
                                ${upgrade.affordable ? '' : 'disabled'}
                            >
                                ${ui.purchaseLabel(upgrade.bonusPerLevel)}
                            </button>
                        </article>
                    `;
                    }).join('')}
                </div>
            `
            : '';
    }

    private renderGameOverOverlay() {
        this.gameOverOverlay.dataset.open = this.gameOverSnapshot.isOpen ? 'true' : 'false';
        this.gameOverFloorValue.textContent = this.localization.formatFloorNumber(this.gameOverSnapshot.floorNumber);
        this.gameOverKillsValue.textContent = `${this.gameOverSnapshot.defeatedEnemies}`;
        this.gameOverEarnedValue.textContent = `${this.gameOverSnapshot.earnedSoulShards}`;
        this.gameOverTotalValue.textContent = `${this.gameOverSnapshot.totalSoulShards}`;
    }

    private renderBossPanel() {
        const healthRatio = this.bossSnapshot.maxHealth > 0
            ? Math.max(0, Math.min(1, this.bossSnapshot.health / this.bossSnapshot.maxHealth))
            : 0;

        this.bossPanel.dataset.open = this.bossSnapshot.isVisible ? 'true' : 'false';
        this.bossNameValue.textContent = this.bossSnapshot.name;
        this.bossHealthValue.textContent = `${this.bossSnapshot.health} / ${this.bossSnapshot.maxHealth}`;
        this.bossBarValue.style.width = `${Math.round(healthRatio * 100)}%`;
    }

    private renderVictoryOverlay() {
        this.victoryOverlay.dataset.open = this.victorySnapshot.isOpen ? 'true' : 'false';
        this.victoryFloorValue.textContent = this.localization.formatFloorNumber(this.victorySnapshot.floorNumber);
        this.victoryKillsValue.textContent = `${this.victorySnapshot.defeatedEnemies}`;
        this.victoryBossValue.textContent = this.victorySnapshot.bossName;
    }

    private renderInventory() {
        const { ui } = this.localization.getBundle();
        const { items, selectedItemId, slotCapacity, usedSlots } = this.inventorySnapshot;
        const selectedItem = items.find((item) => item.instanceId === selectedItemId);
        const useLabel = this.getUseLabel(selectedItem);
        const canUse = this.canUseSelectedItem(selectedItem);

        this.inventoryOverlay.dataset.open = this.inventorySnapshot.isOpen ? 'true' : 'false';
        this.root.dataset.inventory = this.inventorySnapshot.isOpen ? 'open' : 'closed';
        this.inventoryCapacityValue.textContent = ui.slotCapacity(usedSlots, slotCapacity);
        this.inventoryList.innerHTML = items.length > 0
            ? items.map((item) => `
                <button
                    class="game-hud__inventory-slot${item.instanceId === selectedItemId ? ' is-selected' : ''}"
                    type="button"
                    data-inventory-item-id="${item.instanceId}"
                    data-rarity="${item.rarity}"
                >
                    <span class="game-hud__inventory-slot-icon">${this.escapeHtml(item.icon)}</span>
                    <span class="game-hud__inventory-slot-name" data-rarity="${item.rarity}">${this.escapeHtml(this.localization.getItemName(item.id, item.name))}</span>
                    <span class="game-hud__inventory-slot-meta">${this.describeInventorySlot(item)}</span>
                </button>
            `).join('')
            : `
                <div class="game-hud__inventory-empty">
                    <strong>${ui.inventoryEmptyTitle}</strong>
                    <span>${ui.inventoryEmptyCopy}</span>
                </div>
            `;

        this.inventoryDetail.innerHTML = selectedItem
            ? `
                <span class="game-hud__eyebrow">${ui.selectedItemEyebrow}</span>
                <strong class="game-hud__title game-hud__item-name" data-rarity="${selectedItem.rarity}">${this.escapeHtml(this.localization.getItemName(selectedItem.id, selectedItem.name))}</strong>
                <p class="game-hud__inventory-description">${this.escapeHtml(this.localization.getItemDescription(selectedItem.id, selectedItem.description))}</p>
                <dl class="game-hud__inventory-stats">
                    <div>
                        <dt>${ui.typeLabel}</dt>
                        <dd>${this.escapeHtml(this.localization.getItemTypeLabel(selectedItem.type))}</dd>
                    </div>
                    <div>
                        <dt>${ui.quantityLabel}</dt>
                        <dd>${selectedItem.quantity}</dd>
                    </div>
                    <div>
                        <dt>${ui.stackLabel}</dt>
                        <dd>${selectedItem.stackable ? `${selectedItem.quantity} / ${selectedItem.maxStack}` : ui.singleSlotLabel}</dd>
                    </div>
                    <div>
                        <dt>${ui.statusDetailLabel}</dt>
                        <dd>${selectedItem.isEquipped ? ui.equippedLabel : ui.inPackLabel}</dd>
                    </div>
                    <div>
                        <dt>${ui.rarityLabel}</dt>
                        <dd data-rarity="${selectedItem.rarity}">${this.escapeHtml(this.localization.getRarityLabel(selectedItem.rarity))}</dd>
                    </div>
                    <div>
                        <dt>${ui.actionLabel}</dt>
                        <dd>${this.escapeHtml(this.describeItemAction(selectedItem))}</dd>
                    </div>
                </dl>
            `
            : `
                <span class="game-hud__eyebrow">${ui.selectedItemEyebrow}</span>
                <strong class="game-hud__title">${ui.selectedItemEmptyTitle}</strong>
                <p class="game-hud__inventory-description">
                    ${ui.selectedItemEmptyCopy}
                </p>
            `;

        this.inventoryUseButton.textContent = useLabel;
        this.inventoryUseButton.disabled = !canUse;
        this.inventoryDropButton.disabled = !selectedItem || selectedItem.isEquipped;
    }

    private handleClick(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const localeButton = target.closest<HTMLElement>('[data-locale]');
        if (localeButton?.dataset.locale === 'en' || localeButton?.dataset.locale === 'ko') {
            this.localization.setLocale(localeButton.dataset.locale);
            return;
        }

        const inventorySlot = target.closest<HTMLElement>('[data-inventory-item-id]');
        if (inventorySlot?.dataset.inventoryItemId) {
            this.inventoryHandlers?.onSelectItem(inventorySlot.dataset.inventoryItemId);
            return;
        }

        if (target.closest('[data-role="inventory-close"]')) {
            this.inventoryHandlers?.onClose();
            return;
        }

        if (target.closest('[data-role="gameover-return-title"]')) {
            this.runOverlayHandlers?.onReturnToTitle();
            return;
        }

        if (target.closest('[data-role="victory-return-title"]')) {
            this.runOverlayHandlers?.onReturnToTitle();
            return;
        }

        if (target.closest('[data-role="title-continue"]')) {
            this.runOverlayHandlers?.onContinueRun();
            return;
        }

        if (target.closest('[data-role="title-start"]')) {
            this.runOverlayHandlers?.onStartNewRun();
            return;
        }

        if (target.closest('[data-role="title-open-sanctuary"]')) {
            this.runOverlayHandlers?.onOpenSanctuary();
            return;
        }

        if (target.closest('[data-role="title-close-sanctuary"]')) {
            this.runOverlayHandlers?.onCloseSanctuary();
            return;
        }

        const upgradeButton = target.closest<HTMLElement>('[data-upgrade-key]');
        if (upgradeButton?.dataset.upgradeKey) {
            this.runOverlayHandlers?.onPurchaseUpgrade(
                upgradeButton.dataset.upgradeKey as PermanentUpgradeKey,
            );
            return;
        }

        if (target.closest('[data-role="inventory-use"]')) {
            this.inventoryHandlers?.onUseItem();
            return;
        }

        if (target.closest('[data-role="inventory-drop"]')) {
            this.inventoryHandlers?.onDropItem();
        }
    }

    private canUseSelectedItem(item?: InventoryItem) {
        if (!item) {
            return false;
        }

        return item.type === 'CONSUMABLE' || item.type === 'EQUIPMENT';
    }

    private getUseLabel(item?: InventoryItem) {
        const { ui } = this.localization.getBundle();
        if (!item) {
            return ui.useLabel;
        }

        if (item.type === 'EQUIPMENT') {
            return item.isEquipped ? ui.unequipLabel : ui.equipLabel;
        }

        return ui.useLabel;
    }

    private describeInventorySlot(item: InventoryItem) {
        const { ui } = this.localization.getBundle();
        if (item.isEquipped) {
            return ui.equippedLabel;
        }

        return item.quantity > 1
            ? `x${item.quantity}`
            : this.localization.getItemTypeLabel(item.type);
    }

    private describeItemAction(item: InventoryItem) {
        const { ui } = this.localization.getBundle();
        if (item.consumableEffect?.kind === 'heal') {
            return this.localization.getLocale() === 'ko'
                ? `HP ${item.consumableEffect.amount} 회복`
                : `Restore ${item.consumableEffect.amount} HP`;
        }

        if (item.equipment) {
            const parts = [
                item.equipment.statModifier.maxHealth ? `HP ${formatSignedNumber(item.equipment.statModifier.maxHealth)}` : undefined,
                item.equipment.statModifier.attack ? `ATK ${formatSignedNumber(item.equipment.statModifier.attack)}` : undefined,
                item.equipment.statModifier.defense ? `DEF ${formatSignedNumber(item.equipment.statModifier.defense)}` : undefined,
            ].filter(Boolean);

            return `${this.localization.getEquipmentSlotLabel(item.equipment.slot)} ${parts.join(' · ')}`;
        }

        return ui.noDirectUseLabel;
    }

    private escapeHtml(value: string) {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    private requireRole<T extends HTMLElement = HTMLElement>(role: string) {
        const element = this.root.querySelector<T>(`[data-role="${role}"]`);
        if (!element) {
            throw new Error(`HUD element not found for role: ${role}`);
        }

        return element;
    }
}
