import React from "react";

import "../../utilities.css";
import { UserContext } from "../App";
import SingleQuestBlock from "./SingleQuestBlock";
import EmptyQuestBlock from "./EmptyQuestBlock";

const QuestCard = () => {
  return (
    <>
      <h1>QuestCard</h1>
      <SingleQuestBlock />
      <SingleQuestBlock />
      <EmptyQuestBlock />
    </>
  );
};

export default QuestCard;
