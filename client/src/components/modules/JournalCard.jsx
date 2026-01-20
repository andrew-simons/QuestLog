import React from "react";

import "../../utilities.css";
import { UserContext } from "../App";

import SingleJournalBlock from "./SingleJournalBlock";


/**
 * Component to render a the journal quest blocks
 *
 * Proptypes`
 * @param {boolean} loading
 * @param {boolean} refreshing
 * @param {Array} currentQuests Array of 3 quest objects
 */
const JournalCard = (props) => {
  return (
    <>
      <h5>JournalCard</h5>
      {props.loading ? (
        <p>Loading...</p>
      ) : props.currentQuests.length === 0 ? (
        <p>No current journals yet.</p>
      ) : (
        props.currentQuests.map((quest) => <SingleJournalBlock key={quest.questKey} quest={quest} />)
      )}
    </>
  );
};

export default JournalCard;
