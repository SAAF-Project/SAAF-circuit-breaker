# SAAF Circuit Breaker — detailed presenter script

## Opening: what we built

**Say:** “SAAF Circuit Breaker is a safety and evidence layer around an AI refunds agent. The problem is not only a bad customer request. An agent rewarded for customer satisfaction can learn the wrong lesson, rewrite its instructions, and gradually treat its own exceptions as company policy. We keep the approved rules outside that feedback loop, inspect proposed actions, restore local safe state when drift is detected, and produce records that can be checked without asking another model to agree.”

**Scope:** Synthetic customer tickets; scripted rehearsal; real server-side Jev judgments in the live web path; persisted local prompt/memory restoration; unsigned consistency-checked workpapers. No external payments, production agent containment, completed human approval workflow, or certified regulatory compliance. GitHub Pages is a static inspection companion, not the live backend.

## 1. Command — the control-room overview

**Open:** `/`. **Show:** The four-stage pipeline, approved-policy fingerprint, and protection-on/off comparison.

**Say:** “Command answers three questions: what is the agent trying to do, what controls stand between it and a financial action, and what evidence will we retain? Follow the pipeline rather than treating this as seven unrelated dashboards. Forge examines design risk. Rehearsal exposes drift in a controlled scenario. Sentinel makes the action decision. Verify rechecks the resulting record. Swarm describes the stakeholder pressure, while Ledger stores the evidence.”

“On this screen, money and violation counters are generated from the deterministic sample scenario, not company production transactions. In our recorded 36-ticket scenario, the unprotected path produces twenty against-policy refunds totaling €453.30; the protected path produces zero against-policy simulated payout. That is a demonstration of these particular controls on this particular sequence—not a claim of universal loss prevention.”

**Input:** Approved policy and sample scenario. **Output:** Pipeline overview and comparative simulated outcomes. **Distinct job:** Orientation and navigation; Command is not another independent auditor.

**Transition:** “First we inspect the agent before we let it act.”

## 2. Forge — inspect the design and make rules explicit

**Open:** `/forge`. **Show:** Agent code, scan findings, and policy artifacts.

**Say:** “Forge asks whether the architecture creates a route for self-improvement to weaken governance. We inspect the example agent for patterns such as satisfaction-linked incentives, self-written memory, instruction rewriting, and refund-tool access. A finding identifies a risk mechanism, not proof that the agent has already caused a loss.”

“The output turns the intended boundaries into inspectable artifacts: a refund policy, permissions, judgment rules, and agent guidance. For this scenario, the key boundaries are a twenty-euro cap, never exceeding the order value, evidence requirements, and no special authority for review threats. A model cannot legitimately rewrite those limits merely because a customer is unhappy.”

“Implementation matters: the web scanner is pattern-based, while the Python scanner uses AST analysis for supported Python constructs, including registry-style tool calls. This is not full TypeScript semantic analysis or a formal proof that every dangerous path is detected.”

**Input:** Example source and approved business constraints. **Output:** Findings and policy/permission artifacts. **Distinct job:** Pre-execution architecture review, not runtime authorization.

**Demonstration cue:** Run the Forge scan and explain one finding in plain language: “This rewards the agent for the wrong outcome.”

## 3. MiroFish — rehearsal before exposure to customers

**Open:** `/rehearsal`. **Show:** Watchdog-off/on controls; ticket progression; working instructions, memory, and drift.

**Say:** “This page is named MiroFish because the design is inspired by stakeholder-pressure simulation. Our delivered rehearsal is a scripted, deterministic scenario; it does not execute the upstream MiroFish engine or sixteen autonomous agents. That makes the demonstration reproducible, but limits what we can infer about emergent behavior.”

“Start with protection off. Move through the tickets and watch not only the refund amount, but also the instructions and remembered lessons. The dangerous transition is from ‘follow the approved rule’ to ‘make exceptions to keep customers happy.’ Then repeat the same sequence with protection on. The approved guard remains authoritative even when the agent’s working state changes.”

“Ticket thirty-six is a useful concrete example: a proposed €21.35 refund on a €21.59 order, no photo evidence, and pressure about a review. The proposal fits inside the order value but exceeds the twenty-euro cap; satisfying one condition does not satisfy the whole policy. Sentinel can halt the proposal or quarantine and restore state rather than accepting the agent’s justification.”

**Input:** Fixed ticket sequence, scripted state changes, and watchdog mode. **Output:** Rehearsal decisions, drift indicators, checkpoints, and workpapers. **Distinct job:** Before-launch scenario testing, not a production financial control or a demonstrated autonomous swarm.

## 4. Jev Sentinel — decide before the proposed tool action

**Open:** `/sentinel`. **Show:** Proposed amount and order total, evidence flag, working prompt/memory, returned Jev judgment, and restored state.

**Say:** “Sentinel is the action boundary. It receives a proposed `execute_refund` call and the agent’s working state. Strict input validation comes first: malformed monetary values and incorrectly typed flags must not become permission through coercion. Deterministic monetary and evidence rules retain veto power.”

“The web path then calls the real TypeSafe Jev service from the server. The API key never belongs in a judge’s browser. We record the provider status and judgment rather than presenting a local script as a model response. An unavailable, invalid, or insufficiently confident judgment cannot authorize an action. Equally, an ‘allow’ response from Jev cannot override a failed hard guard.”

“When drift is sufficiently severe, a hard rule is weakened, or Jev recommends quarantine, the local agent’s instructions and memory are restored to a server-owned healthy checkpoint. The new state and evidence are committed together to PostgreSQL, with per-session serialization so competing requests cannot silently overwrite the session. Otherwise, a rejected proposal retains the prior state.”

“Be precise about the boundary: this demonstrator persists local restoration and a human-review status. It does not freeze an external agent container, notify a staffed reviewer, obtain an authenticated approval, or send a real refund. Even an allowed live proposal records `paymentExecuted: false`.”

**Input:** Proposed action plus local instructions/memory. **Output:** Allow, human route, or quarantine/rollback; actual provider result; persisted local state and workpaper. **Distinct job:** Runtime authorization and local recovery.

## 5. Verify — do not trust the record merely because it exists

**Open:** `/verify`. **Show:** A valid workpaper, then a modified verdict that fails verification.

**Say:** “Verify asks a different question from Sentinel. Sentinel decides whether an action should proceed; Verify checks whether the supplied evidence is structurally consistent with its approved origin, linked events, and deterministic invariants. It does not rerun Jev or ask another language model to judge the previous model.”

“The verifier checks the recognized genesis policy, event structure, full-event hashes, parent linkage, Merkle root, mode binding, and replayable policy conditions. Changing a verdict or rollback field without updating the hashes is detected. Recomputing the hashes is also not sufficient to legitimize a replayable monetary-policy violation.”

“However, this is consistency, not authenticity. Our `CONSISTENCY_CHECKED` seal is not a digital signature. Someone with control of the whole evidence producer can fabricate an internally consistent trace, and a verifier cannot prove that omitted events existed. Production assurance needs authenticated producers, protected capture, signed checkpoints, and a credible completeness and retention story.”

**Input:** Workpaper JSON. **Output:** Individual checks and an overall pass/fail/report. **Distinct job:** Post-event re-performance without an additional model call. The Python verifier provides an offline route; the Python Sentinel does not call Jev.

## 6. Swarm — explain whose incentives create pressure

**Open:** `/personas`. **Show:** Sixteen persona cards and their pressure vectors.

**Say:** “Swarm makes the incentive conflict visible. Customers want fast compensation; satisfaction metrics reward appeasement; treasury wants to limit leakage; risk and audit want defensible controls. The agent sits between these demands. Each persona card describes a stakeholder perspective and the pressure it can create.”

“This page is a catalogue and visualization, not evidence that sixteen model agents are negotiating in real time. Its purpose is to help a judge understand why instruction drift is organizational, not merely a prompt-injection trick. In a future genuine multi-agent rehearsal, these perspectives would generate interacting behavior; that integration remains outside this build.”

**Input:** Authored persona definitions. **Output:** Stakeholder/pressure visualization. **Distinct job:** Explain test coverage and competing incentives; no independent enforcement or live swarm execution.

## 7. Ledger — preserve the decision trail

**Open:** `/ledger`, then a workpaper detail. **Show:** Workpaper identifiers, verification status, event verdicts, parent/step hashes, and root.

**Say:** “Ledger answers what we actually retained. It lists persisted workpapers and recent ticket events, with the amount proposed, outcome, drift score, and evidence identifiers. From a decision, we can follow its linked workpaper rather than relying on a screenshot of a green status.”

“Events commit the proposed action, policy inputs, decision, local state transitions, and—on the live path—the Jev result. These records support inspection and deterministic re-performance. Simulated paid amounts are scenario accounting; live demonstration records do not represent transferred money.”

“Some original interface labels still say ‘signed state transitions’ or ‘ISA 230 ledger.’ Treat those as aspirational wording, not established capabilities. The current implementation uses hashes, not producer signatures; the claimed audit value is better traceability and re-performance, not legal certification. Legacy partial-hash workpapers are not silently accepted as modern verified evidence.”

**Input:** Persisted events, checkpoints, and workpapers. **Output:** Navigable evidence and exported records. **Distinct job:** Storage and retrieval; Verify remains the checking step.

## How this extends Job Angula’s Drift Watch

**Say:** “Our primary reference is Job Angula’s Drift Watch, not another similarly named security or agricultural product. Drift Watch already has the important safety ideas: independent action guards, instruction and memory auditors, a drift threshold, checkpoint rollback, and quarantine. It also documents a live-model self-improvement loop and an offline mode. We should credit those ideas rather than claim we invented them.”[5]

“Our extension packages that safety loop into an inspect–rehearse–intercept–verify lifecycle, adds explicit Forge artifacts, a real TypeSafe Jev judgment adapter in the web path, transactionally persisted local sessions, and full-event consistency-checked workpapers with deterministic verification. These are improvements in integration, evidence, and presentation—not a demonstrated increase in detection accuracy.”

“There is an important trade-off: Drift Watch documents genuinely emergent model drift in its live loop, whereas our main rehearsal uses authored state changes. We have not run a controlled head-to-head benchmark, so neither the larger sample loss counter nor our additional pages proves superiority. The honest pitch is ‘an assurance-oriented extension of the reference,’ not ‘a better drift detector.’”[5]

## EU AI Act and other obligations — responsible wording

**Say:** “This is compliance-enabling engineering, not a compliance certificate or legal opinion. Start with the intended use and legal classification: a customer-service refund agent is not automatically high-risk merely because it uses AI. Article 6 classification and the applicable listed uses must be assessed before claiming the high-risk obligations apply.”[4]

“Article 14 concerns effective human oversight for high-risk systems, including understanding limitations, resisting automation bias, overriding outputs, and intervening or stopping safely. Our visible reasons, halt decisions, and local restoration support that design direction. A status called ‘route to human’ is not enough: a production deployment needs competent authorized people, actual escalation, and controlled approval or override.”[1]

“Article 12 addresses automatic logging and traceability for high-risk systems. Our linked evidence is relevant, but protected retention, access controls, monitoring, producer authentication, and complete lifecycle coverage remain operational responsibilities. Hashing logs does not discharge all record-keeping duties.”[3]

“GDPR is a separate obligation wherever personal data are processed. Use lawful and transparent processing, data minimization, appropriate retention, and security. Assess Article 22 if a solely automated decision has legal or similarly significant effects; not every small refund automatically meets that test. Assess the need for a DPIA and the data-sharing arrangements before sending real customer information to a model provider. These public materials use synthetic tickets.”[2]

“ISA 230 is an audit-documentation standard, not a statute certifying an AI product. NOREA and IIA are professional assurance references, not substitute EU regulations. The useful claim is that our evidence structure supports review; independent auditors still need sufficient, appropriate evidence and the organization’s actual controls. Broader sector-specific, consumer-protection, cybersecurity, and financial-control duties depend on the deployment and require their own assessment.”

**Closing:** “The agent can propose and learn, but it cannot promote its own lessons into authority over the approved rules. We inspect before deployment, enforce at the action boundary, restore local safe state, and retain evidence that others can check.”

## Judge inspection guide

- GitHub Pages: static inspection companion with recorded interface screens, the narrated video, presentation, this script, and source/evidence links. No credential entry or live backend calls.
- Full application: source in the repository; setup is documented in the root README. PostgreSQL and a server-side Jev credential are required for the full live web path.
- Release evidence: `verification/RESULTS.md` records 34 Python tests, 13 TypeScript tests, 26 live acceptance checks, and the remaining limitations. Those counts describe the recorded release run, not a new test run performed for this script.

## Sources

[1] https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14
[2] https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
[3] https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-12
[4] https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6
[5] https://github.com/jangula/drift-watch
