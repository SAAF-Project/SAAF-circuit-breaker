# SAAF organiser explainer — speaking notes

## 1. Let the AI suggest.

Open with a familiar customer-service situation, not software terminology. An assistant wants a happy customer and a good rating. The official rules still apply. The idea is to keep those rules outside the assistant's changeable instructions. We evaluate proposed actions in a local demo; we do not send actual refunds.

## 2. Four stages. Four different jobs.

Use this analogy: an inspector, a practice drill, a safety barrier and a review of the receipts. They are complementary, not four versions of the same check. Forge reads the setup. Rehearsal tries test situations. Sentinel decides whether a proposed action may continue. Verify re-checks the recorded evidence afterward. Shared policy is the common thread. The prototype has separate tools; this diagram is the intended workflow, not a claim of a fully automated end-to-end orchestration pipeline.

## 3. Inspect it. Then stress-test it.

Forge's input is the program and official rules. It flags risky patterns such as self-editing instructions, performance pressure in context and missing decision logs, then emits a risk list and policy files. These files do not themselves guarantee safety; the runtime must enforce the rules. Rehearsal takes the rules and the canonical 36-ticket scenario. In this build, rewrites and pressure events are scripted, and the 16 personas are profiles, not independent interacting agents. The output is simulated loss and a trace of what happened, useful for comparing protection on versus off.

## 4. Stop the action. Restore safe rules.

A tool proposal is intercepted before any action is authorized. The hard check validates money, order value and the photo flag. Instruction and memory checks look for weakened rules or lessons promoting exceptions. Real Jev judgment helps assess that state, but it cannot override a failed money/evidence guard. The local runtime can halt the proposal, record a review item, and restore its server-owned last safe instructions and memory. This is a real persisted local transition, not restoration of an external production agent. Review is a local queue, not a notification sent to a real supervisor. A Jev failure or uncertain result halts for review. No external payment is executed.

## 5. Check the record—not the AI’s word.

Verify reads the saved decision log and approved rules, recalculates full-event hashes and parent links, and replays available guard inputs. It returns a consistency pass/fail and a readable report; changing a recorded verdict without recalculating the record fails. It cannot stop an action that already happened and does not prove a photo or a customer's story was true. Hash consistency is not a digital signature, proof of origin or a compliance certificate. Today the web demo has real Jev calls, hard guards, persisted local rollback and offline checks. The rehearsal remains scripted; signed transitions, external agent/container control and actual refunds are not connected. The workflow handoffs are not fully automated. End by inviting the organiser to see ticket 36 and the decision receipt.