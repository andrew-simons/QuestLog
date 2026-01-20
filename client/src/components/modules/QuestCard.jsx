import React from "react";
import "../../utilities.css";
import SingleQuestBlock from "./SingleQuestBlock";

/**
 * Component to render the quest blocks
 *
 * Proptypes
 * @param {boolean} loading
 * @param {boolean} refreshing
 * @param {Array} currentQuests Array of quest objects
 * @param {(questKey: number) => boolean} isCompletedFor function
 * @param {(questKey: number, isCompleted: boolean) => void} onToggleQuest function
 * @param {number|null} savingKey
 */
const QuestCard = (props) => {
  return (
    <>
      <h5>QuestCard</h5>

      {props.loading ? (
        <p>Loading...</p>
      ) : props.currentQuests.length === 0 ? (
        <p>No current quests yet.</p>
      ) : (
        props.currentQuests.map((quest) => (
          <SingleQuestBlock
            key={quest.questKey}
            quest={quest}
            isCompleted={props.isCompletedFor(quest.questKey)}
            onToggle={(newVal) => props.onToggleQuest(quest.questKey, newVal)}
            saving={props.savingKey === quest.questKey}
          />
        ))
      )}
    </>
  );
};

export default QuestCard;
