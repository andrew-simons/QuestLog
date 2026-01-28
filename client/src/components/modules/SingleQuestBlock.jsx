import React from "react";
import "../../utilities.css";

const SingleQuestBlock = (props) => {
  const { quest, isCompleted, onToggle, saving } = props;

  return (
    <div className={`questRow tornCard ${isCompleted ? "done" : ""}`}>
      {/* SVG outline layer (required for torn-outline.svg) */}
      <span className="tornOutline" />

      <div className="tornContent">
        <div className="questLeft">
          <div className="questTopLine">
            <span className={`rarityTag rarity-${String(quest.rarity || "").toLowerCase()}`}>
              {String(quest.rarity || "common").toLowerCase()}
            </span>
            <h3 className="questTitle">{quest.title}</h3>
          </div>

          <div className="questMeta">
            <span className="metaChip">XP: {quest.xpReward}</span>
          </div>
        </div>

        <div className="questRight">
          <label className="checkPill">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={saving}
            />
            <span>{saving ? "Saving…" : isCompleted ? "Done" : "Complete"}</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SingleQuestBlock;
