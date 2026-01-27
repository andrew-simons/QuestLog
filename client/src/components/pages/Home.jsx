import React, { useEffect, useMemo, useState } from "react";
import { get, post, del } from "../../utilities";
import RoomCanvas from "../modules/RoomCanvas";
import { socket } from "../../client-socket";
import RoomSidebar from "../modules/RoomSideBar";

export default function Home() {
  const [selected, setSelected] = useState(null);

  const [coins, setCoins] = useState(0);
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [viewer, setViewer] = useState(null); // whoami
  const [roomOwner, setRoomOwner] = useState(null); // same as viewer on Home

  const [placedCounts, setPlacedCounts] = useState(new Map());
  const [reloadToken, setReloadToken] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const ownedQty = (itemKey) => inventory.find((r) => r.itemKey === itemKey)?.qty || 0;

  const isOwner = true; // Home is always your room

  async function refreshPlacedCounts() {
    const room = await get("/api/room");
    const m = new Map();
    for (const p of room?.placedItems || []) {
      m.set(p.itemKey, (m.get(p.itemKey) || 0) + 1);
    }
    setPlacedCounts(m);

    // if your backend returns { owner }, use that. Otherwise fallback to viewer.
    if (room?.owner) setRoomOwner(room.owner);
  }

  useEffect(() => {
    async function load() {
      const me = await get("/api/whoami");
      if (!me?._id) return;

      setViewer(me);
      setCoins(me.coins ?? 0);
      setRoomOwner({ _id: me._id, name: me.name || "You" });

      const [items, inv] = await Promise.all([get("/api/items"), get("/api/inventory")]);
      setCatalog(items || []);
      setInventory(inv || []);

      await refreshPlacedCounts();
    }
    load().catch(console.error);
  }, []);

  async function saveMyName(newName) {
    const resp = await post("/api/me/name", { name: newName });
    if (resp?.error) return console.log(resp.error);

    // keep header correct + keep whoami-ish state consistent
    setViewer((v) => (v ? { ...v, name: resp.name } : v));
    setRoomOwner((o) => (o ? { ...o, name: resp.name } : o));
  }

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
    const qty = ownedQty(itemKey);
    if (qty <= 0) return;

    const def = catalogByKey.get(itemKey);
    if (!def) return;

    const resp = await post("/api/room/place", {
      itemKey,
      x: 500,
      y: 520,
      scale: def.defaultScale ?? 1.0,
    });
    if (resp?.error) return console.log(resp.error);

    setInventory((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.itemKey === itemKey);
      if (idx >= 0) next[idx] = { ...next[idx], qty: resp.inventoryQty };
      return next;
    });

    setReloadToken((t) => t + 1);
    await refreshPlacedCounts();
  }

  async function removeSelected() {
    if (!selected?.id) return;

    const resp = await del(`/api/room/remove/${selected.id}`);
    if (resp?.error) return console.log(resp.error);

    setSelected(null);

    setInventory((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.itemKey === resp.itemKey);
      if (idx >= 0) next[idx] = { ...next[idx], qty: resp.inventoryQty };
      else next.push({ itemKey: resp.itemKey, qty: resp.inventoryQty });
      return next;
    });

    setReloadToken((t) => t + 1);
    await refreshPlacedCounts();
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <RoomCanvas
        mode="owner"
        viewerId={viewer?._id}
        roomId={viewer?._id}
        ownerId={viewer?._id}
        reloadToken={reloadToken}
        catalogByKey={catalogByKey}
        socket={socket}
        onSelectedChange={setSelected}
        disableInput={isTyping}
      />

      <RoomSidebar
        coins={coins}
        catalog={catalog}
        inventory={inventory}
        placedCounts={placedCounts}
        selectedItemId={selected?.id || null}
        selectedItemKey={selected?.itemKey || null}
        roomOwnerName={roomOwner?.name}
        isOwner={true}
        onSaveMyName={saveMyName}
        onBuy={buyItem}
        onPlace={placeItem}
        onRemoveSelected={removeSelected}
        setTyping={setIsTyping}
      />
    </div>
  );
}
