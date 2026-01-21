import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Home.jsx (Canvas Room)
 * - Canvas renderer
 * - WASD movement
 * - Sprite animation
 * - Drag/drop + wheel scaling
 *
 * Assumes you can add your own images in /public or import paths.
 * If using your existing get/post utilities, swap in where noted.
 */

// ---------- Constants ----------
const ROOM_W = 1000;
const ROOM_H = 600;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- Asset Manager ----------
function useAssets() {
  const manifest = useMemo(
    () => ({
      roomBg: "/public/img/room.png",
      beaverSheet: "/public/img/beaver.png", // single 64x64 image for now    // sprite sheet
      chair: "/public/img/items/chair.png",
      // lamp: "/assets/items/lamp.png",
      // ... add more
    }),
    []
  );

  const [ready, setReady] = useState(false);
  const assetsRef = useRef({ images: {}, manifest });

  useEffect(() => {
    let alive = true;
    const entries = Object.entries(manifest);

    Promise.all(
      entries.map(([key, src]) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([key, img]);
          img.onerror = () => reject(new Error(`Failed to load ${key}: ${src}`));
          img.src = src;
        });
      })
    )
      .then((loaded) => {
        if (!alive) return;
        const images = {};
        for (const [k, img] of loaded) images[k] = img;
        assetsRef.current.images = images;
        setReady(true);
      })
      .catch((e) => {
        console.error("Asset load failed:", e);
      });

    return () => {
      alive = false;
    };
  }, [manifest]);

  return { ready, assetsRef };
}

// ---------- Resize Hook (if window size changes while alive) ----------
function useCanvasSize(containerRef) {
  const [size, setSize] = useState({ w: 800, h: 500, dpr: 1 });

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      setSize({
        w: Math.max(1, Math.floor(rect.width)),
        h: Math.max(1, Math.floor(rect.height)),
        dpr,
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return size;
}

// ---------- Sprite helper ----------
function getBeaverFrameRect(dir, frameIndex) {
  /**
   * You must match this to your sprite sheet layout.
   * Example layout:
   * rows: down, left, right, up
   * cols: 4 frames per row
   * each frame is 64x64
   */
  // const frameW = 64;
  // const frameH = 64;
  // const cols = 4;

  // const rowByDir = {
  //   down: 0,
  //   left: 1,
  //   right: 2,
  //   up: 3,
  // };

  // const row = rowByDir[dir] ?? 0;
  // const col = frameIndex % cols;

  // return { sx: col * frameW, sy: row * frameH, sw: frameW, sh: frameH };
  return { sx: 0, sy: 0, sw: 250, sh: 250 };
}

// ---------- Hit test ----------
function pointInItem(px, py, item, img) {
  // Simple axis-aligned bounding box based on image dimensions and item scale.
  // Assumes item.x,item.y represent the "feet" anchor (bottom-center).
  const w = img.width * item.scale;
  const h = img.height * item.scale;

  const left = item.x - w / 2;
  const right = item.x + w / 2;
  const top = item.y - h;
  const bottom = item.y;

  return px >= left && px <= right && py >= top && py <= bottom;
}

// ---------- Main Component ----------
function Home() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const { ready: assetsReady, assetsRef } = useAssets();
  const { w: canvasCssW, h: canvasCssH, dpr } = useCanvasSize(containerRef);

  // Minimal React state (not per-frame)
  const [selectedItemId, setSelectedItemId] = useState(null);

  // World state refs (fast)
  const keysRef = useRef({ w: false, a: false, s: false, d: false });

  const worldRef = useRef({
    beaver: {
      x: 525,
      y: 510,
      dir: "down",
      speed: 220, // world units / sec
      frameIndex: 0,
      frameTimer: 0,
      isMoving: false,
    },
    items: [
      // { id: "i1", imgKey: "chair", x: 520, y: 520, scale: 0.7 },
      // { id: "i2", imgKey: "lamp", x: 650, y: 520, scale: 0.6 },
    ],
  });

  const dragRef = useRef({
    draggingId: null,
    grabDx: 0,
    grabDy: 0,
  });

  // View transform (world -> screen)
  const viewRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  // Setup canvas resolution whenever size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.width = `${canvasCssW}px`;
    canvas.style.height = `${canvasCssH}px`;

    canvas.width = Math.floor(canvasCssW * dpr);
    canvas.height = Math.floor(canvasCssH * dpr);
  }, [canvasCssW, canvasCssH, dpr]);

  // Compute view transform (fit ROOM into canvas)
  function updateViewTransform() {
    const scale = Math.min(canvasCssW / ROOM_W, canvasCssH / ROOM_H);
    const offsetX = (canvasCssW - ROOM_W * scale) / 2;
    const offsetY = (canvasCssH - ROOM_H * scale) / 2;

    viewRef.current.scale = scale;
    viewRef.current.offsetX = offsetX;
    viewRef.current.offsetY = offsetY;
  }

  function screenToWorld(sx, sy) {
    const { scale, offsetX, offsetY } = viewRef.current;
    return {
      x: (sx - offsetX) / scale,
      y: (sy - offsetY) / scale,
    };
  }

  function worldToScreen(wx, wy) {
    const { scale, offsetX, offsetY } = viewRef.current;
    return {
      x: wx * scale + offsetX,
      y: wy * scale + offsetY,
    };
  }

  // Keyboard listeners
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = true;
      if (k === "a") keysRef.current.a = true;
      if (k === "s") keysRef.current.s = true;
      if (k === "d") keysRef.current.d = true;
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = false;
      if (k === "a") keysRef.current.a = false;
      if (k === "s") keysRef.current.s = false;
      if (k === "d") keysRef.current.d = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Pointer events (drag/drop)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return { sx, sy };
    };

    const onDown = (e) => {
      // Prevent scroll on touch
      canvas.setPointerCapture?.(e.pointerId);

      const { sx, sy } = getPointer(e);
      const p = screenToWorld(sx, sy);

      const { items } = worldRef.current;
      const imgs = assetsRef.current.images;

      // Hit-test topmost first: sort by y (depth), then reverse
      const drawOrder = [...items].sort((a, b) => a.y - b.y);
      for (let i = drawOrder.length - 1; i >= 0; i--) {
        const item = drawOrder[i];
        const img = imgs[item.imgKey];
        if (!img) continue;
        if (pointInItem(p.x, p.y, item, img)) {
          dragRef.current.draggingId = item.id;
          dragRef.current.grabDx = p.x - item.x;
          dragRef.current.grabDy = p.y - item.y;
          setSelectedItemId(item.id);
          return;
        }
      }

      // Clicked empty space
      setSelectedItemId(null);
    };

    const onMove = (e) => {
      const draggingId = dragRef.current.draggingId;
      if (!draggingId) return;

      const { sx, sy } = getPointer(e);
      const p = screenToWorld(sx, sy);

      const { items } = worldRef.current;
      const item = items.find((it) => it.id === draggingId);
      if (!item) return;

      item.x = clamp(p.x - dragRef.current.grabDx, 0, ROOM_W);
      item.y = clamp(p.y - dragRef.current.grabDy, 0, ROOM_H);
    };

    const onUp = (e) => {
      if (dragRef.current.draggingId) {
        // TODO: persist to backend here (PATCH)
        // Example: patch(`/api/room/item/${draggingId}`, {x,y,scale})
      }
      dragRef.current.draggingId = null;
    };

    const onWheel = (e) => {
      // scale selected item with wheel
      if (!selectedItemId) return;

      e.preventDefault();
      const { items } = worldRef.current;
      const item = items.find((it) => it.id === selectedItemId);
      if (!item) return;

      const delta = -e.deltaY; // positive = zoom in
      const factor = delta > 0 ? 1.06 : 0.94;
      item.scale = clamp(item.scale * factor, 0.25, 3.0);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [assetsRef, selectedItemId]);

  // Game loop (update + render)
  useEffect(() => {
    if (!assetsReady) return;

    let raf = 0;
    let lastT = performance.now();

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - lastT) / 1000); // cap dt
      lastT = t;

      updateViewTransform();
      update(dt);
      render();
    };

    const update = (dt) => {
      const w = worldRef.current;
      const b = w.beaver;
      const keys = keysRef.current;

      let vx = 0;
      let vy = 0;

      if (keys.w) vy -= 1;
      if (keys.s) vy += 1;
      if (keys.a) vx -= 1;
      if (keys.d) vx += 1;

      const moving = vx !== 0 || vy !== 0;
      b.isMoving = moving;

      if (moving) {
        // normalize diagonal
        const mag = Math.hypot(vx, vy);
        vx /= mag;
        vy /= mag;

        // direction pick (for sprite row)
        if (Math.abs(vx) > Math.abs(vy)) b.dir = vx > 0 ? "right" : "left";
        else b.dir = vy > 0 ? "down" : "up";

        b.x = clamp(b.x + vx * b.speed * dt, 0, ROOM_W);
        b.y = clamp(b.y + vy * b.speed * dt, 0, ROOM_H);

        // animation
        b.frameIndex = 0; //placeholder for no animation
        b.frameTimer = 0; //placeholder for no animation

        // b.frameTimer += dt;
        // if (b.frameTimer >= 0.1) {
        //   b.frameTimer = 0;
        //   b.frameIndex = (b.frameIndex + 1) % 4;
        // }
      } else {
        // idle
        b.frameIndex = 0;
        b.frameTimer = 0;
      }
    };

    const render = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const imgs = assetsRef.current.images;

      // Clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Use CSS-pixel coordinate system, then scale for DPR
      ctx.scale(dpr, dpr);

      // Draw room background
      const bg = imgs.roomBg;
      if (bg) {
        const topLeft = worldToScreen(0, 0);
        const bottomRight = worldToScreen(ROOM_W, ROOM_H);
        ctx.drawImage(
          bg,
          topLeft.x,
          topLeft.y,
          bottomRight.x - topLeft.x,
          bottomRight.y - topLeft.y
        );
      } else {
        // fallback background
        ctx.fillStyle = "#ddd";
        const tl = worldToScreen(0, 0);
        const br = worldToScreen(ROOM_W, ROOM_H);
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }

      // Gather drawables (items + beaver)
      const { items, beaver } = worldRef.current;

      const drawables = [
        ...items.map((it) => ({ type: "item", y: it.y, it })),
        { type: "beaver", y: beaver.y, it: beaver },
      ].sort((a, b) => a.y - b.y);

      // Draw each
      for (const d of drawables) {
        if (d.type === "item") {
          const it = d.it;
          const img = imgs[it.imgKey];
          if (!img) continue;

          const { x, y } = worldToScreen(it.x, it.y);
          const s = viewRef.current.scale * it.scale;

          const w = img.width * s;
          const h = img.height * s;

          // anchor: bottom-center at (x,y)
          ctx.drawImage(img, x - w / 2, y - h, w, h);

          // selection outline (optional)
          if (it.id === selectedItemId) {
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.strokeRect(x - w / 2, y - h, w, h);
          }
        } else {
          const b = d.it;
          const sheet = imgs.beaverSheet;
          if (!sheet) continue;

          const { sx, sy, sw, sh } = getBeaverFrameRect(b.dir, b.frameIndex);

          const { x, y } = worldToScreen(b.x, b.y);
          const spriteScale = viewRef.current.scale * 1.0;

          const dw = sw * spriteScale;
          const dh = sh * spriteScale;

          // anchor: bottom-center
          ctx.drawImage(sheet, sx, sy, sw, sh, x - dw / 2, y - dh, dw, dh);
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [assetsReady, dpr, selectedItemId, assetsRef]);

  // Optional: load room state from backend
  // useEffect(() => { get("/api/room").then(set into worldRef.current) }, [])

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left: Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {!assetsReady && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            Loading room...
          </div>
        )}
        <canvas ref={canvasRef} />
      </div>

      {/* Right: Simple UI / Inventory (MVP) */}
      <div style={{ width: 280, borderLeft: "1px solid", padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Inventory</h3>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
          Drag items in the room. Scroll to scale selected item.
        </p>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          <div>
            <b>Selected:</b> {selectedItemId || "None"}
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                const items = worldRef.current.items;
                const alreadyHasChair = items.some((it) => it.imgKey === "chair");
                if (alreadyHasChair) return;

                items.push({
                  id: `i${Math.random().toString(16).slice(2)}`,
                  imgKey: "chair",
                  x: 500,
                  y: 520,
                  scale: 0.7,
                });
              }}
            >
              Add Chair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
