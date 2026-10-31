---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Avoid generic "AI slop" aesthetics. Focus on bold typography, editorial layout, atmospheric depth, cohesive color tokens, and polished micro-interactions.
---

# Frontend Design Guidance

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic (generic purple-to-indigo gradients on plain white backgrounds, sterile card grids, default system fonts, lack of hierarchy or brand character).

Avoid this. Approach every interface as an expert design lead at a high-end digital design studio crafting a memorable, tactile, and functional experience.

## 1. Distinctive Visual Identity & Brand Direction
- Commit to a clear aesthetic: Modern Editorial, High-End Luxury E-Commerce, or Precision Fintech.
- For SHEIN Egypt & Cart Concierge: Combine high-fashion luxury editorial aesthetics with high-trust fintech precision (Egypt InstaPay & Vodafone Cash).
- Deep obsidian blacks, polished warm metallics/gold accents, crisp crimson/coral badges, smooth frosted-glass cards, and subtle noise/mesh gradients.

## 2. Typography & Hierarchy
- Expressive, confident typography.
- High-contrast scale: Massive, tight-tracking editorial headlines (`tracking-tight font-black`), paired with ultra-clean, legible mono labels and data readouts.
- Curated spacing: generous breathing room, intentional asymmetric grids, staggered visual anchors.

## 3. Atmospheric Surfaces & Tactile Materiality
- Avoid flat boring single-color grey cards.
- Use layered surfaces: subtle glassmorphism (`backdrop-blur-md bg-white/80 border border-white/40 shadow-sm`), dark luxury glass, ambient glowing drop shadows, and delicate borders (`border-neutral-200/60`).
- Interactive feedback: crisp scale transitions on hover/click (`active:scale-[0.98] transition-all duration-200`), glowing focus rings, pill tags with subtle status pings.

## 4. Cohesive Color Tokens
- **Dominant**: Deep Obsidian (`#09090b` / `#18181b`), Clean Off-White canvas (`#fafafa` / `#f4f4f5`).
- **Brand Identity**: Haute Crimson / SHEIN Coral (`#e11d48` / `#be123c` / `#f43f5e`).
- **Trust & Currency (EGP / InstaPay / Vodafone)**:
  - InstaPay: Royal Violet / Amethyst (`#7c3aed` / `#6d28d9`).
  - Vodafone Cash: Vodafone Crimson & Ruby Glow (`#dc2626` / `#b91c1c`).
  - Approved/Success: Emerald Jewel (`#059669` / `#10b981`).
  - Pending Review: Warm Amber & Topaz (`#d97706` / `#f59e0b`).

## 5. Micro-interactions & Spatial Delights
- Staggered animations on load (`animate-in fade-in slide-in-from-bottom-2 duration-300`).
- Rich data summaries with visual badges, progress bars, interactive status pill toggles.
- Product cards that feel like an editorial lookbook with high-res aspect ratios, zoom states, and crisp badge overlays.
