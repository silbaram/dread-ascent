# Sprint 11: Archetype Payoff and Escape Tempo

## Sprint Goal

Make the currently defined archetypes produce clearer payoff turns without taking on the larger action-queue and reaction-registry rewrites. This sprint focuses on gameplay-facing P1 backlog items that are cohesive, independently testable, and build on the existing BattleScene/CardEffectService architecture.

## Selected Backlog Tasks

### task-034: Shadow Arts Exposed and Poison Payoff

- Mark the Vein must open a readable Exposed window for Exploit Weakness through the existing debuff-threshold inscription path.
- Toxic Burst must convert existing Poison into immediate damage before modifying the remaining stack, rather than only multiplying a number.
- Card detail and reaction-feed text must explain the Exposed/Poison payoff timing.
- Tests: BattleScene Shadow Arts flow and CardEffect/CardCatalog coverage.

### task-035: Iron Will Guard and Counter Loop

- Counter Strike must be usable as a planned counter when the next revealed enemy intent is an attack and the player has prepared Block.
- Existing "damage already taken this turn" Counter Strike behavior must remain valid.
- The planned counter path must be visible through card condition text and tested in scene flow.
- Tests: CardEffectService counter-window scaling and BattleScene counter setup.

### task-036: Smuggler Discard Tempo and Card-Based Vanish

- Recycle must discard with an explicit deterministic selection policy instead of the previous implicit front-of-hand discard.
- At least one Smuggler payoff must care about cards discarded this turn.
- Shadow Step must gain a card-based Perfect Vanish condition when used after a discard setup turn.
- Tests: DrawCycleService discard policy and BattleScene Smuggler payoff/vanish flow.

### task-040: Escape Economy Result Deepening

- Perfect Vanish must record a concrete reward policy using existing resources instead of every escape result reporting `none`.
- Clean and Bloody Escape behavior must remain compatible with existing item-loss and health-loss rules.
- Persisted escape results must accept the new reward policy.
- Tests: EscapeEconomyService and RunPersistenceService escape-result coverage.

## Acceptance Criteria

- All selected tasks have at least one new or updated passing test.
- Root `SPRINT.md` documents sprint goal, selected tasks, and task-level acceptance criteria before implementation.
- Changes stay within TypeScript/Phaser/domain-service patterns already present in `src/`.
- `npm test` (`vitest run`) exits 0 after each task implementation and once more at the end.
