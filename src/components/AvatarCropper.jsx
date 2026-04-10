import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, ZoomIn, ZoomOut, Move } from 'lucide-react';

/**
 * AvatarCropper
 * Shows a modal with a circular preview where the user can pan + zoom the image.
 * On confirm, uses canvas to crop a 400×400 JPEG at 85% quality.
 *
 * Props:
 *   file     {File}             — the raw File selected by the user
 *   onConfirm(blob, previewUrl) — called with the cropped/compressed result
 *   onCancel()                  — called when user closes without confirming
 */
export default function AvatarCropper({ file, onConfirm, onCancel }) {
  const PREVIEW  = 280;           // px — diameter of the circular viewport
  const OUT_SIZE = 400;           // px — output canvas square size
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;

  const [imgEl,   setImgEl]   = useState(null);
  const [zoom,    setZoom]    = useState(1);
  const [pan,     setPan]     = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const lastPtr = useRef(null);
  const canvasRef = useRef(null);

  // ── Load image ──────────────────────────────────────────────────
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ── Draw live preview on canvas ─────────────────────────────────
  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const S = PREVIEW;
    ctx.clearRect(0, 0, S, S);

    // Circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();

    // Compute draw params
    const { sx, sy, sw, sh } = getCropParams(imgEl, zoom, pan, S);
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, S, S);
    ctx.restore();
  }, [imgEl, zoom, pan]);

  // ── Helpers ─────────────────────────────────────────────────────
  function getCropParams(img, z, p, viewSize) {
    // Size of the image area visible through the viewport
    const sw = viewSize / z;
    const sh = viewSize / z;
    // Center of the crop in image coordinates
    const cx = img.naturalWidth  / 2 - p.x / z;
    const cy = img.naturalHeight / 2 - p.y / z;
    // Top-left of the crop
    const sx = cx - sw / 2;
    const sy = cy - sh / 2;
    return { sx, sy, sw, sh };
  }

  function clampPan(newPan, img, z) {
    if (!img) return newPan;
    // Maximum pan so the image edge never goes past the viewport edge
    const maxX = (img.naturalWidth  * z - PREVIEW) / 2;
    const maxY = (img.naturalHeight * z - PREVIEW) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, newPan.x)),
      y: Math.max(-maxY, Math.min(maxY, newPan.y)),
    };
  }

  // ── Pointer events ───────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    lastPtr.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging || !lastPtr.current) return;
    const dx = e.clientX - lastPtr.current.x;
    const dy = e.clientY - lastPtr.current.y;
    lastPtr.current = { x: e.clientX, y: e.clientY };
    setPan(prev => clampPan({ x: prev.x + dx, y: prev.y + dy }, imgEl, zoom));
  }, [dragging, imgEl, zoom]);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    lastPtr.current = null;
  }, []);

  // ── Zoom ─────────────────────────────────────────────────────────
  const handleZoom = (e) => {
    const z = Number(e.target.value);
    setZoom(z);
    setPan(prev => clampPan(prev, imgEl, z));
  };

  // Pinch-to-zoom (wheel)
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const next  = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    setZoom(next);
    setPan(prev => clampPan(prev, imgEl, next));
  }, [zoom, imgEl]);

  // ── Confirm: render to output canvas, compress, return blob ──────
  const handleConfirm = () => {
    if (!imgEl) return;
    const out = document.createElement('canvas');
    out.width  = OUT_SIZE;
    out.height = OUT_SIZE;
    const ctx = out.getContext('2d');

    // Draw crop — same math as preview but scaled to OUT_SIZE
    const { sx, sy, sw, sh } = getCropParams(imgEl, zoom, pan, PREVIEW);
    // Scale sx/sy/sw/sh from preview coords to image coords (already in image coords)
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, OUT_SIZE, OUT_SIZE);

    out.toBlob(
      (blob) => {
        const previewUrl = URL.createObjectURL(blob);
        onConfirm(blob, previewUrl);
      },
      'image/jpeg',
      0.85
    );
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center gap-6 max-w-sm w-full animate-in zoom-in-95 duration-200">

        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">Ajustar Foto</h2>
          <p className="text-[11px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">
            Arrastra para encuadrar · Pellizca o desliza para zoom
          </p>
        </div>

        {/* Canvas preview with drag */}
        <div className="relative">
          {/* Ring around preview */}
          <div
            className="rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"
            style={{ width: PREVIEW, height: PREVIEW, cursor: dragging ? 'grabbing' : 'grab' }}
            onWheel={onWheel}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="block touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
          {/* Move hint icon */}
          <div className="absolute bottom-2 right-2 w-7 h-7 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center pointer-events-none">
            <Move size={13} className="text-white" />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="w-full flex items-center gap-3 px-1">
          <ZoomOut size={16} className="text-slate-400 shrink-0" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={handleZoom}
            className="flex-1 h-1.5 appearance-none rounded-full bg-slate-200 dark:bg-gray-700 accent-emerald-500 cursor-pointer"
          />
          <ZoomIn size={16} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-black text-slate-400 w-8 text-right tabular-nums">
            {zoom.toFixed(1)}×
          </span>
        </div>

        {/* Info chip */}
        <p className="text-[10px] text-slate-300 dark:text-gray-600 font-bold uppercase tracking-widest text-center">
          Se guardará como JPEG 400×400 · ~85% calidad
        </p>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            <X size={15} /> Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Check size={15} /> Usar foto
          </button>
        </div>
      </div>
    </div>
  );
}
