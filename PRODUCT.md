# ShuttleHub

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Run badminton tournaments from registration through league fixtures, qualification, knockouts and results. Organizers, umpires and venue screens share the same event with different permissions.

## Users and Operating Context

The repository documents an organizer desk, mobile umpire scoring, read-only venue displays and maintainer access. This review prioritizes the organizer working through match day; that priority is inferred from the request and remains open to user feedback.

## Capabilities and Constraints

Preserve tournament rules, team imports, arrivals, fixtures, group edits, court and player conflict checks, stage advancement, result corrections, offline scoring, access management, backups and display layouts. Existing APIs and state stores remain the source of truth.

The user requires local review on a branch other than main. No production deployment or Cloudflare configuration changes are authorized. Preview uses the supplied local Wrangler command and isolated storage in output/local-review.

## Brand Commitments

Keep ShuttleHub's name and existing logo. The user requests a distinct interface without generic minimalism or neon colors, and authorizes changes to colors and UX flow.

## Evidence on Hand

README.md, TESTING.md, docs/STAFF_GUIDE.md, existing frontend, tournament engine, automated tests, and prior screenshots in docs/ux-audit. Review fixtures must remain local and must never appear as invented production data.
