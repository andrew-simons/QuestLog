import React from "react";
import "../../utilities.css";

/**
 * Props:
 * - quest: { questKey, title, rarity, xpReward }
 * - isCompleted: boolean
 * - onToggle: (newVal: boolean) => void
 * - saving: boolean
 */
const SingleQuestBlock = (props) => {
  const { quest, isCompleted, onToggle, saving } = props;

  return (
    <span>
      <hr />
      <h3>{quest.title}</h3>
      <p>
        Rarity: {quest.rarity}; XP Reward: {quest.xpReward}
      </p>

      <input
        type="checkbox"
        checked={isCompleted}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={saving}
      />
    </span>
  );
};

export default SingleQuestBlock;
