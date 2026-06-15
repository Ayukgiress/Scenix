# Scenix

Scenix is a web-based **video editor platform** built with React and TypeScript. The goal of the project is to bring an in-browser editing workflow—trim/cut, timeline-style editing, waveform/audio tools, and canvas-based overlays—using modern browser technologies.

> Note: This repository currently contains a React/Vite starter UI. The README documents the intended platform direction and how to run the app locally.

## Features (intended)

- **Timeline-oriented editing** (video + audio composition)
- **Trim / cut / export workflows** (powered by `@ffmpeg/ffmpeg`)
- **Audio waveform UI** (powered by `wavesurfer.js`)
- **Canvas-based overlays** (stickers/text/shapes via `fabric`)
- **State management** for editor sessions and UI flows (powered by `zustand`)
- **Routing** for future editor pages and projects (powered by `react-router-dom`)

## Tech stack

- **React** + **TypeScript**
- **Vite** (dev server + build tooling)
- **Tailwind CSS** (styling)
- **FFmpeg (WASM)**: `@ffmpeg/ffmpeg`, `@ffmpeg/util`
- **Waveform**: `wavesurfer.js`
- **Canvas**: `fabric`
- **State**: `zustand`
- **UI helpers**: `lucide-react`, `clsx`, `tailwind-merge`

## Getting started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
npm ci
```

### Run locally (development)

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Preview production build

```bash
npm run preview
```

## Repository structure

- `src/App.tsx` – root UI component (currently scaffold)
- `src/main.tsx` – React mount entry
- `src/index.css`, `src/App.css` – styling
- `src/assets/` – images/icons used by the UI

## Roadmap placeholders (contributors)

These are intended editor-building milestones that can be implemented incrementally:

1. **Project/session model**
   - Define core types (assets, timeline items, edit operations)
   - Persist projects (local storage / backend later)
2. **Timeline UI**
   - Render clips and tracks
   - Drag/trim handles
3. **FFmpeg pipeline**
   - Implement export/preview using `@ffmpeg/ffmpeg`
   - Handle formats, transcoding options, and progress reporting
4. **Waveform + audio trimming**
   - Visualize audio via `wavesurfer.js`
   - Link waveform selection to timeline trimming
5. **Canvas editing layer**
   - Text/stickers/shapes using `fabric`
   - Sync canvas state with timeline keyframes (later)
6. **Routing / pages**
   - Landing → Editor → Project library (future)

## Contributing

- Keep changes small and test locally with `npm run dev`.
- If you add editor features, update this README with the completed capability and any new setup notes.

## License

Add your license here (e.g., MIT).
