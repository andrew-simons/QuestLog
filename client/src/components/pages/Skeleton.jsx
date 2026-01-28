import React, { useContext, useEffect, useState } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";

import "../../utilities.css";
import "./Skeleton.css";
import { UserContext } from "../App";

const Skeleton = () => {
  const { userId, handleLogin, handleLogout } = useContext(UserContext);

  // Show a loading screen briefly (or until userId resolves)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If userId becomes defined (logged in OR confirmed logged out), stop loading.
    // In your app, userId starts as undefined and becomes either an id or null/falsey.
    if (userId !== undefined) setLoading(false);
  }, [userId]);

  if (loading) {
    return (
      <div className="loadingPage">
        <div className="loadingCard">
          <div className="loadingSpinner" />
          <h1 className="loadingTitle">QuestLog</h1>
          <p className="loadingSub">Loading your world…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loadingPage">
      <div className="loadingCard">
        <h1 className="loadingTitle">QuestLog</h1>

        {userId ? (
          <button
            className="btn"
            onClick={() => {
              googleLogout();
              handleLogout();
            }}
          >
            Logout
          </button>
        ) : (
          <div className="loginWrap">
            <p className="loadingSub">Sign in to continue</p>
            <GoogleLogin onSuccess={handleLogin} onError={(err) => console.log(err)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Skeleton;
