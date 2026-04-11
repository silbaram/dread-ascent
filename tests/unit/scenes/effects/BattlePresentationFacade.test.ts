import { describe, expect, it, vi } from 'vitest';

import { BattlePresentationFacade } from '../../../../src/scenes/effects/BattlePresentationFacade';

describe('BattlePresentationFacade', () => {
    it('consumes cue, freeze, flash, twist, stagger, and slash-overlay actions through the presentation port', () => {
        const scheduler = {
            delayedCall: vi.fn((_delayMs: number, callback: () => void) => {
                callback();
            }),
        };
        const port = {
            scheduler,
            appendBattleLog: vi.fn(),
            showPopupBatch: vi.fn(),
            createFallbackEffectText: vi.fn(),
            clearEffectText: vi.fn(),
            playPanelImpactMotion: vi.fn(),
            playPanelPulseMotion: vi.fn(),
            freezeFrame: vi.fn(),
            playVfxCue: vi.fn(),
            playSfxCue: vi.fn(),
            playPanelFlashMotion: vi.fn(),
            playPanelTwistMotion: vi.fn(),
            playPanelStaggerMotion: vi.fn(),
            playSlashOverlay: vi.fn(),
        };
        const facade = new BattlePresentationFacade(port);

        const maxDelayMs = facade.present([
            { kind: 'vfx-cue', cue: 'flash', delayMs: 40 },
            { kind: 'sfx-cue', cue: 'strike', delayMs: 40 },
            { kind: 'freeze-frame', durationMs: 120, delayMs: 40 },
            { kind: 'flash', actor: 'enemy', color: 0xffaa66, delayMs: 80 },
            { kind: 'twist', actor: 'player', color: 0xff8866, delayMs: 100 },
            { kind: 'stagger', actor: 'enemy', color: 0xffd166, delayMs: 120 },
            { kind: 'slash-overlay', color: 0xffd166, delayMs: 140 },
        ]);

        expect(maxDelayMs).toBe(160);
        expect(scheduler.delayedCall).toHaveBeenCalledTimes(7);
        expect(port.playVfxCue).toHaveBeenCalledWith('flash');
        expect(port.playSfxCue).toHaveBeenCalledWith('strike');
        expect(port.freezeFrame).toHaveBeenCalledWith(120);
        expect(port.playPanelFlashMotion).toHaveBeenCalledWith('enemy', 0xffaa66);
        expect(port.playPanelTwistMotion).toHaveBeenCalledWith('player', 0xff8866);
        expect(port.playPanelStaggerMotion).toHaveBeenCalledWith('enemy', 0xffd166);
        expect(port.playSlashOverlay).toHaveBeenCalledWith(0xffd166);
    });
});
