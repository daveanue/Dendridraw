/**
 * Dendridraw — Semantic Mindmap Layer on Excalidraw
 *
 * App entry point: initializes the root node on mount,
 * renders the Excalidraw canvas with the toolbar overlay.
 */
import { useEffect } from 'react';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import { useMindmapStore } from './store/mindmapStore';
import './App.css';

export default function App() {
  const rootId = useMindmapStore((s) => s.rootId);
  const initRoot = useMindmapStore((s) => s.initRoot);

  // Initialize with a root node on first mount
  useEffect(() => {
    if (!rootId) {
      initRoot('Central Topic');
    }
  }, [rootId, initRoot]);

  return (
    <div className="app-container">
      <Toolbar />
      <div className="canvas-container">
        <Canvas />
      </div>
    </div>
  );
}
