import React from "react";
import "../../utilities.css";

const SingleQuestBlock = (props) => {
  const { quest, isCompleted, onToggle, saving } = props;

  return (
    <div className={`questRow ${isCompleted ? "done" : ""}`}>
      <div className="questMain">
        <h3 className="questTitle">{quest.title}</h3>
        <div className="questMeta">
          <span className="metaChip">Rarity: {quest.rarity}</span>
          <span className="metaChip">XP: {quest.xpReward}</span>
        </div>
      </div>

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
  );
};

export default SingleQuestBlock;
