# scriptovid

![Next.js](https://img.shields.io/badge/Next.js-16.2.1-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![Remotion](https://img.shields.io/badge/Remotion-4.0.441-black?logo=remotion&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

`scriptovid` is a local-first script-to-video tool built around a simple step-by-step wizard.

## Workflow

Script Input -> Scene Review -> Image Generation -> Voice Generation -> Video Rendering -> Download

## Features

- Wizard-based script-to-video flow
- Sentence-aware scene splitting with duration control
- Image generation with per-scene regenerate and manual image mode
- Narration generation with preview and manual narration mode
- Motion presets and transitions for scene playback
- Local media handling and export-ready rendering

## Tech Stack

- Next.js
- React
- TypeScript
- Remotion
- BlingFire
- ESLint

## Requirements

- Node.js 20+

## Run Locally

```bash
git clone <repo-url>
cd scriptovid
npm install
```

Create `.env.local` in the project root:

```env
# Optional when using manual/mock-style image flow
GEMINI_API_KEY=your_gemini_api_key

# Optional when using manual/mock-style narration flow
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
Third-party dependencies (including Remotion) are licensed under their own terms.
