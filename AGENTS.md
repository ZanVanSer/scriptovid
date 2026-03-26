
# AGENTS.md

## Project Overview

This project is a **local-first Script → Video generator** built with a simple wizard workflow.

The application converts a user-pasted script into a narrated slideshow-style video using the following steps:

1. Script input
2. Scene splitting
3. Image generation
4. Voice generation
5. Video rendering
6. Download

The system is intentionally **simple and sequential**. Each step is executed only after the previous step completes and is reviewed by the user.

This document defines rules for AI coding agents (Codex) working on the project.

---

# Core Development Philosophy

The project prioritizes:

• simplicity  
• clarity  
• modular phases  
• local development  
• testable steps  

Avoid unnecessary architecture or infrastructure.

---

# Hard Constraints

Agents MUST NOT introduce:

• background job queues  
• worker systems  
• microservices  
• authentication systems  
• databases (early phases)  
• cloud infrastructure  
• over-engineered state management  

The application should run locally using **Next.js + Node.js only**.

---

# Application Flow

The UI uses a **wizard-style sliding container**.  
Each stage replaces the previous stage without vertical scrolling.

Stages:

1. Script Input
2. Scene Review
3. Image Generation
4. Voice Generation
5. Video Rendering
6. Download

The screen position should remain stable between steps.

---

# Architecture Rules

Use a simple modular structure.

Example structure:

/app
/components
/modules
  /scene-splitter
  /image-generator
  /voice-generator
  /video-renderer
/utils
/types

Each module should be **independent** and easily replaceable.

---

# Scene Object Format

Scenes should follow this structure:

{
  id: number,
  text: string,
  duration: number,
  imageUrl?: string,
  effect?: string
}

Do not change this structure unless explicitly requested.

---

# Scene Splitting Rules

When splitting scripts into scenes:

• use sentence boundaries as base units  
• respect paragraph breaks  
• merge short sentences if needed  
• aim for durations within the user-selected range  

Do NOT randomly cut text mid-sentence.

---

# Image Generation

Images are generated from scene text.

Rules:

• generate one image per scene  
• maintain consistent style across scenes  
• allow regeneration per scene  

Before API integration, use **mock image generation**.

---

# Voice Generation

Voice generation occurs **after scene review**.

Rules:

• generate narration from the full script  
• allow audio preview before rendering video  
• allow regeneration if needed

Before API integration, use **mock audio generation**.

---

# Video Rendering

Rendering combines:

• scene images
• narration audio
• motion effects

Rendering is performed using **FFmpeg**.

Rules:

• scenes must respect duration timing
• transitions must be subtle
• effects should be selected from a curated pool

---

# Motion Effects Pool

Allowed effects:

• slow zoom in  
• slow zoom out  
• pan left  
• pan right  
• vertical drift  

Effects should be randomly selected but **not repeated excessively**.

---

# Development Phases

Agents should implement features **phase by phase**.

Never attempt to implement the entire system at once.

Each phase must produce a **working and testable result**.

---

# Code Quality Guidelines

Prefer:

• readable code
• small modules
• clear naming
• minimal dependencies

Avoid:

• premature optimization
• complex abstractions
• unnecessary frameworks

---

# Mock Mode Requirement

Early development should support **mock mode**:

Mock image generation  
Mock voice generation  
Mock rendering

This allows the UI and flow to be tested without external APIs.

---

# UI Behavior Rules

The interface must:

• use a centered container
• avoid long scrolling pages
• transition between steps horizontally
• clearly show loading states during generation steps

The user should always understand what stage the system is in.

---

# Final Goal

The final application should allow a user to:

Paste a script → click through the wizard → download a video.

The workflow should feel **fast, simple, and deterministic**.
