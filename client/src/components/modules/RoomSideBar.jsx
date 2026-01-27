import React, { useMemo, useState } from "react";
import "./RoomSidebar.css";

export default function RoomSidebar({
  coins,
  catalog,
  inventory,
  placedCounts,
  selectedItemId,
  onBuy,
  onPlace,
  onRemoveSelected,
}) {
  const [tab, setTab] = useState("inventory");

  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const ownedQty = (itemKey) => inventory.find((r) => r.itemKey === itemKey)?.qty || 0;

  const resolveItemImage = (it) => {
    if (!it) return null;
    if (it.imageUrl) return it.imageUrl;
    if (it.imageKey) return `/img/items/${it.imageKey}.png`;
    return `/img/items/${it.key}.png`;
  };

  return (
    <aside className="qs-shell">
      <div className="qs-header">
        <div className="qs-header-top">
          <div>
            <h3 className="qs-title">Your Beaver</h3>
          </div>

          <div className="qs-coin-pill">
            <span className="qs-coin-dot" />
            <b>{coins}</b>
            <span>coins</span>
          </div>
        </div>

        <div className="qs-meta">
          <div className="qs-selected">
            <span className="qs-selected-label">Selected</span>
            <span className="qs-selected-value">{selectedItemId || "None"}</span>
          </div>

          <button
            className={`qs-remove ${selectedItemId ? "on" : "off"}`}
            disabled={!selectedItemId}
            onClick={onRemoveSelected}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="qs-tabs">
        <button
          className={`qs-tab ${tab === "inventory" ? "active" : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventory
        </button>
        <button
          className={`qs-tab ${tab === "shop" ? "active" : ""}`}
          onClick={() => setTab("shop")}
        >
          Shop
        </button>
        <div className="qs-tab-indicator" style={{ left: tab === "inventory" ? "6px" : "50%" }} />
      </div>

      <div className="qs-panel">
        {tab === "inventory" ? (
          inventory.length === 0 ? (
            <div className="qs-empty">No items owned yet.</div>
          ) : (
            inventory.map((row) => {
              const def = catalogByKey.get(row.itemKey);
              return (
                <ItemCard
                  key={row.itemKey}
                  name={def?.name ?? row.itemKey}
                  img={resolveItemImage(def || row)}
                  sub={`${row.qty} available`}
                  actionLabel="Place"
                  disabled={row.qty <= 0}
                  onAction={() => onPlace(row.itemKey)}
                />
              );
            })
          )
        ) : (
          catalog.map((it) => {
            const invOwned = ownedQty(it.key);
            const placedOwned = placedCounts?.get(it.key) || 0;
            const ownedTotal = invOwned + placedOwned;

            const max = it.maxOwned ?? 1;
            const canAfford = coins >= it.priceCoins;
            const disabled = ownedTotal >= max || !canAfford;

            return (
              <ItemCard
                key={it.key}
                name={it.name}
                img={resolveItemImage(it)}
                sub={`${it.priceCoins} coins · ${ownedTotal}/${max}`}
                actionLabel="Buy"
                disabled={disabled}
                onAction={() => onBuy(it.key)}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

function ItemCard({ name, img, sub, actionLabel, disabled, onAction }) {
  return (
    <div className="qs-item">
      <div className="qs-thumb">{img ? <img src={img} alt={name} /> : <span>🪵</span>}</div>

      <div className="qs-item-main">
        <div className="qs-item-name">{name}</div>
        <div className="qs-item-sub">{sub}</div>
      </div>

      <button
        className={`qs-primary ${disabled ? "off" : "on"}`}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  );
}
