/**
 * Dendridraw — Semantic Mindmap Layer on Excalidraw
 *
 * App entry point: initializes the root node on mount
 * and renders the Excalidraw-backed canvas.
 */
import { useEffect } from 'react';
import Canvas from './components/Canvas';
import { useMindmapStore } from './store/mindmapStore';

export default function App() {
  const rootId = useMindmapStore((s) => s.rootId);
  const initRoot = useMindmapStore((s) => s.initRoot);

  // Initialize with a root node on first mount
  useEffect(() => {
    if (!rootId) {
      initRoot('Central Topic');
    }
  }, [rootId, initRoot]);

  return <Canvas />;
}
