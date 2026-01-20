import React from "react";
import SingleJournalBlock from "./SingleJournalBlock";

const JournalCard = (props) => {
  if (props.loading) return <p>Loading...</p>;
  if (!props.completedQuests || props.completedQuests.length === 0) {
    return <p>No completed quests yet.</p>;
  }

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
      {props.completedQuests.map((quest) => (
        <SingleJournalBlock
          key={quest.questKey}
          quest={quest}
          journal={props.getJournalFor(quest.questKey)}
          onSave={(updates) => props.onSaveJournal(quest.questKey, updates)}
          saving={props.savingKey === quest.questKey}
        />
      ))}
    </div>
  );
};

export default JournalCard;
