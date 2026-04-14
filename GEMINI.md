# Gemini CLI Project Context: scriptovid

`scriptovid` is a local-first script-to-video tool built with Next.js and Remotion. It features a wizard-based workflow that transforms text scripts into fully rendered videos with generated imagery and narration.

## Project Overview

### Core Technologies
- **Framework:** Next.js 16.2 (App Router)
- **UI:** React 19, CSS Modules
- **Video Engine:** Remotion 4.0
- **Language Processing:** BlingFire (for sentence splitting)
- **Type Safety:** TypeScript
- **Integrations:** 
  - ElevenLabs (Narration)
  - NanoBanana (Image Generation)

### Architecture
- **`/app`:** Contains App Router pages and API routes.
  - `/api/image`: Image generation endpoints.
  - `/api/narration`: Voice generation endpoints.
  - `/api/render`: Remotion rendering logic.
- **`/components/wizard`:** Implementation of the step-by-step video creation wizard.
- **`/modules`:** Pure logic modules for specific domains:
  - `scene-splitter`: Text normalization, sentence splitting, and scene packing.
  - `video-renderer`: Orchestrates Remotion render projects.
  - `image-generation`: Prompts and API integration for image creation.
  - `voice-generator`: Integration with ElevenLabs.
- **`/remotion`:** Remotion-specific compositions, components, and logic.
- **`/lib`:** Shared utilities, motion presets, and preview snapshots.
- **`/public/generated`:** Local storage for generated assets (images, audio, renders).

### Data Flow
1. **Script Input:** Text is normalized and split into sentences using BlingFire.
2. **Scene Packing:** Sentences are grouped into `PackedScene` objects based on target durations.
3. **Asset Generation:** 
   - Images are generated via NanoBanana or uploaded per scene.
   - Narration is generated via ElevenLabs or uploaded for the entire script.
4. **Timeline Planning:** Scenes are placed on a timeline with transitions and motion presets.
5. **Rendering:** Remotion bundles the project and renders it to an MP4 file.

## Building and Running

### Requirements
- Node.js 20+

### Key Commands
- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint for code quality checks.

### Environment Variables
Create a `.env.local` file with the following keys:
- `GEMINI_API_KEY`: Required for NanoBanana image generation.
- `ELEVENLABS_API_KEY`: Required for automated narration.

## Development Conventions

### Code Style
- **TypeScript:** Strict typing is preferred. Define types in the `/types` directory or locally if specific to a module.
- **Components:** Use Functional Components with Hooks. Client components must be marked with `"use client"`.
- **Logic Separation:** Keep complex logic out of React components by placing it in the `/modules` directory.
- **API Routes:** Use the Next.js App Router route handlers (`route.ts`).

### File Organization
- UI components go in `/components`.
- Domain-specific logic goes in `/modules`.
- Remotion-only code stays in `/remotion`.
- Shared constants and simple utilities go in `/lib`.

### State Management
- The wizard state is managed centrally in `components/wizard/useWizardState.ts`.
- Transient preview state is persisted to `localStorage` for sharing between the main app and Remotion preview tabs.

### Testing & Validation
- Ensure new features are validated within the wizard flow.
- For video-related changes, verify both the "Studio Preview" and the final "Render" output.
