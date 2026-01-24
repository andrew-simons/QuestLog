import React, { useEffect, useMemo, useRef, useState } from "react";

import { get, post, patch, del } from "../../utilities";

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
      roomBg: "/img/room.png",
      beaverSheet: "/img/beaver.png", // single 64x64 image for now    // sprite sheet
      chair: "/img/items/chair.png",
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

  // Sidebar tab
  const [panelTab, setPanelTab] = useState("inventory"); // "inventory" | "shop"

  // Data to load from backend
  const [coins, setCoins] = useState(0);
  const [catalog, setCatalog] = useState([]); // from GET /api/items
  const [inventory, setInventory] = useState([]); // from GET /api/inventory
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpToNext, setXpToNext] = useState(100); // simple for now

  // Fast lookup: itemKey -> item definition
  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const ownedQty = (itemKey) => inventory.find((r) => r.itemKey === itemKey)?.qty || 0;

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

  // load room + catalog + inventory when Home
  useEffect(() => {
    async function load() {
      const me = await get("/api/whoami");
      if (!me?._id) return; // not logged in
      setCoins(me.coins ?? 0);

      const [items, inv, room] = await Promise.all([
        get("/api/items"),
        get("/api/inventory"),
        get("/api/room"),
      ]);

      setCatalog(items || []);
      setInventory(inv || []);

      // Room -> canvas world
      worldRef.current.items = (room?.placedItems || []).map((p) => ({
        id: p.instanceId, // IMPORTANT: use instanceId as your canvas id
        itemKey: p.itemKey, // we’ll render by looking up imageKey from catalog
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

    load().catch((e) => console.error(e));
  }, []);

  // loads user xp and level
  useEffect(() => {
    async function loadStats() {
      try {
        // replace with your get(...) helper if you have one
        const res = await fetch("/api/user/stats");
        if (!res.ok) return;
        const data = await res.json(); // { level, xp, xpToNext }
        setLevel(data.level ?? 1);
        setXp(data.xp ?? 0);
        setXpToNext(data.xpToNext ?? 100);
      } catch (e) {
        console.log("Failed to load stats", e);
      }
    }
    loadStats();
  }, []);

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
        let img = null;
        if (item.imgKey) img = imgs[item.imgKey];
        else {
          const def = catalogByKey.get(item.itemKey);
          if (def) img = imgs[def.imageKey];
        }
        if (!img) continue;

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

    const onUp = async () => {
      const id = dragRef.current.draggingId;
      dragRef.current.draggingId = null;

      if (!id) return;

      const item = worldRef.current.items.find((it) => it.id === id);
      if (!item) return;

      await patch(`/api/room/item/${id}`, {
        x: item.x,
        y: item.y,
        scale: item.scale,
      });
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
  }, [assetsRef, selectedItemId, catalogByKey]);

  // allow buy + place + persist drag
  async function buyItem(itemKey) {
    const resp = await post("/api/shop/buy", { itemKey });
    if (resp?.error) return console.log(resp.error);

    setCoins(resp.coins);

    setInventory((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((r) => r.itemKey === itemKey);
      if (idx >= 0) copy[idx] = { ...copy[idx], qty: resp.qty };
      else copy.push({ itemKey, qty: resp.qty });
      return copy;
    });
  }

  async function placeItem(itemKey) {
    const def = catalogByKey.get(itemKey);
    if (!def) return;

    // prevent placing if you don't have any left "in hand"
    const qty = ownedQty(itemKey);
    if (qty <= 0) return;

    // prevent placing duplicates for maxOwned=1 items
    const alreadyPlaced = worldRef.current.items.some((it) => it.itemKey === itemKey);
    if (def.maxOwned === 1 && alreadyPlaced) return;

    const x = 500;
    const y = 520;
    const scale = def.defaultScale ?? 1.0;

    const resp = await post("/api/room/place", { itemKey, x, y, scale });
    if (resp?.error) return console.log(resp.error);

    const placed = resp.placed;

    // update inventory qty locally (server is source of truth)
    setInventory((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.itemKey === itemKey);
      if (idx >= 0) next[idx] = { ...next[idx], qty: resp.inventoryQty };
      return next;
    });

    // add placed instance to world
    worldRef.current.items.push({
      id: placed.instanceId,
      itemKey: placed.itemKey,
      x: placed.x,
      y: placed.y,
      scale: placed.scale ?? scale,
    });
  }

  // remove item function
  async function removeSelected() {
    if (!selectedItemId) return;

    const resp = await del(`/api/room/remove/${selectedItemId}`);
    if (resp?.error) return console.log(resp.error);

    const { itemKey, inventoryQty } = resp;

    // remove from world
    worldRef.current.items = worldRef.current.items.filter((it) => it.id !== selectedItemId);
    setSelectedItemId(null);

    // refund inventory qty locally
    setInventory((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.itemKey === itemKey);
      if (idx >= 0) next[idx] = { ...next[idx], qty: inventoryQty };
      else next.push({ itemKey, qty: inventoryQty });
      return next;
    });
  }

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
          let img = null;
          if (it.imgKey) img = imgs[it.imgKey];
          else {
            const def = catalogByKey.get(it.itemKey);
            if (def) img = imgs[def.imageKey];
          }
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
  }, [assetsReady, dpr, selectedItemId, assetsRef, catalogByKey]);

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
      <div style={{ width: 280, borderLeft: "1px solid #ddd", padding: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Andrew’s Beaver</h3>

          <div style={{ fontSize: 14, marginBottom: 8 }}>
            <div>
              <b>Level:</b> {level}
            </div>
            <div>
              <b>XP:</b> {xp} / {xpToNext}
            </div>
          </div>

          <div style={{ height: 10, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.floor((xp / xpToNext) * 100)}%`,
                background: "#999",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPanelTab("inventory")} disabled={panelTab === "inventory"}>
              Inventory
            </button>
            <button onClick={() => setPanelTab("shop")} disabled={panelTab === "shop"}>
              Shop
            </button>
          </div>

          <div style={{ fontSize: 13 }}>
            <b>{coins}</b> coins
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div>
              <b>Selected:</b> {selectedItemId || "None"}
            </div>

            <button
              disabled={!selectedItemId}
              onClick={removeSelected}
              style={{
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: selectedItemId ? "#fff" : "#f5f5f5",
                cursor: selectedItemId ? "pointer" : "not-allowed",
                fontSize: 12,
              }}
              title={selectedItemId ? "Remove selected item from room" : "Select an item to remove"}
            >
              Remove
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {panelTab === "inventory" ? (
            <InventoryPanel inventory={inventory} catalogByKey={catalogByKey} onPlace={placeItem} />
          ) : (
            <ShopPanel catalog={catalog} coins={coins} ownedQty={ownedQty} onBuy={buyItem} />
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryPanel({ inventory, catalogByKey, onPlace }) {
  if (!inventory.length) return <div style={{ opacity: 0.8 }}>No items owned yet.</div>;

  return (
    <div>
      {inventory.map((row) => {
        const def = catalogByKey.get(row.itemKey);
        return (
          <div
            key={row.itemKey}
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
          >
            <div style={{ flex: 1 }}>
              <div>
                <b>{def?.name ?? row.itemKey}</b>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>qty: {row.qty}</div>
            </div>
            <button disabled={row.qty <= 0} onClick={() => onPlace(row.itemKey)}>
              Place
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ShopPanel({ catalog, coins, ownedQty, onBuy }) {
  if (!catalog.length) return <div style={{ opacity: 0.8 }}>Loading shop...</div>;

  return (
    <div>
      {catalog.map((it) => {
        const owned = ownedQty(it.key);
        const maxed = owned >= (it.maxOwned ?? 1);
        const canAfford = coins >= (it.priceCoins ?? 0);

        return (
          <div
            key={it.key}
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
          >
            <div style={{ flex: 1 }}>
              <div>
                <b>{it.name}</b>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {it.priceCoins} coins · owned {owned}/{it.maxOwned ?? 1}
              </div>
            </div>

            <button disabled={maxed || !canAfford} onClick={() => onBuy(it.key)}>
              Buy
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Home;
