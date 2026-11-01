# ShuttleHub match sheet

## Direction

Mode: Operate. The desk should answer: which court needs attention, and what can I do next?

Use the visual language of a club's printed match sheet: condensed sports numerals, readable player names, ruled rows, white paper, charcoal ink and restrained court green. The court occupancy strip is the signature element. Keep the existing logo.

Taste skill's achromatic-ledger direction supplies the quiet navigation and flat surfaces. Adapt its default Geist and blue to self-hosted Public Sans, Barlow Condensed headings/numerals and ShuttleHub court green. This is a sports operations screen used for long sessions, not a marketing page. UI/UX Pro Max's generated hero/glass recommendations do not fit this task; use its accessibility, responsive and interaction guidance instead.

## Tokens

- Paper: #f5f5f2; white working surfaces.
- Ink: #242a27; secondary text: #626861.
- Court green: #315b46; light green: #edf3ee; red reserved for destructive actions and errors.
- Rules: #dedfd8; stronger control boundaries: #a8aea5.
- Public Sans for body and controls. Barlow Condensed for page titles, court numbers and compact counts. Tabular numerals for scores and tables.
- 8px panel radii, 6px controls, no resting shadows, no decorative gradients.
- Visible 44px touch targets, consistent focus outline, existing reduced-motion support.

## Flow

Event-wide court occupancy stays explicit and is independent of the category filter. The match overview, counts and results use the selected category. Upcoming games retain existing fixture ordering; the UI does not invent a call order or imply that a match is free of player conflicts.

New categories lead to teams, then fixture review. Existing fixtures lead to Matches. Completed leagues expose the existing qualification review; completed finals lead to results. A short stage track on category cards shows registration, league, knockouts and finish using existing state. Diagram-design's lifecycle and focal hierarchy guidance informs this track; no decorative diagram is needed in the task UI.

Desktop navigation exposes match history alongside Matches. Phone navigation stays compact, with history reachable through More. Use existing URLs and store navigation so Back/Forward and query filters continue to work.

## Scope

Organizer shell, overview, category presentation and shared desk styling. Preserve scoring controls, loading media and venue measurement/layout logic. All visual verification uses local fixtures.
