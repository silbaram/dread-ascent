// ---------------------------------------------------------------------------
// Energy Service — 턴당 에너지 관리 도메인 로직 (TASK-032)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 기본 최대 에너지. game-systems.md MAX_ENERGY 참조. */
export const DEFAULT_MAX_ENERGY = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 에너지 상태 불변 스냅샷. */
export interface EnergyState {
    readonly current: number;
    readonly max: number;
}

/** 카드 사용 시도 결과. */
export type PlayCardResult =
    | { readonly playable: true; readonly energyState: EnergyState; readonly autoEndTurn: boolean }
    | { readonly playable: false; readonly reason: 'insufficient_energy' };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * 턴당 에너지를 관리한다.
 * 모든 메서드는 불변 상태를 입력받아 새 상태를 반환하는 순수 함수 스타일이다.
 */
export class EnergyService {
    /**
     * 에너지 상태를 초기화한다.
     * @param maxEnergy - 최대 에너지 (기본 3, 향후 설정 가능)
     */
    initialize(maxEnergy: number = DEFAULT_MAX_ENERGY): EnergyState {
        return {
            current: maxEnergy,
            max: maxEnergy,
        };
    }

    /**
     * 턴 시작 시 에너지를 최대값으로 리필한다.
     */
    refill(state: EnergyState): EnergyState {
        if (state.current === state.max) {
            return state;
        }
        return { ...state, current: state.max };
    }

    /**
     * 카드 사용 시 에너지를 차감한다.
     * - 에너지가 부족하면 사용이 거부된다.
     * - 사용 후 에너지가 0이 되면 자동 턴 종료를 알린다.
     */
    spendEnergy(state: EnergyState, cost: number): PlayCardResult {
        if (state.current < cost) {
            return { playable: false, reason: 'insufficient_energy' };
        }

        const newCurrent = state.current - cost;
        const newState: EnergyState = { ...state, current: newCurrent };

        return {
            playable: true,
            energyState: newState,
            autoEndTurn: newCurrent === 0,
        };
    }

    /**
     * 특정 카드 비용이 현재 에너지로 사용 가능한지 확인한다.
     */
    canAfford(state: EnergyState, cost: number): boolean {
        return state.current >= cost;
    }

    /**
     * 현재 손패에서 사용 가능한 카드가 있는지 확인한다.
     * 에너지가 0이거나, 비용을 감당할 수 있는 카드가 없으면 false.
     */
    hasPlayableCards(state: EnergyState, cardCosts: readonly number[]): boolean {
        if (state.current === 0) {
            return false;
        }
        return cardCosts.some((cost) => cost <= state.current);
    }
}
