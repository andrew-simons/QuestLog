import React, { useState, useEffect, createContext, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import "../utilities.css";
import "./SketchTheme.css";

import { socket } from "../client-socket";
import { get, post } from "../utilities";

import NavBar from "./modules/NavBar";
import Login from "./pages/Login";
import LoadingGate from "./pages/LoadingGate"; // make this component
import TutorialOverlay from "./modules/TutorialOverlay";

export const UserContext = createContext(null);

const App = () => {
  const navigate = useNavigate();

  // me = null means not logged in; otherwise it's the user object
  const [me, setMe] = useState(null); // full user doc, or null

  // show splash while checking session
  const [authLoading, setAuthLoading] = useState(true);

  // Check existing session once on page load
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const user = await get("/api/whoami");
        if (!alive) return;
        setMe(user?._id ? user : null);
      } catch (e) {
        if (!alive) return;
        setMe(null);
      } finally {
        if (!alive) return;
        setAuthLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /**
   * TOP WAY: handleLogin expects a Google auth CODE (string)
   * and sends it to /api/login_code
   */
  const handleLogin = async (code) => {
    try {
      if (!code) {
        console.log("handleLogin(code) called with no code:", code);
        return;
      }

      const user = await post("/api/login_code", { code });

      setMe(user);

      try {
        await post("/api/initsocket", { socketid: socket.id });
      } catch {}

      navigate("/home", { replace: true });
    } catch (err) {
      console.log("login_code failed:", err);
    }
  };

  const handleLogout = async () => {
    setMe(null);
    try {
      await post("/api/logout");
    } catch {}
    navigate("/", { replace: true });
  };

  const authContextValue = useMemo(
    () => ({
      me,
      setMe,
      userId: me?._id ?? null,
      handleLogin,
      handleLogout,
      authLoading,
    }),
    [me, authLoading]
  );

  // 1) Loading gate FIRST: prevents login flash on refresh
  if (authLoading) {
    return (
      <UserContext.Provider value={authContextValue}>
        <LoadingGate />
      </UserContext.Provider>
    );
  }

  // 2) Not logged in
  if (!me?._id) {
    return (
      <UserContext.Provider value={authContextValue}>
        <Login />
      </UserContext.Provider>
    );
  }

  // 3) Logged in
  return (
    <UserContext.Provider value={authContextValue}>
      <div className="sketchApp appFadeIn">
        <NavBar />
        <TutorialOverlay />
        <Outlet />
      </div>
    </UserContext.Provider>
  );
};

export default App;
