# Real-Time Video Editing - Scenix

## Overview
Scenix now features a complete **real-time video editing system** with instant playback, timeline manipulation, and live preview updates.

## Features Implemented

### 🎬 Real-Time Preview Panel
- **Live video playback** with frame-accurate scrubbing
- **Canvas overlay system** using Fabric.js (ready for text/stickers)
- **Smooth playback engine** using requestAnimationFrame
- **Interactive controls**: play/pause, seek, skip forward/back
- **Time display** showing current time and total duration
- **Hover controls** that appear on mouse interaction

### ⏱️ Interactive Timeline
- **4-track timeline** with unlimited clip support
- **Drag-and-drop clips** to reposition in real-time
- **Resize handles** on both ends of clips for trimming
- **Zoom controls** (50% - 300%) for precision editing
- **Time ruler** with second markers
- **Playhead indicator** synchronized with preview
- **Click-to-seek** anywhere on timeline
- **Double-click to delete** clips
- **Visual feedback** with selection highlights and colors

### 📁 Media Library
- **Upload any media**: videos, audio, images
- **Automatic duration detection** for video/audio files
- **Thumbnail previews** for all media types
- **Click-to-add** to timeline functionality
- **Smart positioning**: new clips append after existing ones
- **File type badges** and duration display

### 🔄 Real-Time Synchronization
- **Instant updates** between timeline and preview
- **Frame-accurate playback** synchronized with clips
- **Live trimming**: see results immediately
- **Smooth animations** for all state changes
- **Zustand state management** for predictable updates

## How to Use

### 1. Load Demo Video
Click "Load Demo" in the top bar to automatically load a sample video to the timeline.

### 2. Upload Your Own Media
- Click the upload icon in the Media Panel
- Select video, audio, or image files
- Click any media thumbnail to add it to the timeline

### 3. Edit on Timeline
- **Move clips**: Click and drag clips horizontally
- **Trim clips**: Drag the left/right edges to adjust duration
- **Delete clips**: Double-click any clip
- **Zoom**: Use +/- buttons or change zoom percentage
- **Seek**: Click anywhere on the timeline or use the preview controls

### 4. Playback
- Click the play button in the preview panel
- Use skip forward/back buttons (±5 seconds)
- Click the progress bar to seek
- Playback automatically shows the correct clip at current time

## Technical Architecture

### State Management (`store/editorStore.ts`)
```typescript
- clips: TimelineClip[]           // All clips on timeline
- mediaAssets: MediaAsset[]       // Uploaded media library
- playback: PlaybackState         // Current playback state
- selectedClipId: string | null   // Currently selected clip
- zoom: number                    // Timeline zoom level
```

### Real-Time Engine (`hooks/usePlaybackEngine.ts`)
- Uses `requestAnimationFrame` for smooth 60fps updates
- Synchronizes video element with timeline position
- Automatically handles play/pause/seek states
- Frame-accurate timing calculations

### Component Architecture
```
EditorPage
├── EditorTopbar (load demo, export)
├── MediaPanel (upload, library)
├── PreviewPanel (video + canvas + controls)
└── Timeline (tracks, clips, playhead)
```

## Advanced Features Ready

### Canvas Overlays
The preview panel includes a Fabric.js canvas ready for:
- Text overlays
- Stickers/emojis
- Shapes and drawings
- Animated elements

### Clip Properties
Each clip supports:
- Position (startTime)
- Duration with trimming
- Track assignment
- Effects array (ready for filters)
- Transform properties (scale, rotation, opacity)

### WebSocket Ready
The architecture supports real-time collaboration:
- Centralized state with Zustand
- Action-based updates
- Easy to broadcast changes via WebSocket

## Next Steps

### Waveform Visualization
Add `wavesurfer.js` integration:
```typescript
import WaveSurfer from 'wavesurfer.js'
// Render waveforms on audio/video clips
```

### FFmpeg Export
Use `@ffmpeg/ffmpeg` to export final video:
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg'
// Process timeline clips into final export
```

### Keyboard Shortcuts
- Space: Play/Pause
- Left/Right: Skip ±1 second
- Cmd/Ctrl + Z: Undo
- Delete: Remove selected clip

## Performance

- **60fps playback** using RAF
- **Smooth drag operations** with optimized re-renders
- **Efficient state updates** via Zustand selectors
- **Canvas rendering** for overlays without re-renders

## Browser Requirements

- Modern browser with HTML5 video support
- Canvas API support
- File API for uploads
- Sufficient RAM for video buffering

## Testing

1. Start dev server: `npm run dev`
2. Navigate to `/editor`
3. Click "Load Demo" or upload your own media
4. Play with timeline interactions
5. Test playback synchronization

---

**Real-time editing is now live!** 🎉
