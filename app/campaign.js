"use strict";

/* Campaign definition: districts, missions (wired to existing chapter scenes),
   and the unlockable tool catalog used by the toolbelt + notebook.

   Each mission carries structured metadata (objective, prerequisites, unlocks,
   notebook entry) and a reference to its built chapter scenes (already
   registered in CHAPTERS by the chapter <script> tags). The shell reads this
   to drive the map, gating, and debrief unlocks. */

(function(global){
  "use strict";

  // Districts in campaign order. id matches mission.district.
  const DISTRICTS = [
    { id: "first-experiments",  name: "First Experiments", tag: "Make a fair comparison" },
    { id: "clearer-evidence",   name: "Clearer Evidence",   tag: "Make noisy data easier to read" },
    { id: "data-traps",          name: "Data Traps",        tag: "Avoid false confidence" },
    { id: "smarter-decisions",   name: "Smarter Decisions", tag: "Design for real constraints" },
    { id: "final-lab",           name: "Final Lab",         tag: "Apply every tool" },
    { id: "real-world-lab",       name: "Real-World Lab",    tag: "Apply it to real businesses" }
  ];

  // Unlockable tools — the toolbelt + notebook share this catalog.
  const TOOLS = {
    "randomize-assignment":  { id: "randomize-assignment",  name: "Random assignment", district: "first-experiments",
      purpose: "Make groups comparable before treatment.",
      when: "Any time you split people into control and treatment.",
      warning: "Random ≠ balanced; small groups can still lurch." },
    "baseline-behavior":     { id: "baseline-behavior",     name: "Use baseline behavior", district: "clearer-evidence",
      purpose: "Subtract each unit's known history to shrink noise.",
      when: "You have a pre-treatment measurement correlated with the outcome.",
      warning: "Only helps if the baseline truly predicts the outcome." },
    "reduce-variance":       { id: "reduce-variance",       name: "Reduce variance", district: "clearer-evidence",
      purpose: "Tighten the chance pile so real effects stand out.",
      when: "Noise is burying a plausible effect.",
      warning: "Over-adjusting can introduce bias; keep it simple." },
    "compare-chance":        { id: "compare-chance",        name: "Compare against chance", district: "data-traps",
      purpose: "Judge a gap against what luck alone produces.",
      when: "Before trusting any observed difference.",
      warning: "Chance piles assume your randomization is honest." },
    "stopping-rule":         { id: "stopping-rule",         name: "Set a stopping rule", district: "data-traps",
      purpose: "Decide when a test ends before looking at results.",
      when: "Whenever a dashboard tempts you to stop early.",
      warning: "Peeking inflates false positives even with a rule." },
    "multiple-comparisons":  { id: "multiple-comparisons",  name: "Correct for multiple comparisons", district: "data-traps",
      purpose: "Demand more from each extra metric you check.",
      when: "You track many metrics or segments at once.",
      warning: "Corrections cost power; don't correct metrics you won't act on." },
    "validate-system":       { id: "validate-system",       name: "Validate the system", district: "data-traps",
      purpose: "Run a same-experience test to catch bugs and bias.",
      when: "Before trusting results from a new pipeline.",
      warning: "A/A can't catch bugs that are symmetric across both arms." },
    "switchbacks":           { id: "switchbacks",           name: "Use switchbacks", district: "smarter-decisions",
      purpose: "Rotate a shared treatment across time instead of people.",
      when: "One system serves everyone (can't split users cleanly).",
      warning: "Carryover can smear treatment into control periods." },
    "allocate-adaptively":   { id: "allocate-adaptively",   name: "Allocate adaptively", district: "smarter-decisions",
      purpose: "Shift traffic toward what's working as you learn.",
      when: "Opportunity cost of exploration is high.",
      warning: "Adaptive allocations complicate later analysis." },
    "update-beliefs":        { id: "update-beliefs",        name: "Update beliefs with evidence", district: "smarter-decisions",
      purpose: "Revise a prior forecast as evidence arrives.",
      when: "You want a probability, not a yes/no verdict.",
      warning: "Garbage priors produce garbage posteriors." },
    "holdout-groups":        { id: "holdout-groups",        name: "Keep a holdout group", district: "smarter-decisions",
      purpose: "Set aside a pristine group never touched by any test.",
      when: "You suspect the act of experimenting itself shifts behavior.",
      warning: "Holdouts cost sample and power; skip when every unit counts." }
  };

  // Mission ids mirror the existing chapter ids so scenes resolve through
  // the chapter registry. `scenes` is intentionally left to the shell to fill
  // from CHAPTERS at boot (chapters register before bootCourse).
  const MISSIONS = [
    {
      id: "00-what-is-an-experiment",
      district: "first-experiments",
      title: "Test the New Recipe",
      objective: "Run a fair comparison.",
      estimatedMinutes: 5,
      prerequisites: [],
      unlocks: ["randomize-assignment"],
      chapterId: "00-what-is-an-experiment",
      briefing: "The lemonade stand wants to try a new recipe this week and see if kids buy more cups. But first you have to decide which kids get the new recipe and which keep the usual one. How should you split them?",
      prediction: {
        prompt: "Which split should we use to test the new recipe fairly?",
        choices: [
          { id: "thirsty", label: "Give the new recipe to the thirstiest kids" },
          { id: "regulars", label: "Give it to the kids who already buy the most" },
          { id: "random", label: "Flip a coin for each kid" }
        ]
      },
      debrief: {
        headline: "Bias is a head start, not a verdict.",
        explanation: "A hand-picked split stacks the thirstiest kids into treatment, so its average is already higher before the recipe does anything — the comparison would be meaningless. A coin-flip split lets either side come out close on its own, removing the systematic tilt.",
        term: "Randomization",
        rule: "If the split can favor one side on its own, you can't trust the comparison."
      },
      notebookEntry: {
        toolId: "randomize-assignment",
        note: "Use it to make groups comparable before treatment. It prevents giving a new idea to people who already look more likely to convert."
      }
    },
    {
      id: "01-cuped",
      district: "clearer-evidence",
      title: "Use Customer History",
      objective: "Strip noise using each customer's baseline.",
      estimatedMinutes: 6,
      prerequisites: ["00-what-is-an-experiment"],
      unlocks: ["baseline-behavior"],
      chapterId: "01-cuped",
      briefing: "Your fair test came back noisy — the gap wobbles between weeks. But you know each customer's old buying habits. Can you use that history to see the real effect more clearly?",
      prediction: {
        prompt: "What would make your estimate clearer?",
        choices: [
          { id: "more", label: "Run more weeks of the same test" },
          { id: "history", label: "Adjust each result by the customer's past behavior" },
          { id: "drop", label: "Drop the customers who bought the most" }
        ]
      },
      debrief: {
        headline: "History predicts today. Use it to subtract noise.",
        explanation: "Subtracting the part of each result explained by past behavior shrinks the chance pile without touching the treatment — the real effect stands out.",
        term: "CUPED (Controlled-experiment Using Pre-Experiment Data)",
        rule: "Adjust with a baseline only when it genuinely predicts the outcome."
      },
      notebookEntry: {
        toolId: "baseline-behavior",
        note: "Use it to subtract each unit's known history and shrink noise. Only helps if the baseline truly predicts the outcome."
      }
    },
    {
      id: "02-variance-reduction",
      district: "clearer-evidence",
      title: "Make Data Clearer",
      objective: "Tighten the chance pile with design choices.",
      estimatedMinutes: 7,
      prerequisites: ["01-cuped"],
      unlocks: ["reduce-variance"],
      chapterId: "02-variance-reduction",
      briefing: "CUPED used history. But history isn't always available. There are other ways to shrink noise: compare like with like, fix the mix afterward, or borrow a signal from a different metric.",
      prediction: {
        prompt: "Which trick will tighten the pile most here?",
        choices: [
          { id: "strata", label: "Compare similar customers within strata" },
          { id: "poststrata", label: "Rebalance the mix after collecting data" },
          { id: "covariate", label: "Borrow a correlated signal to adjust" }
        ]
      },
      debrief: {
        headline: "Many tricks, one idea: shrink noise without touching treatment.",
        explanation: "Stratification, post-stratification, and control variates all reduce the spread of the chance pile by using structure you already know.",
        term: "Variance reduction",
        rule: "Every adjustment must not depend on which side got the treatment."
      },
      notebookEntry: {
        toolId: "reduce-variance",
        note: "Use it to tighten the chance pile so real effects stand out. Over-adjusting can introduce bias — keep it simple."
      }
    },
    {
      id: "03-signal-vs-noise",
      district: "data-traps",
      title: "Is the Gap Real?",
      objective: "Judge a gap against what chance alone produces.",
      estimatedMinutes: 6,
      prerequisites: ["02-variance-reduction"],
      unlocks: ["compare-chance"],
      chapterId: "03-signal-vs-noise",
      briefing: "A gap showed up in your test. But any random split wobbles even when nothing's real. Is this gap signal, or just the shape of luck?",
      prediction: {
        prompt: "How would you tell a real gap from a lucky one?",
        choices: [
          { id: "big", label: "If it's big enough, it's real" },
          { id: "shuffle", label: "Shuffle the labels and see where gaps usually land" },
          { id: "repeat", label: "Run the test again and check it matches" }
        ]
      },
      debrief: {
        headline: "A gap is only meaningful against the pile chance makes.",
        explanation: "Reshuffling labels builds the distribution of gaps that luck alone produces. Your result is real if it's rare in that pile.",
        term: "Permutation / randomization test",
        rule: "Compare the gap to chance, not to zero."
      },
      notebookEntry: {
        toolId: "compare-chance",
        note: "Use it to judge a gap against what luck alone produces. The pile assumes your randomization is honest."
      }
    },
    {
      id: "04-peeking",
      district: "data-traps",
      title: "Resist the Live Dashboard",
      objective: "Commit to a stopping rule before looking.",
      estimatedMinutes: 6,
      prerequisites: ["03-signal-vs-noise"],
      unlocks: ["stopping-rule"],
      chapterId: "04-peeking",
      briefing: "Sales tick up on the live dashboard two days in. It's tempting to call the test early. But checking repeatedly is itself a kind of multiple testing — and it inflates false wins.",
      prediction: {
        prompt: "When should this test stop?",
        choices: [
          { id: "early", label: "Stop the moment it looks significant" },
          { id: "fixed", label: "Decide a date now and wait until then" },
          { id: "sequential", label: "Use a line that accounts for peeking" }
        ]
      },
      debrief: {
        headline: "Every peek is a chance to be fooled.",
        explanation: "A fixed stopping date avoids optional stopping. A sequential boundary lets you check but demands more evidence at each look.",
        term: "Optional stopping / sequential testing (mSPRT)",
        rule: "Decide when you'll stop before you start looking."
      },
      notebookEntry: {
        toolId: "stopping-rule",
        note: "Use it to decide when a test ends before looking. Peeking inflates false positives even with a rule."
      }
    },
    {
      id: "05-multiple-testing",
      district: "data-traps",
      title: "Release Triage",
      objective: "Decide which apparent wins to actually ship.",
      estimatedMinutes: 6,
      prerequisites: ["04-peeking"],
      unlocks: ["multiple-comparisons"],
      chapterId: "05-multiple-testing",
      briefing: "You tracked twenty metrics. Three look like wins. But check enough metrics and some will look winning by pure luck. Which of these apparent wins do you ship?",
      prediction: {
        prompt: "How do you decide which wins to trust?",
        choices: [
          { id: "loudest", label: "Ship the three biggest gaps" },
          { id: "bonferroni", label: "Demand each win clears a higher bar" },
          { id: "bh", label: "Sort wins and raise the bar progressively" }
        ]
      },
      debrief: {
        headline: "More metrics checked means more chances to be fooled.",
        explanation: "Bonferroni is safe but blunt. Benjamini-Hochberg sorts the wins and raises the bar gradually — controlling how many false discoveries you tolerate.",
        term: "Multiple-comparison correction (Benjamini-Hochberg)",
        rule: "Only correct the metrics you'd actually act on."
      },
      notebookEntry: {
        toolId: "multiple-comparisons",
        note: "Use it to demand more from each extra metric you check. Corrections cost power — don't correct metrics you won't act on."
      }
    },
    {
      id: "06-aa-tests",
      district: "data-traps",
      title: "Inspect the Machinery",
      objective: "Diagnose a same-experience test.",
      estimatedMinutes: 5,
      prerequisites: ["05-multiple-testing"],
      unlocks: ["validate-system"],
      chapterId: "06-aa-tests",
      briefing: "Before you trust any future test, run one where both sides get the identical experience. If that 'A/A' test shows a significant gap, your machinery — not your idea — is the problem.",
      prediction: {
        prompt: "What would worry you in an A/A test result?",
        choices: [
          { id: "small", label: "A tiny gap — nothing to worry about" },
          { id: "significant", label: "A statistically significant gap" },
          { id: "unequal", label: "Unequal sample sizes between arms" }
        ]
      },
      debrief: {
        headline: "An A/A test with a 'winner' means your test rig is broken.",
        explanation: "With no real difference, significant gaps should be rare and sample sizes should match. Imbalance or systematic gaps point to a bug in assignment or logging.",
        term: "A/A test",
        rule: "Validate the pipeline with a no-difference test before trusting real ones."
      },
      notebookEntry: {
        toolId: "validate-system",
        note: "Use it to run a same-experience test to catch bugs and bias. A/A can't catch bugs symmetric across both arms."
      }
    },
    {
      id: "07-switchback",
      district: "smarter-decisions",
      title: "Test a Shared System",
      objective: "Schedule treatments across time when users can't be split.",
      estimatedMinutes: 6,
      prerequisites: ["06-aa-tests"],
      unlocks: ["switchbacks"],
      chapterId: "07-switchback",
      briefing: "Everyone uses the same lemonade recipe — you can't give different recipes to different customers at the same time. But you can flip the whole stand between recipes over time.",
      prediction: {
        prompt: "How should you flip the stand between recipes?",
        choices: [
          { id: "once", label: "Switch once, halfway through" },
          { id: "flip", label: "Flip back and forth every day" },
          { id: "random", label: "Flip on a random schedule" }
        ]
      },
      debrief: {
        headline: "When you can't split people, split time.",
        explanation: "Switchbacks rotate a shared treatment across time periods. Too-frequent flipping invites carryover; too-rare flipping invites day effects. Guard periods separate them.",
        term: "Switchback experiment",
        rule: "Add a guard period so one treatment doesn't bleed into the next."
      },
      notebookEntry: {
        toolId: "switchbacks",
        note: "Use it to rotate a shared treatment across time instead of people. Carryover can smear treatment into control periods."
      }
    },
    {
      id: "08-bandits",
      district: "smarter-decisions",
      title: "Learn While Earning",
      objective: "Allocate traffic over repeated rounds.",
      estimatedMinutes: 7,
      prerequisites: ["07-switchback"],
      unlocks: ["allocate-adaptively"],
      chapterId: "08-bandits",
      briefing: "You have three sign designs and one summer. Every customer you send to a bad sign is a customer lost. Can you learn which sign wins while still earning from the good ones?",
      prediction: {
        prompt: "How should you split traffic across the three signs?",
        choices: [
          { id: "equal", label: "Split equally and decide at the end" },
          { id: "greedy", label: "Always use the current best sign" },
          { id: "adaptive", label: "Explore a little, then lean toward the best" }
        ]
      },
      debrief: {
        headline: "Explore enough to learn, exploit enough to earn.",
        explanation: "An equal split learns but wastes traffic. Pure greed earns but can lock onto the wrong sign early. Adaptive allocation balances the two — and you can still estimate the effect.",
        term: "Multi-armed bandit",
        rule: "Don't allocate adaptively if you need a clean estimate afterward."
      },
      notebookEntry: {
        toolId: "allocate-adaptively",
        note: "Use it to shift traffic toward what's working as you learn. Adaptive allocations complicate later analysis."
      }
    },
    {
      id: "09-bayesian",
      district: "smarter-decisions",
      title: "Update Beliefs",
      objective: "Revise a forecast as evidence arrives.",
      estimatedMinutes: 6,
      prerequisites: ["08-bandits"],
      unlocks: ["update-beliefs"],
      chapterId: "09-bayesian",
      briefing: "Instead of a yes/no verdict, you want a probability: how likely is it that the new recipe really beats the old one? Start with a prior belief and let the data revise it.",
      prediction: {
        prompt: "What's the most useful thing to report?",
        choices: [
          { id: "verdict", label: "A yes/no: it worked or it didn't" },
          { id: "prob", label: "A probability it beats the old recipe" },
          { id: "interval", label: "A range the true effect probably lies in" }
        ]
      },
      debrief: {
        headline: "Beliefs update; they don't flip.",
        explanation: "A prior encodes what you believed before. Each day's evidence nudges the posterior. You report the probability the new recipe beats the old — a number, not a verdict.",
        term: "Bayesian updating",
        rule: "Garbage priors produce garbage posteriors."
      },
      notebookEntry: {
        toolId: "update-beliefs",
        note: "Use it to revise a prior forecast as evidence arrives. Garbage priors produce garbage posteriors."
      }
    },
    {
      id: "10-holdout",
      district: "smarter-decisions",
      title: "Keep a Holdout",
      objective: "Set aside a pristine group to catch baseline drift.",
      estimatedMinutes: 5,
      prerequisites: ["09-bayesian"],
      unlocks: ["holdout-groups"],
      chapterId: "10-holdout",
      briefing: "You've been testing for months — new recipes, new signs, new layouts. But did all that experimenting itself change how customers behave? Keep a group you never touch and never compare, and you'll have a clean baseline to find out.",
      prediction: {
        prompt: "What does a holdout group cost you right now?",
        choices: [
          { id: "nothing", label: "Nothing — it's free extra data" },
          { id: "power", label: "Fewer measured control kids, so more noise" },
          { id: "bias", label: "It biases the treatment estimate" }
        ]
      },
      debrief: {
        headline: "A holdout trades power now for a clean baseline later.",
        explanation: "Peeling kids into a holdout shrinks your measured control, widening the chance pile and making the current test foggier. In exchange you keep a pristine baseline that can later reveal whether your testing program itself shifted behavior.",
        term: "Holdout group",
        rule: "Keep a holdout only when you suspect experimenting moves your numbers."
      },
      notebookEntry: {
        toolId: "holdout-groups",
        note: "Use it to set aside a pristine group never touched by any test. It costs sample and power; skip when every unit counts."
      }
    },
    {
      id: "final-lab",
      district: "final-lab",
      title: "The Final Lab",
      objective: "Design and defend a complete experiment.",
      estimatedMinutes: 12,
      prerequisites: ["10-holdout"],
      unlocks: [],
      chapterId: "final-lab",
      briefing: "Noisy customers, several candidate changes, limited traffic, and time pressure. Choose your methods from the toolbelt, run the study, read the evidence, and make the call.",
      prediction: null,
      debrief: {
        headline: "The process is the point.",
        explanation: "A good decision from a well-designed experiment beats a lucky call from a broken one. Every tool you unlocked had a role here — random assignment, baseline adjustment, and multiple-comparison correction each closed a specific gap.",
        term: "Putting it together",
        rule: "Defend the design, not just the result."
      },
      notebookEntry: null
    },
    {
      id: "quiz-fast-food",
      district: "real-world-lab",
      title: "Fast Food Quiz",
      objective: "Experiment design at a drive-thru chain.",
      estimatedMinutes: 4, prerequisites: [], unlocks: [],
      chapterId: "quiz-fast-food", briefing: "BurgerBarn wants to test a new checkout prompt. Answer questions about how to design the experiment.",
      prediction: null,
      debrief: { headline: "Fast food, fast experiments.", explanation: "Time-of-day bias, peeking, and power analysis all apply even at a drive-thru.", term: "Applied experimentation", rule: "Randomize across all hours, pre-commit to a stop, and size for your effect." },
      notebookEntry: null
    },
    {
      id: "quiz-e-commerce",
      district: "real-world-lab",
      title: "E-commerce Quiz",
      objective: "Testing a recommendation algorithm.",
      estimatedMinutes: 4, prerequisites: [], unlocks: [],
      chapterId: "quiz-e-commerce", briefing: "ShopFast tests a new product recommendation algorithm. Answer questions about CUPED, multiple testing, and shared systems.",
      prediction: null,
      debrief: { headline: "Noise reduction at scale.", explanation: "CUPED, correction, and switchbacks — each tool has a place in e-commerce.", term: "Applied experimentation", rule: "Use pre-treatment covariates, pre-declare metrics, and switch when you can't split." },
      notebookEntry: null
    },
    {
      id: "quiz-financial-services",
      district: "real-world-lab",
      title: "Finance Quiz",
      objective: "Testing a loan approval UI.",
      estimatedMinutes: 4, prerequisites: [], unlocks: [],
      chapterId: "quiz-financial-services", briefing: "CreditUnion tests a new loan approval UI. Answer questions about A/A tests, effect size, and holdouts.",
      prediction: null,
      debrief: { headline: "Trust the pipeline first.", explanation: "A/A tests, practical significance, and holdouts all matter in financial services.", term: "Applied experimentation", rule: "Validate the pipeline, check business impact, and keep a pristine baseline." },
      notebookEntry: null
    },
    {
      id: "quiz-saas",
      district: "real-world-lab",
      title: "SaaS Quiz",
      objective: "Testing a signup form change.",
      estimatedMinutes: 4, prerequisites: [], unlocks: [],
      chapterId: "quiz-saas", briefing: "CloudFlow tests a simplified signup form. Answer questions about stopping rules, stratification, and bandits.",
      prediction: null,
      debrief: { headline: "Delayed metrics need patience.", explanation: "Stratify by channel, pre-commit to duration, and consider bandits for multi-option tests.", term: "Applied experimentation", rule: "Account for delays, reduce noise by segment, and adapt when traffic is scarce." },
      notebookEntry: null
    },
    {
      id: "quiz-healthcare",
      district: "real-world-lab",
      title: "Healthcare Quiz",
      objective: "Reducing no-shows at a telehealth platform.",
      estimatedMinutes: 3, prerequisites: [], unlocks: [],
      chapterId: "quiz-healthcare", briefing: "MediCare+ tests showing wait times on the booking page. Answer questions about stratified randomization and signal vs noise.",
      prediction: null,
      debrief: { headline: "Randomize within strata.", explanation: "Stratified randomization and chance distributions apply to healthcare metrics too.", term: "Applied experimentation", rule: "Randomize within device segments and compare gaps to chance." },
      notebookEntry: null
    },
    {
      id: "quiz-media",
      district: "real-world-lab",
      title: "Media Quiz",
      objective: "Testing a skip intro button placement.",
      estimatedMinutes: 3, prerequisites: [], unlocks: [],
      chapterId: "quiz-media", briefing: "StreamFlix tests skip intro button placement. Answer questions about novelty effects and primary metrics.",
      prediction: null,
      debrief: { headline: "Novelty isn't a win.", explanation: "With huge traffic, significance comes fast but novelty skews it. Pre-declare one primary metric.", term: "Applied experimentation", rule: "Wait for novelty to fade and decide on the pre-declared primary." },
      notebookEntry: null
    },
    {
      id: "quiz-ride-sharing",
      district: "real-world-lab",
      title: "Ride-sharing Quiz",
      objective: "Testing a surge pricing display.",
      estimatedMinutes: 3, prerequisites: [], unlocks: [],
      chapterId: "quiz-ride-sharing", briefing: "RideGo tests a new surge pricing display. Answer questions about switchbacks and carryover.",
      prediction: null,
      debrief: { headline: "Switch the system, guard the gaps.", explanation: "City-wide systems need switchback designs with guard periods.", term: "Applied experimentation", rule: "Flip over time, guard between flips." },
      notebookEntry: null
    },
    {
      id: "quiz-education",
      district: "real-world-lab",
      title: "Education Quiz",
      objective: "Testing lesson formats.",
      estimatedMinutes: 3, prerequisites: [], unlocks: [],
      chapterId: "quiz-education", briefing: "LearnOnline tests video-first vs text-first lessons. Answer questions about selection bias and Bayesian updating.",
      prediction: null,
      debrief: { headline: "Randomize, don't match.", explanation: "Selection bias inflates results and Bayesian methods give you a probability, not just a verdict.", term: "Applied experimentation", rule: "Random assignment prevents bias; Bayes gives you a number." },
      notebookEntry: null
    }
  ];

  // Lookups
  const byId = id => MISSIONS.find(m => m.id === id);
  const byDistrict = did => MISSIONS.filter(m => m.district === did);
  const tool = id => TOOLS[id];

  // All missions are unlocked so players can jump across chapters freely.
  // Prerequisites are still shown in the map for guidance.
  function isUnlocked(mission, completedIds){
    return true;
  }

  // First mission with no prerequisites and not yet completed — the
  // "next recommended" mission the map opens to.
  function nextRecommended(completedIds){
    for (const m of MISSIONS){
      if (isUnlocked(m, completedIds) && !completedIds.includes(m.id)) return m;
    }
    return null;
  }

  // Resolve scenes for a mission from the chapter registry (filled at boot).
  function scenesFor(mission){
    if (!mission.chapterId) return null;
    const ch = (global.CHAPTERS || {})[mission.chapterId];
    return ch && ch.scenes ? ch.scenes : null;
  }

  global.Campaign = {
    DISTRICTS,
    TOOLS,
    MISSIONS,
    byId,
    byDistrict,
    tool,
    isUnlocked,
    nextRecommended,
    scenesFor
  };
})(window);