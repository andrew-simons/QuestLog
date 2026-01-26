import React, { useEffect, useMemo, useRef, useState } from "react";
import { get, patch } from "../../utilities";

// ---------- Constants ----------
const ROOM_W = 1000;
const ROOM_H = 600;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- Asset Manager ----------
function useAssets() {
  const manifest = useMemo(
    () => ({
      roomBg: "/img/room.png",
      beaverSheet: "/img/beaver.png",
      chair: "/img/items/chair.png",
      // add more keys as you add catalog imageKey entries
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
      .catch((e) => console.error("Asset load failed:", e));

    return () => {
      alive = false;
    };
  }, [manifest]);

  return { ready, assetsRef };
}

// ---------- Resize Hook ----------
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

// ---------- Sprite helper (unchanged) ----------
function getBeaverFrameRect(dir, frameIndex) {
  return { sx: 0, sy: 0, sw: 250, sh: 250 };
}

// ---------- Hit test ----------
function pointInItem(px, py, item, img) {
  const w = img.width * item.scale;
  const h = img.height * item.scale;

  const left = item.x - w / 2;
  const right = item.x + w / 2;
  const top = item.y - h;
  const bottom = item.y;

  return px >= left && px <= right && py >= top && py <= bottom;
}

/**
 * RoomCanvas
 * mode:
 *  - "owner": editable (drag, wheel scale, WASD, patches)
 *  - "visitor": read-only (no edits, optional live updates via sockets)
 *
 * props:
 *  ownerId: whose room to show (for owner mode you can pass null and it will use /api/room)
 *  catalogByKey: Map(itemKey -> itemDef with imageKey)
 *  socket: optional socket.io client instance
 */
export default function RoomCanvas({
  mode,
  ownerId,
  catalogByKey,
  socket,
  onSelectedChange,
  reloadToken,
}) {
  const editable = mode === "owner";

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const { ready: assetsReady, assetsRef } = useAssets();
  const { w: canvasCssW, h: canvasCssH, dpr } = useCanvasSize(containerRef);

  const [selectedItemId, setSelectedItemId] = useState(null);

  // World refs (fast)
  const keysRef = useRef({ w: false, a: false, s: false, d: false });

  const worldRef = useRef({
    beaver: {
      x: 525,
      y: 510,
      dir: "down",
      speed: 220,
      frameIndex: 0,
      frameTimer: 0,
      isMoving: false,
    },
    items: [],
  });

  const dragRef = useRef({ draggingId: null, grabDx: 0, grabDy: 0 });

  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  // canvas resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.width = `${canvasCssW}px`;
    canvas.style.height = `${canvasCssH}px`;

    canvas.width = Math.floor(canvasCssW * dpr);
    canvas.height = Math.floor(canvasCssH * dpr);
  }, [canvasCssW, canvasCssH, dpr]);

  function updateViewTransform() {
    const scale = Math.min(canvasCssW / ROOM_W, canvasCssH / ROOM_H);
    const offsetX = (canvasCssW - ROOM_W * scale) / 2;
    const offsetY = (canvasCssH - ROOM_H * scale) / 2;
    viewRef.current = { scale, offsetX, offsetY };
  }

  function screenToWorld(sx, sy) {
    const { scale, offsetX, offsetY } = viewRef.current;
    return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
  }

  function worldToScreen(wx, wy) {
    const { scale, offsetX, offsetY } = viewRef.current;
    return { x: wx * scale + offsetX, y: wy * scale + offsetY };
  }

  // ---- Load room state (owner vs visitor) ----
  async function loadRoomOnce() {
    const room = editable ? await get("/api/room") : await get(`/api/rooms/${ownerId}`);

    worldRef.current.items = (room?.placedItems || []).map((p) => ({
      id: p.instanceId,
      itemKey: p.itemKey,
      x: p.x,
      y: p.y,
      scale: p.scale ?? 1.0,
    }));

    if (room?.beaver) {
      worldRef.current.beaver.x = room.beaver.x ?? worldRef.current.beaver.x;
      worldRef.current.beaver.y = room.beaver.y ?? worldRef.current.beaver.y;
      worldRef.current.beaver.dir = room.beaver.dir ?? "down";
    }
  }

  useEffect(() => {
    if (!editable && !ownerId) return;
    loadRoomOnce().catch(console.error);
  }, [editable, ownerId, reloadToken]);

  // ---- Live updates via sockets (visitor mode) ----
  useEffect(() => {
    if (!socket) return;
    if (editable) return; // you don't need to listen to your own updates here
    if (!ownerId) return;

    socket.emit("room:watch", { ownerId });

    const onRoomUpdate = (payload) => {
      // payload: { ownerId, placedItems, beaver }
      if (!payload || String(payload.ownerId) !== String(ownerId)) return;

      worldRef.current.items = (payload.placedItems || []).map((p) => ({
        id: p.instanceId,
        itemKey: p.itemKey,
        x: p.x,
        y: p.y,
        scale: p.scale ?? 1.0,
      }));

      if (payload.beaver) {
        worldRef.current.beaver.x = payload.beaver.x ?? worldRef.current.beaver.x;
        worldRef.current.beaver.y = payload.beaver.y ?? worldRef.current.beaver.y;
        worldRef.current.beaver.dir = payload.beaver.dir ?? worldRef.current.beaver.dir;
      }
    };

    socket.on("room:update", onRoomUpdate);

    return () => {
      socket.emit("room:unwatch", { ownerId });
      socket.off("room:update", onRoomUpdate);
    };
  }, [socket, editable, ownerId]);

  // selected item callback (optional)
  useEffect(() => {
    onSelectedChange?.(selectedItemId);
  }, [selectedItemId, onSelectedChange]);

  // Keyboard (owner only)
  useEffect(() => {
    if (!editable) return;

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
  }, [editable]);

  // Pointer events (owner only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
    };

    const onDown = (e) => {
      if (!editable) return;
      canvas.setPointerCapture?.(e.pointerId);

      const { sx, sy } = getPointer(e);
      const p = screenToWorld(sx, sy);

      const { items } = worldRef.current;
      const imgs = assetsRef.current.images;

      const drawOrder = [...items].sort((a, b) => a.y - b.y);
      for (let i = drawOrder.length - 1; i >= 0; i--) {
        const item = drawOrder[i];
        const def = catalogByKey?.get(item.itemKey);
        const img = def ? imgs[def.imageKey] : null;
        if (!img) continue;

        if (pointInItem(p.x, p.y, item, img)) {
          dragRef.current.draggingId = item.id;
          dragRef.current.grabDx = p.x - item.x;
          dragRef.current.grabDy = p.y - item.y;
          setSelectedItemId(item.id);
          return;
        }
      }

      setSelectedItemId(null);
    };

    const onMove = (e) => {
      if (!editable) return;

      const draggingId = dragRef.current.draggingId;
      if (!draggingId) return;

      const { sx, sy } = getPointer(e);
      const p = screenToWorld(sx, sy);

      const item = worldRef.current.items.find((it) => it.id === draggingId);
      if (!item) return;

      item.x = clamp(p.x - dragRef.current.grabDx, 0, ROOM_W);
      item.y = clamp(p.y - dragRef.current.grabDy, 0, ROOM_H);
    };

    const onUp = async () => {
      if (!editable) return;

      const id = dragRef.current.draggingId;
      dragRef.current.draggingId = null;
      if (!id) return;

      const item = worldRef.current.items.find((it) => it.id === id);
      if (!item) return;

      await patch(`/api/room/item/${id}`, { x: item.x, y: item.y, scale: item.scale });
      // server will broadcast room:update for watchers
    };

    const onWheel = (e) => {
      if (!editable) return;
      if (!selectedItemId) return;

      e.preventDefault();
      const item = worldRef.current.items.find((it) => it.id === selectedItemId);
      if (!item) return;

      const delta = -e.deltaY;
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
  }, [editable, assetsRef, catalogByKey, selectedItemId]);

  // Render loop (visitor can still render; owner updates movement too)
  useEffect(() => {
    if (!assetsReady) return;

    let raf = 0;
    let lastT = performance.now();

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      updateViewTransform();
      if (editable) update(dt);
      render();
    };

    const update = (dt) => {
      const w = worldRef.current;
      const b = w.beaver;
      const keys = keysRef.current;

      let vx = 0,
        vy = 0;
      if (keys.w) vy -= 1;
      if (keys.s) vy += 1;
      if (keys.a) vx -= 1;
      if (keys.d) vx += 1;

      const moving = vx !== 0 || vy !== 0;
      b.isMoving = moving;

      if (moving) {
        const mag = Math.hypot(vx, vy);
        vx /= mag;
        vy /= mag;

        if (Math.abs(vx) > Math.abs(vy)) b.dir = vx > 0 ? "right" : "left";
        else b.dir = vy > 0 ? "down" : "up";

        b.x = clamp(b.x + vx * b.speed * dt, 0, ROOM_W);
        b.y = clamp(b.y + vy * b.speed * dt, 0, ROOM_H);

        b.frameIndex = 0;
        b.frameTimer = 0;
      } else {
        b.frameIndex = 0;
        b.frameTimer = 0;
      }
    };

    const render = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const imgs = assetsRef.current.images;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const bg = imgs.roomBg;
      if (bg) {
        const tl = worldToScreen(0, 0);
        const br = worldToScreen(ROOM_W, ROOM_H);
        ctx.drawImage(bg, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }

      const { items, beaver } = worldRef.current;
      const drawables = [
        ...items.map((it) => ({ type: "item", y: it.y, it })),
        { type: "beaver", y: beaver.y, it: beaver },
      ].sort((a, b) => a.y - b.y);

      for (const d of drawables) {
        if (d.type === "item") {
          const it = d.it;
          const def = catalogByKey?.get(it.itemKey);
          const img = def ? imgs[def.imageKey] : null;
          if (!img) continue;

          const { x, y } = worldToScreen(it.x, it.y);
          const s = viewRef.current.scale * it.scale;
          const w = img.width * s;
          const h = img.height * s;

          ctx.drawImage(img, x - w / 2, y - h, w, h);

          if (editable && it.id === selectedItemId) {
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

          ctx.drawImage(sheet, sx, sy, sw, sh, x - dw / 2, y - dh, dw, dh);
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [assetsReady, dpr, editable, assetsRef, catalogByKey, selectedItemId]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {!assetsReady && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          Loading room...
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  );
}
