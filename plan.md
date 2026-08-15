# The Experiment Lab — redesign plan

## Product goal

Transform the site from a chapter-based statistics explainer into a cohesive, replayable game. Players run an experiment lab, make decisions with incomplete information, see the consequences, and unlock better experimental tools.

The instructional goal remains the same: learners understand how to design, interpret, and improve experiments. The experience changes from `read → view chart → click → continue` to `decide → predict → simulate → inspect → understand → unlock`.

## Experience principles

### One continuous world

All content takes place in a shared illustrated world: an experiment lab and lemonade stand. Customers, staff, the dashboard, and experimental tools recur across missions. Charts remain important, but are introduced as tools inside this world rather than isolated lessons.

### Decisions before explanations

Ask players to make a low-stakes commitment before revealing an idea:

- Which sign should be tested?
- Would you ship this change?
- When should this test stop?
- Which result can be trusted?
- How should traffic be split?

Incorrect decisions should create an instructive outcome, never a failure state.

### Statistics as unlockable tools

Methods become capabilities earned through play:

- Randomize assignment
- Keep a control group
- Use baseline behavior
- Reduce variance
- Set a stopping rule
- Correct for multiple comparisons
- Validate with A/A tests
- Use switchbacks
- Allocate adaptively
- Update beliefs with evidence

The toolbelt and notebook make progress concrete and let earlier learning be used in later missions.

### Short, meaningful missions

Each mission should take roughly 3–8 minutes and contain one scenario, one main concept, one meaningful decision, one or two interactions, a concise takeaway, and an unlock.

## Campaign structure

Replace the visible ten-chapter structure with a campaign map containing four districts and a capstone.

| District | Narrative goal | Concepts |
| --- | --- | --- |
| First Experiments | Make a fair comparison | Randomization, control/treatment, effect size |
| Clearer Evidence | Make noisy data easier to interpret | CUPED, variance reduction, A/A tests |
| Data Traps | Avoid false confidence | Signal vs. noise, peeking, multiple testing |
| Smarter Decisions | Choose designs for real constraints | Switchbacks, bandits, Bayesian updating |
| Final Lab | Design an experiment end-to-end | Applying all unlocked tools |

Progression:

```text
The lemonade stand has inconsistent sales.
  → Test a new sign fairly.
  → Make a noisy result clearer.
  → Learn why seemingly exciting data can mislead.
  → Handle shared systems and constrained traffic.
  → Design and defend a complete experiment.
```

The map initially presents only the next recommended mission. Completed and unlocked missions remain replayable.

## Player systems

### Campaign map

Replace the dropdown chapter navigation with a map overlay opened from a persistent `Map` button. Nodes show locked, available, in-progress, or complete state plus their objective, prerequisites, estimated time, and earned tool.

### Lab notebook

Unlocked concept cards contain the method name, its plain-language purpose, when to use it, a practical warning, and a mission replay link.

Example:

> **Random assignment**  
> Use it to make groups comparable before treatment. It prevents giving a new idea to people who already look more likely to convert.

### Toolbelt

The toolbelt starts as a progress display and becomes a strategic interface later. In the final mission, players choose an assignment method, noise-reduction method, stopping rule, correction policy, and allocation policy from tools earned earlier.

### Insights, not punitive scoring

Track participation rather than correctness: predictions made, simulations run, counterfactuals tried, surprising outcomes replayed, and optional challenges completed. Required progress never depends on predicting correctly.

### Replay and Free Lab

After a mission is complete, players can replay the guided version, replay with a new random seed, or try a lighter-guidance version. Completing the campaign unlocks a Free Lab where tools can be combined without a prescribed path.

## Standard mission loop

```text
Briefing → prediction → player action → animated result → debrief → unlock
```

### Briefing

Use no more than roughly 60–80 words. Establish a practical objective, such as: “A new handwritten sign may attract more customers. Can you test it fairly?”

### Prediction

Offer 2–4 understandable choices. Save the answer and acknowledge the choice without immediately judging it.

### Action

Use concrete, locally positioned controls: `Randomly assign customers`, `Run 7 days`, `Check the live result`, `Compare another shuffle`, or `Ship these changes`. Avoid generic labels like `Continue` and `Step 2` for primary learning actions.

### Result

Animate the relevant data transformation and highlight its consequence: biased starting groups, shuffled labels forming a chance distribution, temporary significance disappearing, or false wins appearing across many metrics.

### Debrief

Show a result headline, plain-language explanation, formal statistical term after the intuition, one remembered rule, and a replay/counterfactual invitation.

### Unlock

Animate a small completion state, add the tool to the notebook/toolbelt, and point to the next mission.

## Visual and interaction direction

Use a warm, handmade illustrated interface: off-white paper, ink-like outlines, soft shadows, rounded cards, recurring characters, cups, signs, clipboards, and small dashboards. Retain blue/orange as the semantic control/treatment colors.

| Statistical object | In-world representation |
| --- | --- |
| Participant | Customer, avatar, or order card |
| Treatment | Sign, recipe, interface variant, lane, or label |
| Outcome | Cup sold, order value, satisfaction mark, conversion token |
| Distribution | Pile or bin of outcome tokens |
| Difference | Balance scale or summary marker |
| Uncertainty | Range bar, clarity meter, or repeated-world pile |
| Metric | Dashboard card |
| Prior belief | Forecast/notebook card |
| Time | Calendar strip, day counter, or clock |

Animation should explain grouping, shuffling, stacking, revealing, or updating—not decorate the page. Respect `prefers-reduced-motion` and provide replay-speed controls where repetition matters.

## Mission conversion

| Existing module | Campaign mission | Key interaction | Unlock |
| --- | --- | --- | --- |
| `00-what-is-an-experiment.js` | Test the New Sign | Choose assignment; expose bias; deal customers randomly | Randomize assignment |
| `01-cuped.js` | Use Customer History | Toggle raw versus adjusted outcomes | Use baseline behavior |
| `02-variance-reduction.js` | Make Data Clearer | Adjust design and observe spread | Reduce variance |
| `03-signal-vs-noise.js` | Is the Gap Real? | Shuffle labels into chance-only worlds | Compare against chance |
| `04-peeking.js` | Resist the Live Dashboard | Commit to a stopping rule; observe daily wobble | Set a stopping rule |
| `05-multiple-testing.js` | Release Triage | Decide which apparent wins to ship | Correct for multiple comparisons |
| `06-aa-tests.js` | Inspect the Machinery | Diagnose a same-experience test | Validate the system |
| `07-switchback.js` | Test a Shared System | Schedule treatments across time | Use switchbacks |
| `08-bandits.js` | Learn While Earning | Allocate traffic over repeated rounds | Allocate adaptively |
| `09-bayesian.js` | Update Beliefs | Revise forecasts as evidence arrives | Update beliefs |

### Final Lab

Provide a practical scenario with noisy customers, multiple candidate changes, limited traffic, a shared-system constraint, and time pressure. The player chooses methods from the toolbelt, runs the study, interprets evidence, and makes a launch decision. The ending evaluates both the decision and the experimental process.

## Technical architecture

Keep the current static HTML/JavaScript approach. The existing app already has registered scene modules, deterministic random simulations, canvas drawing helpers, gated scenes, and per-scene controls.

Proposed structure:

```text
engine.js
app/
  campaign.js        # districts, missions, dependencies
  progress.js        # localStorage persistence and reset
  mission-shell.js   # briefing/action/debrief lifecycle
  map.js             # campaign map overlay
  hud.js             # persistent navigation/status
  notebook.js        # unlocked concept cards
  challenge.js       # optional challenge wrapper
  ui.js              # shared cards, buttons, callouts
  accessibility.js   # focus, live announcements, reduced motion
  scene-objects.js   # recurring visual props and characters
chapters/
  ...existing simulation modules, incrementally migrated
```

Each mission should register structured metadata:

```js
{
  id: "fair-assignment",
  district: "first-experiments",
  title: "Test the New Sign",
  objective: "Run a fair comparison.",
  estimatedMinutes: 5,
  prerequisites: [],
  unlocks: ["randomization"],
  scenes: [],
  challenge: {},
  notebookEntry: {}
}
```

Persist only local, non-sensitive state:

```js
{
  version: 1,
  completedMissionIds: [],
  unlockedToolIds: [],
  completedChallengeIds: [],
  predictions: {},
  currentMissionId: "fair-assignment",
  reducedMotionOverride: null
}
```

Offer a clear progress-reset action in Settings.

## Implementation phases

### Phase 0 — Design specification

Define the campaign name, art direction, district map, unlock order, mission wireframe, interaction vocabulary, and success criteria. Produce annotated wireframes and a conversion brief before broad implementation.

### Phase 1 — Campaign shell

Update `index.html` and `engine.js` to add a campaign HUD, map overlay, mission briefing/debrief surfaces, notebook, toolbelt, local progress persistence, shared completion flow, and reduced-motion support.

Deliverable: the app navigates like a campaign even while most missions still use current scene content.

### Phase 2 — First mission vertical slice

Fully redesign `chapters/00-what-is-an-experiment.js`:

1. Introduce the stand and a testable change.
2. Ask the player to choose an assignment method.
3. Show the bias created by time-of-day assignment.
4. Unlock random assignment.
5. Deal customers into groups and run the fair test.
6. Reveal outcomes and make a ship/no-ship recommendation.
7. Award the Randomize Assignment tool.

Deliverable: a polished 5–8 minute playable mission validating the visual style, prediction loop, debrief, unlock, and accessibility behavior.

### Phase 3 — Data traps and high-interaction missions

Redesign Signal vs. Noise, Peeking, Multiple Testing, and A/A Tests. These form the strongest game-like middle: repeated worlds, temptation to stop early, release triage, and debugging.

### Phase 4 — Strategic methods

Redesign CUPED, variance reduction, switchbacks, bandits, and Bayesian inference using the shared shell and tool system.

### Phase 5 — Finale and Free Lab

Build the capstone experiment designer, post-completion Free Lab, replay paths, and alternate seeded scenarios.

### Phase 6 — Quality pass

Test responsive layout, high-DPI canvas rendering, keyboard use, reduced motion, color accessibility, progress recovery/reset, replay behavior, onboarding pacing, and browser performance.

## Accessibility requirements

- All essential actions are keyboard-operable HTML controls.
- Canvas interactions have text alternatives or equivalent paired controls.
- Focus states are always visible.
- Color is never the only group indicator.
- Motion honors system reduced-motion preferences.
- Text meets contrast and size requirements on narrow screens.
- Every visual outcome receives a concise textual explanation.
- Completion never depends on speed, pointer precision, or predicting correctly.

## Acceptance criteria

The redesign is complete when:

- A new user takes a meaningful action within 20 seconds.
- The user always has one obvious current goal.
- Most key reveals are preceded by a player prediction.
- Every mission ends with a concise takeaway and a tangible unlock.
- Primary navigation feels like a campaign map, not a table of contents.
- Simulations remain statistically correct and replayable with plausible variation.
- Progress persists across refreshes.
- Core interactions work on desktop, touch, keyboard-only, and reduced-motion modes.
- The final mission requires applying tools learned earlier rather than recalling definitions.

## Recommended implementation order

1. Shared campaign shell.
2. First-mission vertical slice.
3. Signal/noise and data-trap missions.
4. Remaining method missions.
5. Capstone and Free Lab.
6. Accessibility, responsiveness, and polish.
