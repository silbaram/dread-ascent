/** 난수 생성기 인터페이스. */
export interface RandomSource {
    next(): number;
}

/** Fisher-Yates 알고리즘으로 배열을 섞은 복사본을 반환한다. */
export function shuffleArray<T>(values: readonly T[], random: RandomSource): T[] {
    const shuffled = [...values];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(random.next() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
}
