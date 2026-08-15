"use strict";

(function(){

  const FONT = 'FuturaHandwritten, cursive';

  function label(text, x, y, opts){
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || COLOR.muted;
    ctx.font = (opts.weight ? opts.weight + " " : "") + (opts.size || 18) + "px " + FONT;
    ctx.textAlign = opts.align || "center";
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function roundRect(x, y, w, h, r){
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  /* -------------------------------------------------------------------- */
  /* Quiz data — real-world scenarios, harder questions                     */
  /* -------------------------------------------------------------------- */

  const QUIZZES = [
    {
      industry: "Fast Food",
      icon: "🍔",
      scenario: "BurgerBarn wants to test a new 'Buy One Get One Free' checkout prompt against their current 'Add fries for $1?' prompt. They have 2,000 drive-thru customers per week across 50 stores. Their POS system can split customers at random.",
      questions: [
        {
          type: "design",
          decisionPrompt: "How should you assign customers to control vs treatment?",
          decisionOptions: [
            "Random coin flip per customer",
 "Test the new prompt only at lunch (11am-1pm)",
 "Give the new prompt to the 20 busiest stores",
 "Alternate: new prompt on weekdays, old on weekends"
          ],
          decisionAnswer: 0,
          reasonPrompt: "What's the main advantage of random per-customer assignment over the other three approaches?",
          choices: [
            "It guarantees both groups have identical average order values before the test starts",
            "It avoids systematic differences between groups that could masquerade as a prompt effect, since lunch-only or store-based splits introduce bias",
            "It produces the smallest possible p-value for any given effect size",
            "It's required by the POS system's tracking software"
          ],
          answer: 1,
          explain: "Random assignment doesn't guarantee balance — it guarantees no SYSTEMATIC bias. Lunch-only customers differ from dinner customers; the busiest stores differ from quieter ones. Any non-random split lets pre-existing differences contaminate the comparison. Random assignment is the only method that makes the groups comparable in expectation."
        },
        {
          type: "design",
          decisionPrompt: "How many days should you run the experiment before making a ship decision?",
          decisionOptions: [
            "5 days",
            "7 days",
            "10 days",
            "14 days"
          ],
          decisionAnswer: 3,
          reasonPrompt: "Why did you choose 14 days over a shorter duration? What does a fixed, pre-committed test length protect against that checking the dashboard and stopping early doesn't?",
          choices: [
            "Because p-values are only valid when calculated at a pre-specified sample size; checking repeatedly and stopping early changes the sampling distribution of the test statistic",
            "Because stopping at the first significant result inflates false positives (optional stopping), and 14 days covers two full weekday/weekend cycles so day-of-week effects average out",
            "Because the central limit theorem requires at least two weeks of data for the sample mean to be approximately normally distributed",
            "Because shorter tests have higher variance in the estimated effect size, making the confidence interval too wide to make a confident ship decision"
          ],
          answer: 1,
          explain: "Checking daily and stopping at significance is optional stopping — each look is a chance to catch a random high, inflating the false-positive rate far above 5%. A pre-committed 14-day duration solves two problems: it prevents peeking bias AND covers two full weekly cycles (weekday vs weekend traffic patterns). With a fixed end date decided in advance, the p-value at the end is honest."
        },
        {
          type: "design",
          decisionPrompt: "Which metric should drive the ship decision?",
          decisionOptions: [
            "Average order value (decided before the test started)",
            "Whichever of the 4 metrics looks best after the test",
            "Customer satisfaction score only",
            "All 4 metrics must be significant"
          ],
          decisionAnswer: 0,
          reasonPrompt: "What's the risk of shipping on whichever of the 4 metrics looks best after looking at the data?",
          choices: [
            "There's no risk — checking more metrics gives a more complete picture of the change's impact",
            "With four metrics at α=0.05, the chance of at least one false positive is roughly 18%, so 'ship on any winner' makes the false-positive rate 18%, not 5%",
            "The metrics are correlated, so checking all four is equivalent to checking one",
            "The POS system can only track one metric accurately at a time"
          ],
          answer: 1,
          explain: "With four metrics at α=0.05, P(at least one false positive) ≈ 1 - 0.95⁴ ≈ 18.5%. If you ship on whichever looks best after looking, your effective false-positive rate is 18%, not 5%. Pre-declaring one primary metric means your decision rests on a single honest test. The other metrics can be checked for understanding (exploratory), but they shouldn't drive the ship call."
        }
      ]
    },
    {
      industry: "E-commerce",
      icon: "🛒",
      scenario: "ShopFast, an online retailer, wants to test a new product recommendation algorithm. They have 500K monthly visitors. Their current algorithm recommends 'popular items'; the new one uses collaborative filtering. The metric is average order value.",
      questions: [
        {
          q: "Each visitor's past order history strongly predicts their current order value. How should you use this in the analysis?",
          choices: [
            "Exclude returning visitors entirely — only test on new visitors for a clean comparison",
            "Split visitors into 'high spend' and 'low spend' groups, then run separate experiments within each",
            "Use each visitor's historical average as a covariate to adjust the outcome, reducing variance without changing the estimate",
            "Weight each visitor's result by their past order value so high-spenders count more"
          ],
          answer: 2,
          explain: "CUPED (Controlled-experiment Using Pre-Experiment Data) uses a pre-treatment covariate to adjust the outcome. The adjustment is: adjusted = raw - θ*(covariate - mean(covariate)). This shrinks variance without biasing the treatment effect estimate. You keep all visitors — you just use their history to remove predictable noise."
        },
        {
          q: "The recommendation engine runs on a shared backend — all visitors in the same hour see the same algorithm. You can't assign individual visitors. What's the right design?",
          choices: [
            "Run the old algorithm on weekdays and the new one on weekends — the day-of-week difference is small",
            "Randomly assign which algorithm is live for each hour block, with short gaps between switches to let carryover fade",
            "Split by geography — show the new algorithm to visitors from the West coast only",
            "Wait for a backend redesign that supports per-user assignment before testing"
          ],
          answer: 1,
          explain: "A switchback experiment flips the whole system between treatment and control across time blocks. The key is randomizing the schedule and adding guard periods (gaps where data isn't counted) so the effect of one algorithm doesn't bleed into the next period's measurement."
        },
        {
          q: "The team checks 15 metrics: order value, click-through, cart adds, bounce rate, and 11 others. Three are significant. Which should they ship on?",
          choices: [
            "Ship based on the metric with the largest effect size — it's the most likely to be real",
            "Ship based on the primary metric decided before the test started; treat the rest as exploratory signals",
            "Ship based on whichever combination of the three significant metrics gives the best business case",
            "Don't ship — 15 metrics means the results are too noisy to trust"
          ],
          answer: 1,
          explain: "Pre-declaring a primary metric before looking at data is the cleanest fix. It means your shipping decision doesn't depend on how many metrics you happened to check. If you must check many, Benjamini-Hochberg controls the false discovery rate — but the decision should rest on the primary, not on whichever metric happened to survive."
        }
      ]
    },
    {
      industry: "Financial Services",
      icon: "🏦",
      scenario: "CreditUnion is testing a new loan approval UI that shows applicants their approval odds before submitting. They process 800 loan applications per month. The key metric is application completion rate.",
      questions: [
        {
          q: "Before the real test, the engineering team runs an A/A test (both groups see the current UI). After 2 weeks, it shows a significant difference (p=0.04). What should they conclude?",
          choices: [
            "This is expected — A/A tests often show small differences due to noise, and p=0.04 is borderline",
            "The pipeline has a problem — with no real difference, a significant gap points to a bug in assignment, logging, or measurement",
            "The sample size was too small; re-run the A/A test for another 2 weeks to see if it disappears",
            "The result is invalid because A/A tests should never produce significance"
          ],
          answer: 1,
          explain: "An A/A test tests your machinery, not your product. A significant difference with no real treatment means something in the pipeline is broken: assignment is biased, events are logged to the wrong arm, or there's a sample-ratio-mismatch. Fix the pipeline before trusting any real experiment. Also check whether the group sizes match — a lopsided split is the cheapest bug to catch."
        },
        {
          q: "The new UI shows a 2.1% absolute lift in completion rate (82.1% vs 80.0%), p=0.04. The engineering cost to maintain the new UI is significant. What's the right call?",
          choices: [
            "Ship it — the result is statistically significant and any lift is worth having",
            "Evaluate whether the ~17 additional completed applications per month justifies the ongoing engineering and maintenance cost",
            "Don't ship — 2.1% is too small to matter in financial services",
            "Ship it but only for the next 3 months, then re-evaluate"
          ],
          answer: 1,
          explain: "Statistical significance ≠ practical significance. A 2.1% lift on 800 monthly applications is ~17 more completions. The question is whether the business value of those 17 applications exceeds the cost of building, maintaining, and monitoring the new UI. That's a business decision — statistics tells you the effect is real, not whether it's worth acting on."
        },
        {
          q: "CreditUnion has been running experiments on the loan UI for 18 months. A data scientist suggests keeping a 10% holdout that never sees any experiment. What's the main argument against doing this?",
          choices: [
            "The holdout reduces your measured control group by 10%, which widens confidence intervals and makes every future test less sensitive",
            "Holdouts are only useful for B2C products, not financial services with smaller traffic",
            "The holdout group will have different behavior than tested users, making comparisons invalid",
            "Regulatory compliance prevents withholding features from any subset of applicants"
          ],
          answer: 0,
          explain: "A holdout costs you power now — every kid you peel into the holdout is one fewer measured control unit. That widens the chance pile and makes every current test foggier. The benefit is a pristine baseline later. Keep a holdout only when you suspect the experimentation program itself shifts behavior — and when the cost of less-sensitive tests is acceptable."
        }
      ]
    },
    {
      industry: "SaaS",
      icon: "💻",
      scenario: "CloudFlow, a B2B SaaS company, wants to test a simplified signup form (5 fields vs 12 fields). They get 1,200 signups per month. The metric is trial-to-paid conversion rate, which takes 14 days to measure after signup.",
      questions: [
        {
          q: "The team wants to check the dashboard weekly and stop the test when results look good. The trial-to-paid metric has a 14-day delay. Why is this especially dangerous here?",
          choices: [
            "The delay means you'll always need at least 14 days, so weekly checks are harmless",
            "At any weekly check, you're seeing trial-to-paid conversions from only the earliest signups, creating a biased and incomplete picture that changes as later signups mature",
            "The 14-day delay increases the variance of the estimate, so you need Bonferroni correction",
            "Weekly checks are fine as long as you use a stricter p-value threshold like 0.01"
          ],
          answer: 1,
          explain: "With a 14-day delay, checking at day 7 shows conversions from only the first few days of signups. Those early signups may not be representative. As later signups' 14-day windows mature, the numbers shift. Pre-commit to a duration that gives several full 14-day cycles, or use a sequential method designed for delayed outcomes."
        },
        {
          q: "Signups come from three channels: organic (high conversion), paid (medium), and referral (low). These differ a lot in baseline conversion. What's the best way to handle this?",
          choices: [
            "Run the test only on organic traffic — it's the largest and cleanest channel",
            "Randomize within each channel separately, then combine the within-channel estimates to remove the between-channel noise",
            "Weight the results so each channel contributes equally to the final estimate",
            "Remove the referral channel from analysis — it drags down the average"
          ],
          answer: 1,
          explain: "Stratification (or post-stratification) compares treatment vs control within each channel where baseline conversion is similar, then combines. This removes the variance caused by channel mix differences. You keep all data and all channels — you just stop comparing organic signups against referral signups, which would inflate noise without adding signal."
        },
        {
          q: "CloudFlow wants to test 3 different signup headlines simultaneously and has limited traffic. They're worried about wasting signups on a losing headline. What approach minimizes regret?",
          choices: [
            "Run a standard A/B/C test with equal 33/33/33 splits and decide at the end — the regret is bounded and known",
            "Use a multi-armed bandit that shifts traffic toward better-performing headlines as data arrives, reducing the number of signups wasted on losers",
            "Test the headlines sequentially — one per month — so each gets full traffic for a clean comparison",
            "Let the marketing team pick the best headline and skip testing — testing wastes traffic"
          ],
          answer: 1,
          explain: "A multi-armed bandit (e.g., Thompson sampling or epsilon-greedy) starts with some exploration but progressively sends more traffic to the headline that's winning. This minimizes regret — the signups lost to bad headlines — while still learning. Trade-off: adaptive allocation makes the final effect estimate harder to interpret, so if you need a clean estimate, a fixed test is better."
        }
      ]
    },
    {
      industry: "Healthcare",
      icon: "🏥",
      scenario: "MediCare+, a telehealth platform, is testing whether showing wait times on the booking page reduces no-shows. They have 3,000 appointments per week. No-show rate is currently 18%.",
      questions: [
        {
          q: "Patients book through mobile (60%, younger, higher no-show), desktop (30%, older, lower no-show), and tablet (10%). How should randomization handle this?",
          choices: [
            "Assign all mobile users to treatment since they have the highest no-show rate — that's where the improvement matters most",
            "Randomize ignoring device type — with 3,000 appointments, the mix will balance on its own",
            "Randomize within each device type separately so both arms have the same device mix, preventing device from confounding the result",
            "Only test on desktop users because their no-show rate is lower and more stable"
          ],
          answer: 2,
          explain: "Stratified randomization (randomizing within each device stratum) guarantees both arms have the same device mix. Simple randomization could imbalance devices by chance — and since device strongly predicts no-show rate, even a small imbalance could create a confound. This is the same principle as stratification in variance reduction, applied at the assignment stage."
        },
        {
          q: "After 1 week, the treatment shows a 2% absolute reduction in no-shows (16% vs 18%). The team wants to know if this is 'real.' What's the most direct way to answer?",
          choices: [
            "Calculate the p-value; if p<0.05, the effect is real",
            "Reshuffle the no-show labels at random and build a distribution of gaps — then see where 2% falls on that distribution",
            "Run the test for another week — if the gap persists, it's real",
            "Check whether the confidence interval around 2% excludes zero"
          ],
          answer: 1,
          explain: "A permutation test builds the chance distribution by shuffling labels: randomly reassign 'treatment' and 'control' to the same data and measure the gap each time. If your 2% gap is rare in that distribution (e.g., fewer than 5% of shuffles produce a gap that large), it's unlikely to be luck. This is the most direct, assumption-free way to judge if a gap is signal or noise."
        }
      ]
    },
    {
      industry: "Media",
      icon: "📺",
      scenario: "StreamFlix tests a new 'skip intro' button placement on their mobile app. 2M mobile users, metric is average watch time per session. The current button is at the top; the new one is bottom-right.",
      questions: [
        {
          q: "With 2M users, the test reaches statistical significance in 6 hours. The team wants to stop and ship. What's the strongest reason to wait?",
          choices: [
            "6 hours is too short to reach the central limit theorem's assumptions",
            "A 6-hour window likely captures a novelty effect — users click the new button because it's different, not because it's better, and the effect will fade",
            "With 2M users, the p-value is unreliable because the sample is too large",
            "You need at least 24 hours to account for timezone differences"
          ],
          answer: 1,
          explain: "With huge traffic, even tiny effects reach significance in hours. But a 6-hour window captures novelty — users interacting with the new button because it's new, not because it genuinely improves their experience. Pre-commit to a duration that lets novelty decay (often 1-2 weeks). The same principle applies to any UI change where 'new' drives initial engagement."
        },
        {
          q: "The team checks watch time, session length, skip rate, search rate, and app-store rating. Watch time (the pre-declared primary) is not significant, but skip rate and search rate are. What should they do?",
          choices: [
            "Ship based on skip rate — if users are skipping less, they're watching more, which is what you wanted",
            "Don't ship based on the primary metric; treat the significant secondaries as hypotheses for a follow-up test",
            "Apply a Bonferroni correction across all 5 metrics and re-check whether skip rate survives",
            "Ship based on whichever of the significant metrics has the largest effect size"
          ],
          answer: 1,
          explain: "The primary metric was pre-declared for a reason: it's the metric the decision should rest on. If it's not significant, you don't ship — even if secondaries look good. The significant secondaries are interesting and worth a follow-up test, but they don't override the primary. This is why pre-declaration matters: it prevents you from rationalizing a ship decision from whichever metric happened to win."
        }
      ]
    },
    {
      industry: "Ride-sharing",
      icon: "🚗",
      scenario: "RideGo tests a new surge pricing display. The old UI shows a multiplier (1.5x); the new one shows the actual fare. All riders in a city see the same UI at the same time because pricing is city-wide.",
      questions: [
        {
          q: "You can't split riders within a city because the pricing system is shared. Which approach is most defensible?",
          choices: [
            "Test in one city and use another similar city as a control, matching on size and demographics",
            "Flip the entire city between old and new UI across randomly assigned time blocks, adding gaps between switches where data isn't counted",
            "Run the old UI on Mondays/Wednesdays and the new UI on Tuesdays/Thursdays — a fixed schedule is simpler than random",
            "Survey riders about which display they prefer and use that as the outcome metric"
          ],
          answer: 1,
          explain: "A switchback flips the whole system between treatment and control over time blocks. Randomizing the schedule (not fixing it to specific days) prevents day-of-week confounds. Guard periods between switches let any carryover effect fade before the next period's data is counted. Geo-split (answer 0) is an alternative, but matching cities is hard — they differ in countless ways."
        },
        {
          q: "After switching from the new UI back to the old UI, riders who saw the new fare display continue to behave differently for the next hour. What is this, and how do you handle it?",
          choices: [
            "This is a logging bug — the assignment system didn't fully switch back, so fix the code",
            "This is carryover — the treatment's effect persists after it ends. Add a guard period between switches and exclude that data from analysis",
            "This is random noise — ignore it because it averages out over many switches",
            "This means the new UI is better — the persistence proves it had a lasting effect"
          ],
          answer: 1,
          explain: "Carryover happens when a treatment's effect bleeds into the next period. In switchback designs, you handle it with guard periods: a gap between switches where no data is counted, giving the effect time to dissipate. Without guard periods, the control period's data is contaminated by the prior treatment, biasing the estimate."
        }
      ]
    },
    {
      industry: "Education",
      icon: "🎓",
      scenario: "LearnOnline, an EdTech platform, tests two lesson formats: video-first vs text-first. 50K students, metric is lesson completion rate. Students who prefer video tend to be more engaged overall.",
      questions: [
        {
          q: "The team assigns video-first to students who've watched videos before, and text-first to everyone else. After 2 weeks, video-first shows a 15% higher completion rate. What's the most serious problem?",
          choices: [
            "Nothing — matching format to preference is a reasonable personalization strategy",
            "The two groups aren't comparable: video-preferring students were already more engaged, so the 15% could be entirely due to pre-existing engagement, not the format",
            "The sample sizes are likely unequal, which inflates the p-value",
            "Completion rate is the wrong metric — you should measure test scores instead"
          ],
          answer: 1,
          explain: "This is selection bias. The video-first group starts out more engaged, so any difference in completion could be due to who was in the group, not what they saw. Random assignment (or stratified randomization within engagement levels) ensures the groups are comparable before the treatment. Without that, the 15% gap is uninterpretable."
        },
        {
          q: "The product team wants to report 'there's an 82% chance the video-first format is better' rather than 'p < 0.05.' What method produces that kind of statement?",
          choices: [
            "Run a permutation test and report the proportion of shuffles where the gap favors video-first",
            "Start with a prior distribution for the effect size, update it with the observed data using Bayes' theorem, and report the posterior probability that the effect is positive",
            "Convert the p-value: 1 - p = 0.95, so there's a 95% chance the effect is real",
            "Run the test many times and report the fraction where video-first wins"
          ],
          answer: 1,
          explain: "Bayesian updating starts with a prior (what you believed before the test), combines it with the likelihood (what the data says), and produces a posterior distribution. From the posterior you can directly compute 'P(video-first is better) = 82%.' This answers the business question directly, unlike a p-value which only tells you the probability of the data under the null. Note: 1-p is NOT the probability the effect is real — that's a common misconception."
        }
      ]
    }
  ];

  function qz_prompt(quiz){
    return quiz.scenario;
  }

  /* -------------------------------------------------------------------- */
  /* Scene — minimal canvas, all text in #narrative                       */
  /* -------------------------------------------------------------------- */

  const scene = {
    title: "",
    legend: [],
    text(state){
      if (state.phase === "intro")
        return "Pick an industry to test your knowledge.";
      if (state.phase === "quiz" || state.phase === "decision"){
        const qz = state.quiz;
        const q = qz.questions[state.qIndex];
        const prompt = q.type === "design" ? q.decisionPrompt : q.q;
        return qz.scenario + "\n\n" + prompt;
      }
      if (state.phase === "reason"){
        const q = state.quiz.questions[state.qIndex];
        const decisionText = q.decisionOptions[state.decisionChoice];
        return "You chose: " + decisionText + "\n\n" + q.reasonPrompt;
      }
      if (state.phase === "feedback"){
        const q = state.quiz.questions[state.qIndex];
        if (state.answered === q.answer)
          return "✓ Correct! " + q.explain;
        return "✕ Not quite. " + q.explain;
      }
      if (state.phase === "done")
        return "You answered " + state.correct + " of " + state.quiz.questions.length + " correctly on " + state.quiz.industry + ". " +
          (state.correct === state.quiz.questions.length ? "Perfect — you've got these concepts down." :
           state.correct >= state.quiz.questions.length - 1 ? "Almost perfect — one to brush up on." :
           "Good start — review the explanations and try another industry.");
      return "";
    },
    enter(state){
      state.phase = "intro";
      state.quiz = null;
      state.qIndex = 0;
      state.answered = null;
      state.correct = 0;
      renderControls(state);
    },
    draw(c, now, state){
      // Canvas only shows results screen; quiz text is in #narrative.
      if (state.phase === "done"){
        const qz = state.quiz;
        const pct = Math.round(state.correct / qz.questions.length * 100);
        const color = pct === 100 ? COLOR.good : pct >= 67 ? COLOR.accent : COLOR.warn;
        label(qz.icon + " " + qz.industry, LOGICAL_W / 2, 120, { size: 28, weight: "600", color: COLOR.ink });
        label(state.correct + " / " + qz.questions.length + " correct (" + pct + "%)", LOGICAL_W / 2, 170, { size: 24, weight: "600", color });
        const barW = 400, barH = 30;
        const barX = (LOGICAL_W - barW) / 2, barY = 210;
        ctx.save();
        roundRect(barX, barY, barW, barH, 6);
        ctx.fillStyle = "#eee";
        ctx.fill();
        roundRect(barX, barY, barW * (state.correct / qz.questions.length), barH, 6);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }
    }
  };

  function renderControls(state){
    controlsEl.innerHTML = "";
    // Hide the canvas stage except on the results screen.
    const stage = document.getElementById("stage");
    if (stage) stage.style.display = state.phase === "done" ? "" : "none";
    if (state.phase === "intro"){
      QUIZZES.forEach(qz => {
        makeBtn(qz.icon + " " + qz.industry, null, () => {
          state.quiz = qz;
          state.qIndex = 0;
          state.phase = "quiz";
          state.answered = null;
          state.selected = null;
          state.decisionChoice = null;
          state.correct = 0;
          renderControls(state);
          updateText();
        });
      });
    } else if (state.phase === "quiz"){
      const q = state.quiz.questions[state.qIndex];
      if (q.type === "design"){
        // Design question: show decision options first, then advance to reason
        q.decisionOptions.forEach((opt, i) => {
          makeBtn(String.fromCharCode(65 + i) + ". " + opt, (state.decisionChoice === i ? "primary selected" : "") + " full", () => {
            state.decisionChoice = i;
            renderControls(state);
          });
        });
        makeBtn("Confirm choice →", "primary full", () => {
          if (state.decisionChoice == null) return;
          state.phase = "reason";
          state.selected = null;
          renderControls(state);
          updateText();
        });
      } else {
        // Standard MCQ
        q.choices.forEach((choice, i) => {
          makeBtn(String.fromCharCode(65 + i) + ". " + choice, (state.selected === i ? "primary selected" : "") + " full", () => {
            state.selected = i;
            renderControls(state);
          });
        });
        makeBtn("Submit answer", "primary full", () => {
          if (state.selected == null) return;
          state.answered = state.selected;
          if (state.selected === q.answer) state.correct++;
          state.phase = "feedback";
          renderControls(state);
          updateText();
        });
      }
    } else if (state.phase === "reason"){
      const q = state.quiz.questions[state.qIndex];
      q.choices.forEach((choice, i) => {
        makeBtn(String.fromCharCode(65 + i) + ". " + choice, (state.selected === i ? "primary selected" : "") + " full", () => {
          state.selected = i;
          renderControls(state);
        });
      });
      makeBtn("Submit answer", "primary full", () => {
        if (state.selected == null) return;
        state.answered = state.selected;
        if (state.selected === q.answer) state.correct++;
        state.phase = "feedback";
        renderControls(state);
        updateText();
      });
    } else if (state.phase === "feedback"){
      if (state.qIndex < state.quiz.questions.length - 1){
        makeBtn("Next question →", "primary", () => {
          state.qIndex++;
          state.phase = "quiz";
          state.answered = null;
          state.selected = null;
          state.decisionChoice = null;
          renderControls(state);
          updateText();
        });
      } else {
        makeBtn("See results →", "primary", () => {
          state.phase = "done";
          renderControls(state);
          updateText();
        });
      }
    } else if (state.phase === "done"){
      makeBtn("Try another industry →", "primary", () => {
        state.phase = "intro";
        state.quiz = null;
        renderControls(state);
        updateText();
      });
      makeBtn("Replay this quiz", null, () => {
        state.qIndex = 0;
        state.phase = "quiz";
        state.answered = null;
        state.selected = null;
        state.decisionChoice = null;
        state.correct = 0;
        renderControls(state);
        updateText();
      });
    }
  }

  // Register one chapter per industry so each is independently deep-linkable
  // and appears as a separate mission on the campaign map.
  QUIZZES.forEach(qz => {
    const id = "quiz-" + qz.industry.toLowerCase().replace(/[^a-z]/g, "-");
    const singleScene = {
      title: "",
      legend: [],
      text: scene.text,
      enter(state){
        state.phase = "quiz";
        state.quiz = qz;
        state.qIndex = 0;
        state.answered = null;
        state.selected = null;
        state.decisionChoice = null;
        state.correct = 0;
        renderControls(state);
      },
      draw: scene.draw
    };
    registerChapter(id, { scenes: [singleScene] });
  });
  // Also keep the combined chapter for the intro/picker
  registerChapter("real-world-quiz", { scenes: [scene] });

})();