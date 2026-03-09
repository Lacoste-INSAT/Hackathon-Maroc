# Snap & Sync — Project Status

> This file tracks implementation progress. Read it before starting any task.
> After completing a task, mark it `[x]` and note the date.

---

## Current Status: 🟢 Development Complete — Polish Phase

**Last Updated**: 2026-02-23
**Current Phase**: Phase 6 (UI Polish, Testing & Deployment Preparation)

---
'State Management (Zustand): As the app gets complex (handling sessions, online status, and sync queues across different screens), passing props will get messy. I strongly recommend telling the AI to use Zustand. It is lightweight, much simpler than Redux, and AI agents write it perfectly.'
## Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Compression target | **150-200KB** (tunable `COMPRESSION_TARGET_KB`) | 50KB destroys handwriting edges; Gemini needs legible ink |
| Original photo | **Always saved locally at full resolution** | Doctor can visually review even before AI runs |
| Online AI UX | **Optimistic UI** — "Saved! AI processing in background…" | Doctors shouldn't wait 10s before capturing next page |
| Local DB | expo-sqlite | Lightweight, Expo-native, async API |
| Backend | Supabase (Auth + PostgreSQL + Storage + Edge Functions) | Full-stack hosted, RLS, real-time subscriptions |
| AI | Gemini 2.5 Flash Vision | Fast, affordable, good handwriting extraction |
| Navigation | Expo Router (file-based) | Convention over configuration |
| Card UI & Theming | **Emerald Green metrics, flat outlines, no shadows** | Aesthetic overhaul per user requirement on 02/23 for a modern look |

---

## Phase 1: Foundation & Navigation

- [x] **Task 1.1** — Expo Project Init (routing, folder structure, tab layout) ✅ 2026-02-22
- [x] **Task 1.2** — Design System & Theme (colors, typography, Card/Badge/Button/Input) ✅ 2026-02-22
- [x] **Task 1.3** — Port Dashboard Screen (greeting, stats, start session button) ✅ 2026-02-22
- [x] **Task 1.4** — Port History Screen (FlatList, summary cards, status legend) ✅ 2026-02-22
- [x] **Task 1.5** — Port Review Queue Screen (list view + single record review) ✅ 2026-02-22

## Phase 2: Camera & QR Integration

- [x] **Task 2.1** — QR Code Scanner (expo-camera barcode + manual fallback) ✅ 2026-02-22
- [x] **Task 2.2** — Document Camera (photo capture + original always saved locally) ✅ 2026-02-22
- [x] **Task 2.3** — Image Compression (tunable 150-200KB, separate from original) ✅ 2026-02-22

## Phase 3: Local Storage & Network Detection

- [x] **Task 3.1** — SQLite Database (sessions, records, sync_queue, patients tables) ✅ 2026-02-22
- [x] **Task 3.2** — Network State Detection (NetInfo, NetworkContext, replace toggles) ✅ 2026-02-22
- [x] **Task 3.3** — Offline Queue Manager (enqueue, stats, viewable original photos) ✅ 2026-02-22

## Phase 4: Supabase Backend & Sync

- [x] **Task 4.1** — Supabase Client & Auth (SecureStore, email/password login) ✅ 2026-02-22
- [x] **Task 4.2** — Cloud DB & RLS Migrations (schema, indexes, policies, storage) ✅ 2026-02-22
- [x] **Task 4.3** — Cloud Sync Service (upload, syncAllPending, background worker) ✅ 2026-02-22
- [x] **Task 4.4** — Patient Lookup (QR → Supabase/SQLite, registration flow) ✅ 2026-02-22

## Phase 5: Gemini AI Integration

- [x] **Task 5.1** — Gemini API Client (system prompt, JSON parsing, timeout) ✅ 2026-02-22
- [x] **Task 5.2** — Online Flow: Optimistic UI (instant save → bg AI → notification) ✅ 2026-02-22
- [x] **Task 5.3** — Offline Flow & Background Extraction (Edge Function, review queue) ✅ 2026-02-22
- [x] **Task 5.4** — History, Analytics & Final Polish (real data, haptics, skeletons) ✅ 2026-02-22

## Phase 6: Final Polish & Fixes

- [x] **Task 6.1** — Universal UI Reformat (Flat buttons, standardized roundness, removed shadows) ✅ 2026-02-23
- [x] **Task 6.2** — History Component Re-render (SVG CircularProgress, removed repetitive legends) ✅ 2026-02-23
- [x] **Task 6.3** — Offline AI Synchronization Fix (AI executes correctly offline on cache) ✅ 2026-02-23
- [x] **Task 6.4** — Record Details Editability (Forms editable without red glow constraints) ✅ 2026-02-23

---
All targeted UI modifications across the Home, Queue, History, and Record details pages based on user feedback have been successfully implemented, unifying the app visually and logically.

Completed Changes
Home Page (app/(tabs)/index.tsx)
Start New Session Button: Lowered button position and eliminated the isometric 3D rotation, returning it firmly to the brand's primary purple format.
Card Aesthetics: Universalized the <Card> component framework to use flat borders, clean 
md roundness, and zero shadows.
History Page (
app/(tabs)/history.tsx
)
Card Design: Flushed out unnecessary sub-components (Top Legend Pills, redundant textual action statuses).
Circular Progress Pill: Replaced standard indicator arrows with a gorgeous, dynamic SVG progress ring mapping the AI confidence percentage perfectly. Emerald green marks high accuracy (>90%).
Record Detail Page (
app/record/[id].tsx
)
Data Editability: Eradicated the gray placeholders and red shadow warning boxes. The extracted fields are now beautiful, plain-text inline <TextInput> elements. Edits actively alter the final state categorization.
Unknown Patient Bug: Fixed fallback hierarchy. Uncached offline records now dynamically fall back to their patient code instead of bluntly greeting "Unknown Patient".
Status Classification Architecture
Fully re-engineered both the Active Session save function and the Offline Background Sync (
cloudSync.ts
) to honor exact classification definitions:

Autocaptured: Live human validation, 0 edits.
Assisted Capture: Live human validation, >0 edits.
AI Verified: Background sync validation, >80% accuracy.
Queue-Reviewed: Background sync failure/low accuracy (<80%), routed to the Queue.
Next Actionable Steps
With the UI and core logical frameworks solidified, the architecture is ready for the next lifecycle phase:

End-to-End Stress Testing: Perform a full session capture drill completely severed from Wi-Fi. Verify local SQLite queue expansion, and monitor the backgroundSync resolution pipeline the moment an LTE signal drops back in.
Data Export & Reporting: Implement PDF synthesis or CSV exporting direct from the History screen to allow administration to compile the extracted medical reports.
Failed Queue Interface: While "Failed Syncs" lists properly in 
queue.tsx
, we should build a dedicated inspector to show why an offline sync bounced (e.g. database rejection vs storage timeout) allowing manual retries.
Production Hardening: Ensure all Supabase Edge functions and Row Level Security definitions are locked.
## How to Use This File

When starting a task, give this prompt:

```
Read PLAN.md to see where we are. We just finished Task [X.X].
Now, implement Task [Y.Y]. Look at [relevant file] to understand
the current state before you start.
```

After completion, update the checkbox from `[ ]` to `[x]` and add the date:
```
- [x] **Task 1.1** — Expo Project Init ✅ 2026-02-23
```
