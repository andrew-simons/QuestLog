import React, { useEffect, useMemo, useState } from "react";
import { get, post, del } from "../../utilities";
import RoomCanvas from "../modules/RoomCanvas";
import { socket } from "../../client-socket"; // whatever your socket import is
import RoomSidebar from "../modules/RoomSideBar";

export default function Home() {
  const [selectedItemId, setSelectedItemId] = useState(null);

  const [coins, setCoins] = useState(0);
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [reloadToken, setReloadToken] = useState(0);

  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const ownedQty = (itemKey) => inventory.find((r) => r.itemKey === itemKey)?.qty || 0;

  useEffect(() => {
    async function load() {
      const me = await get("/api/whoami");
      if (!me?._id) return;
      setCoins(me.coins ?? 0);

      const [items, inv] = await Promise.all([get("/api/items"), get("/api/inventory")]);
      setCatalog(items || []);
      setInventory(inv || []);
    }
    load().catch(console.error);
  }, []);

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

    // NOTE: you don't manually push into worldRef anymore.
    // The server can broadcast "room:update" and RoomCanvas can reload or apply update.
    // Easiest: server broadcasts the whole room state after place/remove/move.
  }

  async function removeSelected() {
    if (!selectedItemId) return;

    const resp = await del(`/api/room/remove/${selectedItemId}`);
    if (resp?.error) return console.log(resp.error);

    setSelectedItemId(null);
    setInventory((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.itemKey === resp.itemKey);
      if (idx >= 0) next[idx] = { ...next[idx], qty: resp.inventoryQty };
      else next.push({ itemKey: resp.itemKey, qty: resp.inventoryQty });
      return next;
    });
    setReloadToken((t) => t + 1);
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <RoomCanvas
        mode="owner"
        reloadToken={reloadToken}
        ownerId={null}
        catalogByKey={catalogByKey}
        socket={socket}
        onSelectedChange={setSelectedItemId}
      />

      <RoomSidebar
        coins={coins}
        catalog={catalog}
        inventory={inventory}
        selectedItemId={selectedItemId}
        onBuy={buyItem}
        onPlace={placeItem}
        onRemoveSelected={removeSelected}
      />
    </div>
  );
}
