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
}

interface HudLogEntry {
    message: string;
    tone: HudLogTone;
}

export class GameHud {
    private readonly logs: HudLogEntry[] = [];
    private readonly maxLogs = 6;
    private readonly healthValue: HTMLElement;
    private readonly expValue: HTMLElement;
    private readonly floorValue: HTMLElement;
    private readonly turnValue: HTMLElement;
    private readonly enemyValue: HTMLElement;
    private readonly stateValue: HTMLElement;
    private readonly logList: HTMLElement;

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
            </div>
        `;

        this.healthValue = this.requireRole('health');
        this.expValue = this.requireRole('exp');
        this.floorValue = this.requireRole('floor');
        this.turnValue = this.requireRole('turn');
        this.enemyValue = this.requireRole('enemies');
        this.stateValue = this.requireRole('state');
        this.logList = this.requireRole('log-list');
    }

    updateStatus(snapshot: HudStatusSnapshot) {
        this.floorValue.textContent = `${snapshot.floorNumber}F · ${snapshot.floorType}`;
        this.healthValue.textContent = `${snapshot.health} / ${snapshot.maxHealth}`;
        this.expValue.textContent = `${snapshot.experience} EXP`;
        this.turnValue.textContent = snapshot.activeTurn;
        this.enemyValue.textContent = `${snapshot.enemyCount}`;
        this.stateValue.textContent = snapshot.isGameOver ? 'GAME OVER' : 'PLAYING';
        this.root.dataset.state = snapshot.isGameOver ? 'game-over' : 'playing';
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

    private renderLogs() {
        this.logList.innerHTML = this.logs
            .map((entry) => `
                <li class="game-hud__log-entry game-hud__log-entry--${entry.tone}">
                    <span class="game-hud__log-dot"></span>
                    <span>${entry.message}</span>
                </li>
            `)
            .join('');
    }

    private requireRole(role: string) {
        const element = this.root.querySelector<HTMLElement>(`[data-role="${role}"]`);
        if (!element) {
            throw new Error(`HUD element not found for role: ${role}`);
        }

        return element;
    }
}
