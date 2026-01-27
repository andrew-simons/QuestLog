import React, { useState, useEffect, createContext, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import "../utilities.css";
import "./SketchTheme.css";

import { socket } from "../client-socket";
import { get, post } from "../utilities";

import NavBar from "./modules/NavBar";
import Login from "./pages/Login";
import LoadingGate from "./pages/LoadingGate"; // make this component

export const UserContext = createContext(null);

const App = () => {
  const navigate = useNavigate();

  // null = not logged in, string = logged in
  const [userId, setUserId] = useState(null);

  // show splash while checking session
  const [authLoading, setAuthLoading] = useState(true);

  // Check existing session once on page load
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const user = await get("/api/whoami");
        if (!alive) return;
        setUserId(user?._id ?? null);
      } catch (e) {
        if (!alive) return;
        setUserId(null);
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

      setUserId(user._id);

      try {
        await post("/api/initsocket", { socketid: socket.id });
      } catch {}

      navigate("/home", { replace: true });
    } catch (err) {
      console.log("login_code failed:", err);
    }
  };

  const handleLogout = async () => {
    setUserId(null);
    try {
      await post("/api/logout");
    } catch {}
    navigate("/", { replace: true });
  };

  const authContextValue = useMemo(
    () => ({ userId, handleLogin, handleLogout, authLoading }),
    [userId, authLoading]
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
  if (!userId) {
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
        <Outlet />
      </div>
    </UserContext.Provider>
  );
};

export default App;
