import React, { useState, useEffect, createContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import jwt_decode from "jwt-decode";

import "../utilities.css";
import "./SketchTheme.css";

import { socket } from "../client-socket";
import { get, post } from "../utilities";

import NavBar from "./modules/NavBar";
import Login from "./pages/Login";

export const UserContext = createContext(null);

const App = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(undefined);

  useEffect(() => {
    get("/api/whoami").then((user) => {
      if (user?._id) setUserId(user._id);
    });
  }, []);

  /**
   * handleLogin can be called in TWO ways:
   *  1) GoogleLogin -> handleLogin({ credential: "..." })
   *  2) Custom button -> handleLogin("...")  (raw ID token)
   *
   * Both end up POSTing { token } to /api/login, which your backend already expects.
   */
  const handleLogin = (arg) => {
    const userToken = typeof arg === "string" ? arg : arg?.credential;

    if (!userToken) {
      console.log("Login failed: missing Google credential/token", arg);
      return;
    }

    // optional: log name for debugging (safe)
    try {
      const decoded = jwt_decode(userToken);
      console.log(`Logged in as ${decoded?.name || "(unknown)"}`);
    } catch (e) {
      console.log("Could not decode token (still may be valid):", e);
    }

    // IMPORTANT: only navigate after server session is established
    post("/api/login", { token: userToken })
      .then((user) => {
        setUserId(user._id);
        post("/api/initsocket", { socketid: socket.id });
        navigate("/home", { replace: true });
      })
      .catch((err) => {
        console.log("Server login failed:", err);
      });
  };

  const handleLogout = () => {
    setUserId(undefined);
    post("/api/logout");
    navigate("/", { replace: true });
  };

  const authContextValue = {
    userId,
    handleLogin, // works for both GoogleLogin + custom token button
    handleLogout,
  };

  if (userId === undefined) {
    return (
      <UserContext.Provider value={authContextValue}>
        <Login />
      </UserContext.Provider>
    );
  }

  return (
    <div className="sketchApp">
      <UserContext.Provider value={authContextValue}>
        <NavBar />
        <Outlet />
      </UserContext.Provider>
    </div>
  );
};

export default App;
