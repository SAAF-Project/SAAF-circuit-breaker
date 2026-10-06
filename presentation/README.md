# SAAF — five-slide organiser explainer

Ready-to-present files:
- `SAAF-plain-language.pdf` — five fixed-widescreen pages; easiest format to present or email.
- `SAAF-plain-language.pptx` — five editable slides with speaker notes; DM Sans is the preferred font (PowerPoint may substitute it if not installed).
- `SAAF-plain-language.html` — self-contained browser presentation with embedded fonts. Arrow keys, Space, buttons or swipe navigate. Press E for text editing; browser changes save locally, and Ctrl/Cmd+S in edit mode downloads an edited copy.
- `speaker-notes.md` — plain-language explanation for each slide.

## Five-slide story

1. **Let the AI suggest. Keep the rules in charge.** A €21.35 refund request conflicts with the €20 limit and missing photo evidence.
2. **Four stages. Four different jobs.** Inspector → practice room → action guard → check the record. They are complementary, not repeated versions of one check.
3. **Inspect it. Then stress-test it.** Forge and Rehearsal, with explicit inputs, activities and outputs.
4. **Stop the action. Restore safe rules.** Action, instruction and lesson checks combine into one safety decision: continue, stop for local review, or restore safe instructions and notes.
5. **Check the record—not the AI’s word.** Saved decisions and approved rules become a checkable report; the current demo's limits are stated explicitly.

## Verification performed

Editable PPTX text and speaker notes were read back and compared with the shared source. PDF page count and titles were verified, all five pages rendered for visual review, and every browser slide checked for text overflow and overlapping panels. The HTML was tested at presentation and phone viewports without reflowing the 16:9 stage.
The PDF is exported from the same-source HTML presentation, not from a native PowerPoint renderer; LibreOffice/PowerPoint were unavailable on this host.

This explains the idea without claiming an autonomous MiroFish swarm, actual payment integration, signed records, a fully automated pipeline or certified compliance.

## Regeneration

`build_deck.py` needs Python 3.11+ and `python-pptx`, plus network access to retrieve the DM Sans font for embedding. `assets/viewport-base.css` is bundled. The HTML needs no network connection afterward.
`verify_deck.py` needs `python-pptx`, `pypdf`, `pypdfium2` and Pillow. It verifies the existing PDF and PowerPoint and produces `preview/all-slides.png`.
