import type { InventoryItem } from '../domain/entities/Item';
import type {
    MetaUpgradeSnapshot,
    PermanentUpgradeKey,
} from '../domain/services/MetaProgressionService';
import type { SoulShardAwardSummary } from '../domain/services/SoulShardService';
import { formatSignedNumber } from '../shared/utils/formatSignedNumber';

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
    private inventorySnapshot: InventoryOverlaySnapshot = {
        isOpen: false,
        items: [],
        slotCapacity: 12,
        usedSlots: 0,
    };
    private inventoryHandlers?: InventoryOverlayHandlers;
    private runOverlayHandlers?: RunOverlayHandlers;
    private readonly healthValue: HTMLElement;
    private readonly expValue: HTMLElement;
    private readonly floorValue: HTMLElement;
    private readonly turnValue: HTMLElement;
    private readonly enemyValue: HTMLElement;
    private readonly stateValue: HTMLElement;
    private readonly bossPanel: HTMLElement;
    private readonly bossNameValue: HTMLElement;
    private readonly bossHealthValue: HTMLElement;
    private readonly bossBarValue: HTMLElement;
    private readonly logList: HTMLElement;
    private readonly eventBanner: HTMLElement;
    private readonly eventBannerText: HTMLElement;
    private readonly titleOverlay: HTMLElement;
    private readonly titleSoulShardsValue: HTMLElement;
    private readonly titleContinueButton: HTMLButtonElement;
    private readonly titleMessage: HTMLElement;
    private readonly titleSanctuary: HTMLElement;
    private readonly gameOverOverlay: HTMLElement;
    private readonly gameOverFloorValue: HTMLElement;
    private readonly gameOverKillsValue: HTMLElement;
    private readonly gameOverEarnedValue: HTMLElement;
    private readonly gameOverTotalValue: HTMLElement;
    private readonly victoryOverlay: HTMLElement;
    private readonly victoryFloorValue: HTMLElement;
    private readonly victoryKillsValue: HTMLElement;
    private readonly victoryBossValue: HTMLElement;
    private readonly inventoryOverlay: HTMLElement;
    private readonly inventoryCapacityValue: HTMLElement;
    private readonly inventoryList: HTMLElement;
    private readonly inventoryDetail: HTMLElement;
    private readonly inventoryUseButton: HTMLButtonElement;
    private readonly inventoryDropButton: HTMLButtonElement;

    constructor(private readonly root: HTMLElement) {
        this.root.innerHTML = `
            <div class="game-hud">
                <section class="game-hud__top">
                    <div class="game-hud__brand">
                        <span class="game-hud__eyebrow">Dread Ascent</span>
                        <strong class="game-hud__title">Field HUD</strong>
                    </div>
                    <div class="game-hud__stats">
                        <article class="game-hud__card">
                            <span class="game-hud__label">Floor</span>
                            <strong class="game-hud__value" data-role="floor"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">Health</span>
                            <strong class="game-hud__value" data-role="health"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">Experience</span>
                            <strong class="game-hud__value" data-role="exp"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">Turn</span>
                            <strong class="game-hud__value" data-role="turn"></strong>
                        </article>
                        <article class="game-hud__card">
                            <span class="game-hud__label">Enemies</span>
                            <strong class="game-hud__value" data-role="enemies"></strong>
                        </article>
                        <article class="game-hud__card game-hud__card--state">
                            <span class="game-hud__label">State</span>
                            <strong class="game-hud__value" data-role="state"></strong>
                        </article>
                    </div>
                    <aside class="game-hud__boss-panel" data-role="boss-panel" data-open="false">
                        <div class="game-hud__boss-head">
                            <span class="game-hud__eyebrow">Boss Presence</span>
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
                            <span class="game-hud__eyebrow">Message Log</span>
                            <strong class="game-hud__title">Tower Feed</strong>
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
                        <span class="game-hud__eyebrow">Dread Ascent</span>
                        <strong class="game-hud__title game-hud__title--hero">Title Return</strong>
                        <p class="game-hud__title-copy">
                            Gather yourself and descend again when ready.
                        </p>
                        <div class="game-hud__title-stats">
                            <span class="game-hud__label">Soul Shards</span>
                            <strong class="game-hud__value" data-role="title-soul-shards"></strong>
                        </div>
                        <div class="game-hud__title-actions">
                            <button class="game-hud__title-action" type="button" data-role="title-continue">
                                Continue
                            </button>
                            <button class="game-hud__title-action" type="button" data-role="title-start">
                                New Descent
                            </button>
                            <button class="game-hud__title-action game-hud__title-action--secondary" type="button" data-role="title-open-sanctuary">
                                Sanctuary
                            </button>
                        </div>
                        <p class="game-hud__title-message" data-role="title-message"></p>
                        <div class="game-hud__title-sanctuary" data-role="title-sanctuary" data-open="false"></div>
                    </div>
                </section>
                <section class="game-hud__gameover-overlay" data-role="gameover-overlay" data-open="false">
                    <div class="game-hud__gameover-panel">
                        <span class="game-hud__eyebrow">Run Ended</span>
                        <strong class="game-hud__title game-hud__title--hero">Game Over</strong>
                        <div class="game-hud__gameover-stats">
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Floor Reached</span>
                                <strong class="game-hud__value" data-role="gameover-floor"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Enemies Defeated</span>
                                <strong class="game-hud__value" data-role="gameover-kills"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Earned Shards</span>
                                <strong class="game-hud__value" data-role="gameover-earned"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Total Shards</span>
                                <strong class="game-hud__value" data-role="gameover-total"></strong>
                            </article>
                        </div>
                        <button class="game-hud__title-action" type="button" data-role="gameover-return-title">
                            Return to Title
                        </button>
                    </div>
                </section>
                <section class="game-hud__victory-overlay" data-role="victory-overlay" data-open="false">
                    <div class="game-hud__victory-panel">
                        <span class="game-hud__eyebrow">Ending</span>
                        <strong class="game-hud__title game-hud__title--hero">The Ascent Breaks</strong>
                        <p class="game-hud__title-copy">
                            The summit falls silent. The final guardian is gone.
                        </p>
                        <div class="game-hud__gameover-stats">
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Floor Cleared</span>
                                <strong class="game-hud__value" data-role="victory-floor"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Enemies Defeated</span>
                                <strong class="game-hud__value" data-role="victory-kills"></strong>
                            </article>
                            <article class="game-hud__gameover-card">
                                <span class="game-hud__label">Boss Defeated</span>
                                <strong class="game-hud__value" data-role="victory-boss"></strong>
                            </article>
                        </div>
                        <button class="game-hud__title-action" type="button" data-role="victory-return-title">
                            Return to Title
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
                                Close
                            </button>
                            <div>
                                <span class="game-hud__eyebrow">Inventory</span>
                                <strong class="game-hud__title">Pack Ledger</strong>
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
                                Use
                            </button>
                            <button
                                class="game-hud__inventory-action game-hud__inventory-action--accent"
                                type="button"
                                data-role="inventory-drop"
                            >
                                Drop
                            </button>
                        </footer>
                    </div>
                </section>
            </div>
        `;

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

        this.root.addEventListener('click', (event) => {
            this.handleClick(event);
        });
        this.renderTitleOverlay();
        this.renderGameOverOverlay();
        this.renderVictoryOverlay();
        this.renderBossPanel();
        this.renderInventory();
        this.renderEventBanner();
    }

    updateStatus(snapshot: HudStatusSnapshot) {
        const runState = snapshot.runState ?? (snapshot.isGameOver ? 'game-over' : 'playing');
        this.floorValue.textContent = `${snapshot.floorNumber}F · ${snapshot.floorType}`;
        this.healthValue.textContent = `${snapshot.health} / ${snapshot.maxHealth}`;
        this.expValue.textContent = `${snapshot.experience} EXP`;
        this.turnValue.textContent = snapshot.activeTurn;
        this.enemyValue.textContent = `${snapshot.enemyCount}`;
        this.stateValue.textContent = this.formatRunState(runState);
        this.root.dataset.state = runState;
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
                        <span class="game-hud__eyebrow">Meta Shop</span>
                        <strong class="game-hud__title">Sanctuary</strong>
                    </div>
                    <button
                        class="game-hud__title-action game-hud__title-action--secondary"
                        type="button"
                        data-role="title-close-sanctuary"
                    >
                        Back
                    </button>
                </div>
                <div class="game-hud__sanctuary-grid">
                    ${this.titleSnapshot.upgrades.map((upgrade) => `
                        <article class="game-hud__sanctuary-card">
                            <span class="game-hud__eyebrow">${this.escapeHtml(upgrade.statLabel)}</span>
                            <strong class="game-hud__title">${this.escapeHtml(upgrade.label)}</strong>
                            <p class="game-hud__sanctuary-copy">${this.escapeHtml(upgrade.description)}</p>
                            <dl class="game-hud__sanctuary-stats">
                                <div>
                                    <dt>Level</dt>
                                    <dd>${upgrade.level}</dd>
                                </div>
                                <div>
                                    <dt>Current</dt>
                                    <dd>${this.escapeHtml(upgrade.statLabel)} ${upgrade.currentValue}</dd>
                                </div>
                                <div>
                                    <dt>Next</dt>
                                    <dd>${this.escapeHtml(upgrade.statLabel)} ${upgrade.nextValue}</dd>
                                </div>
                                <div>
                                    <dt>Cost</dt>
                                    <dd>${upgrade.cost} shards</dd>
                                </div>
                            </dl>
                            <button
                                class="game-hud__sanctuary-buy"
                                type="button"
                                data-upgrade-key="${upgrade.key}"
                                ${upgrade.affordable ? '' : 'disabled'}
                            >
                                Purchase +${upgrade.bonusPerLevel}
                            </button>
                        </article>
                    `).join('')}
                </div>
            `
            : '';
    }

    private renderGameOverOverlay() {
        this.gameOverOverlay.dataset.open = this.gameOverSnapshot.isOpen ? 'true' : 'false';
        this.gameOverFloorValue.textContent = `${this.gameOverSnapshot.floorNumber}F`;
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
        this.victoryFloorValue.textContent = `${this.victorySnapshot.floorNumber}F`;
        this.victoryKillsValue.textContent = `${this.victorySnapshot.defeatedEnemies}`;
        this.victoryBossValue.textContent = this.victorySnapshot.bossName;
    }

    private renderInventory() {
        const { items, selectedItemId, slotCapacity, usedSlots } = this.inventorySnapshot;
        const selectedItem = items.find((item) => item.instanceId === selectedItemId);
        const useLabel = this.getUseLabel(selectedItem);
        const canUse = this.canUseSelectedItem(selectedItem);

        this.inventoryOverlay.dataset.open = this.inventorySnapshot.isOpen ? 'true' : 'false';
        this.root.dataset.inventory = this.inventorySnapshot.isOpen ? 'open' : 'closed';
        this.inventoryCapacityValue.textContent = `${usedSlots} / ${slotCapacity} slots`;
        this.inventoryList.innerHTML = items.length > 0
            ? items.map((item) => `
                <button
                    class="game-hud__inventory-slot${item.instanceId === selectedItemId ? ' is-selected' : ''}"
                    type="button"
                    data-inventory-item-id="${item.instanceId}"
                    data-rarity="${item.rarity}"
                >
                    <span class="game-hud__inventory-slot-icon">${this.escapeHtml(item.icon)}</span>
                    <span class="game-hud__inventory-slot-name" data-rarity="${item.rarity}">${this.escapeHtml(item.name)}</span>
                    <span class="game-hud__inventory-slot-meta">${this.describeInventorySlot(item)}</span>
                </button>
            `).join('')
            : `
                <div class="game-hud__inventory-empty">
                    <strong>Inventory is empty</strong>
                    <span>Collect treasure on the field to fill your pack.</span>
                </div>
            `;

        this.inventoryDetail.innerHTML = selectedItem
            ? `
                <span class="game-hud__eyebrow">Selected Item</span>
                <strong class="game-hud__title game-hud__item-name" data-rarity="${selectedItem.rarity}">${this.escapeHtml(selectedItem.name)}</strong>
                <p class="game-hud__inventory-description">${this.escapeHtml(selectedItem.description)}</p>
                <dl class="game-hud__inventory-stats">
                    <div>
                        <dt>Type</dt>
                        <dd>${this.escapeHtml(selectedItem.type)}</dd>
                    </div>
                    <div>
                        <dt>Quantity</dt>
                        <dd>${selectedItem.quantity}</dd>
                    </div>
                    <div>
                        <dt>Stack</dt>
                        <dd>${selectedItem.stackable ? `${selectedItem.quantity} / ${selectedItem.maxStack}` : 'Single slot'}</dd>
                    </div>
                    <div>
                        <dt>Status</dt>
                        <dd>${selectedItem.isEquipped ? 'Equipped' : 'In Pack'}</dd>
                    </div>
                    <div>
                        <dt>Rarity</dt>
                        <dd data-rarity="${selectedItem.rarity}">${this.escapeHtml(this.formatItemRarity(selectedItem.rarity))}</dd>
                    </div>
                    <div>
                        <dt>Action</dt>
                        <dd>${this.escapeHtml(this.describeItemAction(selectedItem))}</dd>
                    </div>
                </dl>
            `
            : `
                <span class="game-hud__eyebrow">Selected Item</span>
                <strong class="game-hud__title">Nothing selected</strong>
                <p class="game-hud__inventory-description">
                    Pick an item slot to inspect it and drop it back onto the floor.
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
        if (!item) {
            return 'Use';
        }

        if (item.type === 'EQUIPMENT') {
            return item.isEquipped ? 'Unequip' : 'Equip';
        }

        return 'Use';
    }

    private describeInventorySlot(item: InventoryItem) {
        if (item.isEquipped) {
            return 'Equipped';
        }

        return item.quantity > 1 ? `x${item.quantity}` : item.type;
    }

    private describeItemAction(item: InventoryItem) {
        if (item.consumableEffect?.kind === 'heal') {
            return `Restore ${item.consumableEffect.amount} HP`;
        }

        if (item.equipment) {
            const parts = [
                item.equipment.statModifier.maxHealth ? `HP ${formatSignedNumber(item.equipment.statModifier.maxHealth)}` : undefined,
                item.equipment.statModifier.attack ? `ATK ${formatSignedNumber(item.equipment.statModifier.attack)}` : undefined,
                item.equipment.statModifier.defense ? `DEF ${formatSignedNumber(item.equipment.statModifier.defense)}` : undefined,
            ].filter(Boolean);

            return `${item.equipment.slot} ${parts.join(' · ')}`;
        }

        return 'No direct use';
    }

    private formatItemRarity(rarity: InventoryItem['rarity']) {
        switch (rarity) {
            case 'LEGENDARY':
                return 'Legendary';
            case 'RARE':
                return 'Rare';
            case 'COMMON':
            default:
                return 'Common';
        }
    }

    private formatRunState(runState: NonNullable<HudStatusSnapshot['runState']>) {
        switch (runState) {
            case 'game-over':
                return 'GAME OVER';
            case 'victory':
                return 'VICTORY';
            case 'playing':
            default:
                return 'PLAYING';
        }
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
