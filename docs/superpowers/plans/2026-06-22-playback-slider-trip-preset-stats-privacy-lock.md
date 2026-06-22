# 回放滑块 + 行程预设 + 统计面板 + 隐私锁屏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add playback timeline slider, trip preset management, trip statistics panel, and privacy PIN lock.

**Architecture:** Four independent local-first features with TDD implementation.

**Tech Stack:** React, MUI, Zustand, Vitest, TypeScript

---

## Tasks

1. Playback timeline slider - Add Slider to PlaybackPage with pause-on-drag
2. Trip preset domain + repo - CRUD operations and persistence
3. Trip preset store + ConfigPage UI - Management interface
4. Trip preset OverviewPage integration - Quick-select in creation dialog
5. Trip statistics domain + TripHistoryPage UI - Stats panel at top
6. Privacy lock domain + repo - PIN hashing and config persistence
7. Privacy lock store + components - Lock screen and timer logic
8. Privacy lock ConfigPage settings - Enable/disable and PIN management  
9. Version bump, README, release gate

Each task follows RED → GREEN → REFACTOR → COMMIT cycle.
