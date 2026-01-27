import React from "react";
import "./LoadingGate.css";

export default function LoadingGate() {
  return (
    <div className="gate">
      <div className="gateCard">
        <div className="gateSpinner" aria-hidden="true" />
        <div className="gateTitle">QuestLog</div>
        <div className="gateSub">loading your room...</div>
      </div>
    </div>
  );
}
