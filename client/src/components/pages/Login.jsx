import React, { useContext, useMemo } from "react";

import { useGoogleLogin } from "@react-oauth/google";

import "../../utilities.css";
import { UserContext } from "../App";
import "./Login.css";

// --- Mascot is isolated + memoized so Login card isn't constantly re-rendering ---
const RotatingMascot = React.memo(function RotatingMascot({ images, intervalMs = 2200 }) {
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [animate, setAnimate] = React.useState(true);

  React.useEffect(() => {
    if (paused) return;

    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % images.length);
      setAnimate(false);
      requestAnimationFrame(() => setAnimate(true));
    }, intervalMs);

    return () => window.clearInterval(t);
  }, [paused, images.length, intervalMs]);

  React.useEffect(() => {
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [images]);

  return (
    <img
      src={images[idx]}
      alt="Beaver mascot"
      className={`beaver-img ${animate ? "beaver-swap" : ""}`}
      draggable={false}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    />
  );
});

/**
 * CustomGoogleButton:
 * Uses Google Identity Services to obtain an ID token (JWT) in `resp.credential`,
 * which is exactly what your backend verifies with verifyIdToken.
 */
const CustomGoogleButton = React.memo(function CustomGoogleButton({ onCode }) {
  const [loading, setLoading] = React.useState(false);

  const login = useGoogleLogin({
    flow: "auth-code",
    onSuccess: ({ code }) => {
      setLoading(false);
      onCode(code);
    },
    onError: (err) => {
      setLoading(false);
      console.log("Google login error:", err);
    },
  });

  return (
    <button
      className="quest-login-btn"
      onClick={() => {
        setLoading(true);
        login();
      }}
      disabled={loading}
    >
      {loading ? "Opening Google..." : "Begin Quest"}
    </button>
  );
});

const Login = () => {
  const { handleLogin } = useContext(UserContext);

  const beavers = useMemo(
    () => [
      "/img/login_beavers/beaver1.PNG",
      "/img/login_beavers/beaver2.PNG",
      "/img/login_beavers/beaver3.PNG",
      "/img/login_beavers/beaver4.PNG",
    ],
    []
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="beaver-wrap">
          <RotatingMascot images={beavers} intervalMs={2200} />
        </div>

        <h1 className="title">QUESTLOG</h1>
        <p className="subtitle">small quests, real growth</p>

        <div className="signin-block">
          <div className="signin-label">Login to get started</div>

          <CustomGoogleButton onCode={handleLogin} />
        </div>
      </div>
    </div>
  );
};

export default Login;