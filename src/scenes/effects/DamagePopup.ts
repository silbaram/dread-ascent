import 'phaser';

export type DamagePopupType = 'damage' | 'blocked' | 'heal' | 'poison' | 'block_gain' | 'buff';
export type DamagePopupAnchorId = 'enemy-hp' | 'player-hp' | 'enemy-panel' | 'player-panel';

export interface DamagePopupAnchor {
    readonly id: DamagePopupAnchorId;
    readonly x: number;
    readonly y: number;
}

export interface DamagePopupRequest {
    readonly type: DamagePopupType;
    readonly value: number;
}

interface DamagePopupStyle {
    readonly color: string;
}

const POPUP_DURATION_MS = 800;
const POPUP_RISE_DISTANCE_PX = 40;
const POPUP_STACK_SPACING_PX = 20;

const POPUP_STYLES = {
    damage: { color: '#ff6767' },
    blocked: { color: '#c5cfdb' },
    heal: { color: '#73f5a2' },
    poison: { color: '#c483ff' },
    block_gain: { color: '#6eb6ff' },
    buff: { color: '#ffb05e' },
} satisfies Record<DamagePopupType, DamagePopupStyle>;

export function formatDamagePopupText(request: DamagePopupRequest): string {
    switch (request.type) {
        case 'damage':
            return `-${request.value}`;
        case 'blocked':
            return `(${request.value} blocked)`;
        case 'heal':
            return `+${request.value}`;
        case 'poison':
            return `Poison ${request.value}`;
        case 'block_gain':
            return `+${request.value} Block`;
        case 'buff':
            return `+${request.value} ATK`;
    }
}

export class DamagePopupController {
    private readonly activeByAnchor = new Map<DamagePopupAnchorId, Phaser.GameObjects.Text[]>();

    constructor(private readonly scene: Phaser.Scene) {}

    public showBatch(anchor: DamagePopupAnchor, requests: readonly DamagePopupRequest[]): void {
        requests
            .filter((request) => request.value > 0)
            .forEach((request) => {
                this.show(anchor, request);
            });
    }

    public clear(): void {
        this.activeByAnchor.forEach((popups) => {
            popups.forEach((popup) => popup.destroy());
        });
        this.activeByAnchor.clear();
    }

    private show(anchor: DamagePopupAnchor, request: DamagePopupRequest): void {
        const activePopups = this.activeByAnchor.get(anchor.id) ?? [];
        const style = POPUP_STYLES[request.type];
        const popup = this.scene.add.text(
            anchor.x,
            anchor.y + (activePopups.length * POPUP_STACK_SPACING_PX),
            formatDamagePopupText(request),
            {
                fontSize: '18px',
                color: style.color,
                fontFamily: 'monospace',
                fontStyle: 'bold',
                stroke: '#08111f',
                strokeThickness: 3,
            },
        ).setOrigin(0.5);

        this.activeByAnchor.set(anchor.id, [...activePopups, popup]);

        this.scene.tweens.add({
            targets: popup,
            y: popup.y - POPUP_RISE_DISTANCE_PX,
            alpha: 0,
            duration: POPUP_DURATION_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.removePopup(anchor.id, popup);
            },
        });
    }

    private removePopup(anchorId: DamagePopupAnchorId, popup: Phaser.GameObjects.Text): void {
        const remainingPopups = (this.activeByAnchor.get(anchorId) ?? []).filter((item) => item !== popup);

        popup.destroy();

        if (remainingPopups.length === 0) {
            this.activeByAnchor.delete(anchorId);
            return;
        }

        this.activeByAnchor.set(anchorId, remainingPopups);
    }
}
