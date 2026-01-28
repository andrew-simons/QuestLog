import React from "react";
import SingleJournalBlock from "./SingleJournalBlock";

const JournalCard = (props) => {
  if (props.loading) {
    return (
      <div className="jrState">
        <div className="jrSpinner" />
        <div>
          <div className="jrStateTitle">Loading your journal…</div>
          <div className="jrStateSub">Fetching completed quests and entries.</div>
        </div>
      </div>
    );
  }

  if (!props.completedQuests || props.completedQuests.length === 0) {
    return (
      <div className="jrEmpty">
        <div className="jrEmptyIcon">📓</div>
        <div className="jrEmptyTitle">No entries yet</div>
        <div className="jrEmptySub">
          Complete a quest, then come back here to write notes and add photos.
        </div>
      </div>
    );
  }

  return (
    <div className="jrList">
      {props.completedQuests.map((item, idx) => {
        const key = `${item.source}:${String(item.id)}`;
        return (
          <div key={key} style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}>
            <SingleJournalBlock
              item={item}
              journal={props.getJournalFor(item)}
              onSave={(updates) => props.onSaveJournal(item, updates)}
              saving={props.savingKey === key}
            />
          </div>
        );
      })}
    </div>
  );
};

export default JournalCard;
