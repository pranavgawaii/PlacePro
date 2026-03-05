# Seat Allocation & Attendance Generator Bundle

This folder contains all files related to the Seat Allocation & Attendance module so you can copy it into another project.

## Included
- Frontend module:
  - src/modules/seat-allocation/
  - src/pages/SeatAllocationPage.tsx (re-export)
  - src/components/seat/ (re-export wrappers)
  - src/lib/seatApi.ts, src/lib/seatParsing.ts, src/lib/seatAllocationEngine.ts
  - src/types/seat.ts
- Supabase backend:
  - supabase/migrations/20260221_seat_attendance_module.sql
  - supabase/functions/_shared
  - supabase/functions/parse-students
  - supabase/functions/allocate-seats
  - supabase/functions/generate-documents
- Assets:
  - public/mitadt_logo.png
  - public/mit-adt-logo-transparent.png

## Notes
- The module assumes Tailwind utility classes and some shared styles from the original app (e.g. `premium-panel`, `btn-primary`, etc.).
- If your target project does not already have these classes, copy the relevant styles from your main `src/index.css` and Tailwind config.
- Route is expected to be `/app/seat-allocation` with auth protection.

## Quick Integration Checklist
1. Copy the folder contents into your project (preserve structure).
2. Ensure Supabase functions are deployed and migration applied.
3. Add the route and sidebar entry pointing to `SeatAllocationPage`.
4. Make sure the shared styles in `src/index.css` exist or are ported.
