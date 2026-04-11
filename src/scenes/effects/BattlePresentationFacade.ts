import type {
    DamagePopupAnchorId,
    DamagePopupRequest,
} from './DamagePopup';

export type BattlePresentationActor = 'player' | 'enemy';

export type BattlePresentationAction =
    | {
        readonly kind: 'log';
        readonly message: string;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'popups';
        readonly anchorId: DamagePopupAnchorId;
        readonly requests: readonly DamagePopupRequest[];
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'effect-text';
        readonly text: string;
        readonly color: string;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'clear-effect-text';
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'impact';
        readonly actor: BattlePresentationActor;
        readonly color: number;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'pulse';
        readonly actor: BattlePresentationActor;
        readonly color: number;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'freeze-frame';
        readonly durationMs: number;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'vfx-cue';
        readonly cue: string;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'sfx-cue';
        readonly cue: string;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'flash';
        readonly actor: BattlePresentationActor;
        readonly color: number;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'twist';
        readonly actor: BattlePresentationActor;
        readonly color: number;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'stagger';
        readonly actor: BattlePresentationActor;
        readonly color: number;
        readonly delayMs?: number;
    }
    | {
        readonly kind: 'slash-overlay';
        readonly color: number;
        readonly delayMs?: number;
    };

interface BattlePresentationScheduler {
    delayedCall(delayMs: number, callback: () => void): void;
}

interface BattlePresentationPort {
    readonly scheduler?: BattlePresentationScheduler;
    appendBattleLog(message: string): void;
    showPopupBatch(anchorId: DamagePopupAnchorId, requests: readonly DamagePopupRequest[]): void;
    createFallbackEffectText(text: string, color: string): void;
    clearEffectText(): void;
    playPanelImpactMotion(actor: BattlePresentationActor, color: number): void;
    playPanelPulseMotion(actor: BattlePresentationActor, color: number): void;
    freezeFrame(durationMs: number): void;
    playVfxCue(cue: string): void;
    playSfxCue(cue: string): void;
    playPanelFlashMotion(actor: BattlePresentationActor, color: number): void;
    playPanelTwistMotion(actor: BattlePresentationActor, color: number): void;
    playPanelStaggerMotion(actor: BattlePresentationActor, color: number): void;
    playSlashOverlay(color: number): void;
}

export class BattlePresentationFacade {
    constructor(private readonly port: BattlePresentationPort) {}

    public present(actions: readonly BattlePresentationAction[]): number {
        let maxDelayMs = 0;

        actions.forEach((action) => {
            const delayMs = Math.max(0, action.delayMs ?? 0);
            const completionDelayMs = action.kind === 'freeze-frame'
                ? delayMs + Math.max(0, action.durationMs)
                : delayMs;
            maxDelayMs = Math.max(maxDelayMs, completionDelayMs);
            this.schedule(delayMs, () => {
                this.consume(action);
            });
        });

        return maxDelayMs;
    }

    private schedule(delayMs: number, callback: () => void): void {
        if (delayMs <= 0 || !this.port.scheduler) {
            callback();
            return;
        }

        this.port.scheduler.delayedCall(delayMs, callback);
    }

    private consume(action: BattlePresentationAction): void {
        switch (action.kind) {
            case 'log':
                this.port.appendBattleLog(action.message);
                return;
            case 'popups':
                this.port.showPopupBatch(action.anchorId, action.requests);
                return;
            case 'effect-text':
                this.port.createFallbackEffectText(action.text, action.color);
                return;
            case 'clear-effect-text':
                this.port.clearEffectText();
                return;
            case 'impact':
                this.port.playPanelImpactMotion(action.actor, action.color);
                return;
            case 'pulse':
                this.port.playPanelPulseMotion(action.actor, action.color);
                return;
            case 'freeze-frame':
                this.port.freezeFrame(action.durationMs);
                return;
            case 'vfx-cue':
                this.port.playVfxCue(action.cue);
                return;
            case 'sfx-cue':
                this.port.playSfxCue(action.cue);
                return;
            case 'flash':
                this.port.playPanelFlashMotion(action.actor, action.color);
                return;
            case 'twist':
                this.port.playPanelTwistMotion(action.actor, action.color);
                return;
            case 'stagger':
                this.port.playPanelStaggerMotion(action.actor, action.color);
                return;
            case 'slash-overlay':
                this.port.playSlashOverlay(action.color);
        }
    }
}
