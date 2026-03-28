# scriptovid

![Next.js](https://img.shields.io/badge/Next.js-16.2.1-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![Remotion](https://img.shields.io/badge/Remotion-4.0.441-black?logo=remotion&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

scriptovid is a script-to-video solution that transforms written text into a complete video workflow in just a few clicks.

## Features

- Script-to-scene splitting engine
- Scene timing and duration controls
- Prompt-driven scene image generation
- Per-scene image upload and regeneration
- Narration generation and voice settings
- Local media asset management
- Motion preset and transition controls
- Render pipeline with export-ready MP4 output
- Studio preview and timeline validation
- Guided multi-step production wizard

## Tech Stack

- Next.js
- React
- TypeScript
- Remotion
- `@remotion/bundler`
- `@remotion/renderer`
- BlingFire
- ESLint

## Run Locally

```bash
git clone <your-repo-url>
cd scriptovid
```

```bash
# Node.js 20+ recommended
nvm install 20
nvm use 20
```

```bash
npm install
```

Create `.env.local` in the project root:

```env
# Required for Nanobanana image generation (server-side)
GEMINI_API_KEY=your_gemini_api_key

# Required for ElevenLabs narration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Run the app:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
