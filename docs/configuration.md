# Configuration

Dread Ascent의 게임 시스템 설정과 밸런스 값을 설명합니다. 대부분의 값은 소스 코드 내 상수로 정의되어 있습니다.

## 1. Inventory & Items

- **`DEFAULT_INVENTORY_SLOT_CAPACITY`**: 12
  - 플레이어가 소지할 수 있는 아이템의 최대 개수입니다.
- **`DEFAULT_MAX_ITEMS_PER_FLOOR`**: 3
  - 층마다 스폰되는 무작위 아이템의 최대 개수입니다. (안전 층 제외)

### Item Rarity & Scaling
아이템 등급에 따라 장비의 기본 능력치가 배율로 적용됩니다.
- **COMMON**: 1.0x (기본)
- **RARE**: 1.25x
- **LEGENDARY**: 1.6x

---

## 2. Enemy & Difficulty Scaling

층이 올라갈수록 적들의 기본 능력치가 상승하며, 아키타입에 따라 추가 보너스가 부여됩니다.

### 기본 스케일링 (층당 증가량)
- **체력**: +10 HP
- **공격력**: +1 ATK
- **방어력**: +1 DEF
- **경험치**: +5 EXP (기본 25)

### 아키타입 (Enemy Archetypes)
| ID | 이름 | 출현 층 | 보너스 (HP/ATK/DEF) |
|----|------|---------|---------------------|
| `ash-crawler` | Ash Crawler | 1 ~ 45F | +0 / +0 / +0 |
| `blade-raider` | Blade Raider | 20 ~ 80F | +20 / +2 / +0 |
| `dread-sentinel` | Dread Sentinel | 50 ~ 99F | +40 / +1 / +3 |

### 특수 등급 (Elite & Boss)
- **Elite (확률 10%)**: 체력 1.5x, 공격 +4, 방어 +3, 경험치 2.0x.
- **Final Boss (100F)**: 체력 2.0x, 공격 +18, 방어 +12, 경험치 4.0x.

---

## 3. Floor & Progression

- **`BOSS_FLOOR_NUMBER`**: 100
  - 최종 보스가 확정적으로 등장하는 층입니다.
- **`SAFE_FLOOR_CHANCE`**: 25%
  - 다음 층이 적이 없는 '안전 층'일 확률입니다. (보스 층 제외)

---

## 4. Meta Progression (Sanctuary)

영구 강화 시스템의 비용과 보너스 설정입니다.

| 항목 | 보너스 (Lv당) | 기본 비용 | 비용 증가폭 | 설명 |
|------|:------------:|:---------:|:----------:|------|
| Vitality (HP) | +10 | 20 | +10 | 최대 체력 상승 |
| Ferocity (ATK) | +2 | 25 | +15 | 기본 공격력 상승 |
| Bulwark (DEF) | +1 | 20 | +12 | 기본 방어력 상승 |

---

## 5. Persistence & Storage

브라우저의 `localStorage`를 사용하여 데이터를 영구 저장합니다.

- **Meta Progression**: `dread-ascent.meta-progression`
- **Run State (Active Game)**: `dread-ascent.run-state`
  - 현재 진행 중인 게임의 층, 인벤토리, 스탯 정보를 포함합니다.

---

## 6. UI 및 조작

- **인벤토리**: `Tab` 또는 `I` 키로 토글합니다.
- **취소/뒤로**: `Escape` 키를 사용하여 메뉴를 닫거나 이전 화면으로 이동합니다.
- **아이템 습득**: 아이템이 있는 타일로 이동하면 자동으로 습득합니다. (인벤토리 여유가 있을 때)
