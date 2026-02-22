# Snap & Sync — Project Status

> This file tracks implementation progress. Read it before starting any task.
> After completing a task, mark it `[x]` and note the date.

---

## Current Status: 🟡 Planning Complete — Ready to Build

**Last Updated**: 2026-02-22
**Current Phase**: Pre-Phase 1 (v0 mock analyzed, plan finalized)

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

---

## Phase 1: Foundation & Navigation

- [x] **Task 1.1** — Expo Project Init (routing, folder structure, tab layout) ✅ 2026-02-22
- [x] **Task 1.2** — Design System & Theme (colors, typography, Card/Badge/Button/Input) ✅ 2026-02-22
- [ ] **Task 1.3** — Port Dashboard Screen (greeting, stats, start session button)
- [ ] **Task 1.4** — Port History Screen (FlatList, summary cards, status legend)
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

---

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
