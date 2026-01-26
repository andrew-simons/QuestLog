import React, { useEffect, useMemo, useRef, useState } from "react";
import { get, patch } from "../../utilities";

// ---------- Constants ----------
const ROOM_W = 1000;
const ROOM_H = 600;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- Floor seam (V-shape) ----------
const SHOW_FLOOR_DEBUG = false;

const FLOOR_LEFT = { x: 0, y: 570 };
const FLOOR_CORNER = { x: 500, y: 400 };
const FLOOR_RIGHT = { x: 1000, y: 570 };

const FLOOR_MARGIN = 24;

const lerp = (a, b, t) => a + (b - a) * t;

function floorTopY(x) {
  if (x <= FLOOR_CORNER.x) {
    const t = (x - FLOOR_LEFT.x) / (FLOOR_CORNER.x - FLOOR_LEFT.x);
    return lerp(FLOOR_LEFT.y, FLOOR_CORNER.y, clamp(t, 0, 1));
  } else {
    const t = (x - FLOOR_CORNER.x) / (FLOOR_RIGHT.x - FLOOR_CORNER.x);
    return lerp(FLOOR_CORNER.y, FLOOR_RIGHT.y, clamp(t, 0, 1));
  }
}

// ---------- Asset Manager ----------
function useAssets() {
  const manifest = useMemo(
    () => ({
      roomBg: "/img/room.png",
      beaverSheet: "/img/beaver.png",
      chair: "/img/items/chair.png",
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

// ---------- Sprite helper ----------
function getBeaverFrameRect(dir, frameIndex) {
  // placeholder; you can expand later
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

export default function RoomCanvas({
  mode,
  ownerId, // still used for REST room load in visitor mode
  roomId, // NEW: presence room id (for multiplayer). owner roomId === ownerId typically
  viewerId, // NEW: current logged-in user id
  catalogByKey,
  socket,
  onSelectedChange,
  reloadToken,
}) {
  const canEditItems = mode === "owner";
  const canMove = !!viewerId; // owner + visitor can move if logged in

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const { ready: assetsReady, assetsRef } = useAssets();
  const { w: canvasCssW, h: canvasCssH, dpr } = useCanvasSize(containerRef);

  const [selectedItemId, setSelectedItemId] = useState(null);

  const keysRef = useRef({ w: false, a: false, s: false, d: false, up: false, down: false });

  // World (items only now)
  const worldRef = useRef({
    items: [],
  });

  // Multiplayer players: userId -> beaver state
  const playersRef = useRef(new Map());

  // helper: ensure our local beaver object exists
  const getMyBeaver = () => {
    if (!viewerId) return null;
    if (!playersRef.current.has(String(viewerId))) {
      playersRef.current.set(String(viewerId), {
        x: 525,
        y: 510,
        dir: "down",
        speed: 220,
        frameIndex: 0,
        frameTimer: 0,
        isMoving: false,
      });
    }
    return playersRef.current.get(String(viewerId));
  };

  const dragRef = useRef({ draggingId: null, grabDx: 0, grabDy: 0 });
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  // socket throttling state (movement broadcast)
  const netRef = useRef({
    lastSentAt: 0,
    lastX: null,
    lastY: null,
    lastDir: null,
  });

  // owner persistence throttle + "send once on stop"
  const persistRef = useRef({
    t: 0,
    sentStop: false,
  });

  // Debounced save (items)
  const saveTimerRef = useRef(null);

  const scheduleSaveItem = (id) => {
    if (!id) return;
    const item = worldRef.current.items.find((it) => it.id === id);
    if (!item) return;

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      patch(`/api/room/item/${id}`, { x: item.x, y: item.y, scale: item.scale }).catch(
        console.error
      );
    }, 120);
  };

  useEffect(() => {
    return () => window.clearTimeout(saveTimerRef.current);
  }, []);

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

  // ---- Load room state (items + owner beaver spawn) ----
  async function loadRoomOnce() {
    const room = canEditItems ? await get("/api/room") : await get(`/api/rooms/${ownerId}`);

    worldRef.current.items = (room?.placedItems || []).map((p) => ({
      id: p.instanceId,
      itemKey: p.itemKey,
      x: p.x,
      y: p.y,
      scale: p.scale ?? 1.0,
    }));

    // Only use REST beaver as initial spawn for the OWNER’s beaver (room owner)
    if (room?.beaver) {
      const ridOwner = String(ownerId ?? viewerId ?? "");
      if (ridOwner) {
        const prev = playersRef.current.get(ridOwner) || {};
        playersRef.current.set(ridOwner, {
          ...prev,
          x: room.beaver.x ?? prev.x ?? 525,
          y: room.beaver.y ?? prev.y ?? 510,
          dir: room.beaver.dir ?? prev.dir ?? "down",
          speed: prev.speed ?? 220,
          frameIndex: prev.frameIndex ?? 0,
          frameTimer: prev.frameTimer ?? 0,
          isMoving: prev.isMoving ?? false,
        });
      }
    }
  }

  useEffect(() => {
    if (!canEditItems && !ownerId) return;
    loadRoomOnce().catch(console.error);
  }, [canEditItems, ownerId, reloadToken]);

  // ---- KEEP your old "room:update" watcher for items (optional/backcompat) ----
  useEffect(() => {
    if (!socket) return;
    if (canEditItems) return;
    if (!ownerId) return;

    socket.emit("room:watch", { ownerId });

    const onRoomUpdate = (payload) => {
      if (!payload || String(payload.ownerId) !== String(ownerId)) return;

      if (payload.placedItems) {
        worldRef.current.items = (payload.placedItems || []).map((p) => ({
          id: p.instanceId,
          itemKey: p.itemKey,
          x: p.x,
          y: p.y,
          scale: p.scale ?? 1.0,
        }));
      }

      // if server still sends owner beaver this way, merge it into players map
      if (payload.beaver) {
        const uid = String(ownerId);
        const prev = playersRef.current.get(uid) || {};
        playersRef.current.set(uid, {
          ...prev,
          x: payload.beaver.x ?? prev.x,
          y: payload.beaver.y ?? prev.y,
          dir: payload.beaver.dir ?? prev.dir,
          speed: prev.speed ?? 220,
          frameIndex: prev.frameIndex ?? 0,
          frameTimer: prev.frameTimer ?? 0,
          isMoving: prev.isMoving ?? false,
        });
      }
    };

    socket.on("room:update", onRoomUpdate);

    return () => {
      socket.emit("room:unwatch", { ownerId });
      socket.off("room:update", onRoomUpdate);
    };
  }, [socket, canEditItems, ownerId]);

  // ---- NEW: presence multiplayer join + handlers ----
  useEffect(() => {
    if (!socket) return;
    if (!viewerId) return;
    if (!roomId) return;

    socket.emit("presence:join", { roomId: String(roomId) });

    const onState = ({ roomId: rid, users }) => {
      if (String(rid) !== String(roomId)) return;

      const next = new Map(playersRef.current);
      for (const [uid, pose] of Object.entries(users || {})) {
        const prev = next.get(uid) || {};
        next.set(uid, {
          ...prev,
          x: pose?.x ?? prev.x ?? 525,
          y: pose?.y ?? prev.y ?? 510,
          dir: pose?.dir ?? prev.dir ?? "down",
          speed: prev.speed ?? 220,
          frameIndex: prev.frameIndex ?? 0,
          frameTimer: prev.frameTimer ?? 0,
          isMoving: prev.isMoving ?? false,
        });
      }
      playersRef.current = next;
    };

    const onMoved = ({ roomId: rid, userId, x, y, dir }) => {
      if (String(rid) !== String(roomId)) return;
      const uid = String(userId);
      const next = new Map(playersRef.current);
      const prev = next.get(uid) || {};
      next.set(uid, {
        ...prev,
        x: x ?? prev.x,
        y: y ?? prev.y,
        dir: dir ?? prev.dir,
        speed: prev.speed ?? 220,
        frameIndex: prev.frameIndex ?? 0,
        frameTimer: prev.frameTimer ?? 0,
        isMoving: prev.isMoving ?? false,
      });
      playersRef.current = next;
    };

    const onLeft = ({ roomId: rid, userId }) => {
      if (String(rid) !== String(roomId)) return;
      const uid = String(userId);
      const next = new Map(playersRef.current);
      next.delete(uid);
      playersRef.current = next;
    };

    socket.on("presence:state", onState);
    socket.on("presence:moved", onMoved);
    socket.on("presence:left", onLeft);

    return () => {
      socket.off("presence:state", onState);
      socket.off("presence:moved", onMoved);
      socket.off("presence:left", onLeft);
      // optional:
      // socket.emit("presence:leave", { roomId: String(roomId) });
    };
  }, [socket, viewerId, roomId]);

  // selected item callback (optional)
  useEffect(() => {
    onSelectedChange?.(selectedItemId);
  }, [selectedItemId, onSelectedChange]);

  // Keyboard (movement for owner + visitors; item scaling only for owner)
  useEffect(() => {
    if (!canMove) return;

    const down = (e) => {
      if (e.repeat) return;

      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = true;
      if (k === "a") keysRef.current.a = true;
      if (k === "s") keysRef.current.s = true;
      if (k === "d") keysRef.current.d = true;

      // item scaling only for owner
      if (!canEditItems) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        keysRef.current.up = true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        keysRef.current.down = true;
      }
    };

    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = false;
      if (k === "a") keysRef.current.a = false;
      if (k === "s") keysRef.current.s = false;
      if (k === "d") keysRef.current.d = false;

      if (!canEditItems) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        keysRef.current.up = false;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        keysRef.current.down = false;
      }
    };

    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [canMove, canEditItems]);

  // Pointer events (owner only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
    };

    const onDown = (e) => {
      if (!canEditItems) return;
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
      if (!canEditItems) return;

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
      if (!canEditItems) return;

      const id = dragRef.current.draggingId;
      dragRef.current.draggingId = null;
      if (!id) return;

      const item = worldRef.current.items.find((it) => it.id === id);
      if (!item) return;

      await patch(`/api/room/item/${id}`, { x: item.x, y: item.y, scale: item.scale });
    };

    const onWheel = (e) => {
      if (!canEditItems) return;
      if (!selectedItemId) return;

      e.preventDefault();
      const item = worldRef.current.items.find((it) => it.id === selectedItemId);
      if (!item) return;

      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.06 : 0.94;
      item.scale = clamp(item.scale * factor, 0.25, 3.0);
      scheduleSaveItem(selectedItemId);
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
  }, [canEditItems, assetsRef, catalogByKey, selectedItemId]);

  // Render loop
  useEffect(() => {
    if (!assetsReady) return;

    let raf = 0;
    let lastT = performance.now();

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      updateViewTransform();
      if (canMove) update(dt);
      render();
    };

    const update = (dt) => {
      const w = worldRef.current;
      const me = getMyBeaver();
      if (!me) return;

      const keys = keysRef.current;

      // ---- ArrowUp/ArrowDown scale selected item (owner only) ----
      if (canEditItems && selectedItemId && (keys.up || keys.down)) {
        const item = w.items.find((it) => it.id === selectedItemId);
        if (item) {
          const scaleSpeed = 1.4;
          const dir = keys.up ? 1 : -1;
          const mult = Math.exp(dir * scaleSpeed * dt);
          item.scale = clamp(item.scale * mult, 0.25, 3.0);
          scheduleSaveItem(selectedItemId);
        }
      }

      // ---- WASD movement (everyone) ----
      let vx = 0,
        vy = 0;
      if (keys.w) vy -= 1;
      if (keys.s) vy += 1;
      if (keys.a) vx -= 1;
      if (keys.d) vx += 1;

      const moving = vx !== 0 || vy !== 0;
      me.isMoving = moving;

      if (moving) {
        persistRef.current.sentStop = false;

        const mag = Math.hypot(vx, vy);
        vx /= mag;
        vy /= mag;

        if (Math.abs(vx) > Math.abs(vy)) me.dir = vx > 0 ? "right" : "left";
        else me.dir = vy > 0 ? "down" : "up";

        me.x = clamp(me.x + vx * me.speed * dt, 0, ROOM_W);

        const topY = floorTopY(me.x) + FLOOR_MARGIN;
        me.y = clamp(me.y + vy * me.speed * dt, topY, ROOM_H);

        me.frameIndex = 0;
        me.frameTimer = 0;
      } else {
        me.frameIndex = 0;
        me.frameTimer = 0;
      }

      // Keep our Map updated (in case getMyBeaver returned object not referenced)
      playersRef.current.set(String(viewerId), me);

      // -------------------------
      // NEW: presence broadcast (everyone), throttled
      // -------------------------
      if (socket && roomId && viewerId) {
        const now = performance.now();
        const SEND_EVERY_MS = 1000 / 15; // ~15 Hz max
        const POS_EPS = 1.5;

        const nx = me.x,
          ny = me.y,
          nd = me.dir;

        const movedEnough =
          netRef.current.lastX == null ||
          Math.hypot(nx - netRef.current.lastX, ny - netRef.current.lastY) > POS_EPS ||
          nd !== netRef.current.lastDir;

        if (movedEnough && now - netRef.current.lastSentAt >= SEND_EVERY_MS) {
          netRef.current.lastSentAt = now;
          netRef.current.lastX = nx;
          netRef.current.lastY = ny;
          netRef.current.lastDir = nd;

          socket.emit("presence:move", { roomId: String(roomId), x: nx, y: ny, dir: nd });
        }
      }

      // -------------------------
      // Persist owner beaver to Mongo occasionally (owner only)
      // -------------------------
      if (canEditItems) {
        if (moving) {
          persistRef.current.t += dt;
          if (persistRef.current.t >= 0.5) {
            persistRef.current.t = 0;
            patch("/api/room/beaver", { x: me.x, y: me.y, dir: me.dir }).catch(console.error);
          }
        } else {
          if (!persistRef.current.sentStop) {
            persistRef.current.sentStop = true;
            persistRef.current.t = 0;
            patch("/api/room/beaver", { x: me.x, y: me.y, dir: me.dir }).catch(console.error);
          }
        }
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

      if (SHOW_FLOOR_DEBUG) {
        ctx.beginPath();
        let p = worldToScreen(FLOOR_LEFT.x, FLOOR_LEFT.y);
        ctx.moveTo(p.x, p.y);
        p = worldToScreen(FLOOR_CORNER.x, FLOOR_CORNER.y);
        ctx.lineTo(p.x, p.y);
        p = worldToScreen(FLOOR_RIGHT.x, FLOOR_RIGHT.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = "rgba(255,0,0,0.7)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      const items = worldRef.current.items;

      // drawables: items + all beavers, sorted by feet y
      const beavers = Array.from(playersRef.current.entries()).map(([uid, b]) => ({
        uid,
        b,
      }));

      const drawables = [
        ...items.map((it) => ({ type: "item", y: it.y, it })),
        ...beavers.map(({ uid, b }) => ({ type: "beaver", y: b.y, uid, it: b })),
      ].sort((a, b) => a.y - b.y);

      for (const d of drawables) {
        if (d.type === "item") {
          const it = d.it;
          const def = catalogByKey?.get(it.itemKey);
          const img = def ? imgs[def.imageKey] : null;
          if (!img) continue;

          const { x, y } = worldToScreen(it.x, it.y);
          const s = viewRef.current.scale * it.scale;
          const wpx = img.width * s;
          const hpx = img.height * s;

          ctx.drawImage(img, x - wpx / 2, y - hpx, wpx, hpx);

          if (canEditItems && it.id === selectedItemId) {
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.strokeRect(x - wpx / 2, y - hpx, wpx, hpx);
          }
        } else {
          const b = d.it;
          const uid = String(d.uid);
          const isSelf = viewerId && uid === String(viewerId);

          const sheet = imgs.beaverSheet;
          if (!sheet) continue;

          const { sx, sy, sw, sh } = getBeaverFrameRect(b.dir, b.frameIndex);
          const { x, y } = worldToScreen(b.x, b.y);

          const spriteScale = viewRef.current.scale * 1.0;
          const dw = sw * spriteScale;
          const dh = sh * spriteScale;

          ctx.save();
          if (!isSelf) ctx.globalAlpha = 0.92;

          // y is feet position (anchor)
          ctx.drawImage(sheet, sx, sy, sw, sh, x - dw / 2, y - dh, dw, dh);

          ctx.restore();
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    assetsReady,
    dpr,
    canMove,
    canEditItems,
    assetsRef,
    catalogByKey,
    selectedItemId,
    socket,
    roomId,
    viewerId,
  ]);

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
