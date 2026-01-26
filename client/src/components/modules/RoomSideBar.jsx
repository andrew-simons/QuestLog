import React, { useMemo, useState } from "react";

export default function RoomSidebar({
  coins,
  catalog,
  inventory,
  selectedItemId,
  onBuy,
  onPlace,
  onRemoveSelected,
}) {
  const [tab, setTab] = useState("inventory"); // inventory | shop

  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const ownedQty = (itemKey) => inventory.find((r) => r.itemKey === itemKey)?.qty || 0;

  return (
    <div style={{ width: 280, borderLeft: "1px solid #ddd", padding: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Your Beaver</h3>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13 }}>
            <b>{coins}</b> coins
          </div>

          <button
            disabled={!selectedItemId}
            onClick={onRemoveSelected}
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

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          <b>Selected:</b> {selectedItemId || "None"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setTab("inventory")} disabled={tab === "inventory"}>
          Inventory
        </button>
        <button onClick={() => setTab("shop")} disabled={tab === "shop"}>
          Shop
        </button>
      </div>

      {tab === "inventory" ? (
        <InventoryPanel inventory={inventory} catalogByKey={catalogByKey} onPlace={onPlace} />
      ) : (
        <ShopPanel catalog={catalog} coins={coins} ownedQty={ownedQty} onBuy={onBuy} />
      )}
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
