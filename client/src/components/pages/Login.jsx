import React, { useContext, useMemo } from "react";

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
const CustomGoogleButton = React.memo(function CustomGoogleButton({ onToken }) {
  const CLIENT_ID = "58023725513-8571eqs79mlmqbgfi4ngf5gprsn3pqtl.apps.googleusercontent.com";

  const [ready, setReady] = React.useState(false);
  const [errMsg, setErrMsg] = React.useState("");
  const initedRef = React.useRef(false);

  React.useEffect(() => {
    if (initedRef.current) return;

    const tryInit = () => {
      const gis = window.google?.accounts?.id;
      if (!gis) return false;

      gis.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          if (resp?.credential) onToken(resp.credential);
          else setErrMsg("Google did not return a credential.");
        },

        // These reduce “auto” behaviors that can trigger FedCM aborts:
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      initedRef.current = true;
      setReady(true);
      return true;
    };

    if (tryInit()) return;

    const t = window.setInterval(() => {
      if (tryInit()) window.clearInterval(t);
    }, 50);

    return () => window.clearInterval(t);
  }, [onToken]);

  const begin = () => {
    setErrMsg("");
    const gis = window.google?.accounts?.id;
    if (!gis) {
      setErrMsg("Google sign-in is still loading. Try again in a second.");
      return;
    }

    /**
     * IMPORTANT:
     * - `prompt()` is One Tap (FedCM) and can AbortError.
     * - For a click button, we use `prompt()` BUT we handle the "not displayed" cases.
     *   On some browsers, One Tap won’t show unless conditions are met.
     *
     * If you want the most bulletproof click sign-in without FedCM,
     * you should switch to OAuth "auth-code flow" (different backend).
     */
    gis.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        // common reasons: third-party cookies / FedCM blocked / not allowed origin
        setErrMsg(`Google sign-in could not open: ${notification.getNotDisplayedReason?.() || ""}`);
      } else if (notification.isSkippedMoment()) {
        setErrMsg(`Google sign-in was skipped: ${notification.getSkippedReason?.() || ""}`);
      } else if (notification.isDismissedMoment()) {
        setErrMsg(`Google sign-in was dismissed: ${notification.getDismissedReason?.() || ""}`);
      }
    });
  };

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
      <button className="quest-login-btn" onClick={begin} disabled={!ready}>
        {ready ? "Begin Quest" : "Loading..."}
      </button>

      {errMsg ? (
        <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 300 }}>
          {errMsg}
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Try: allow third-party sign-in, disable privacy extensions, or use Chrome.
          </div>
        </div>
      ) : null}
    </div>
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

          {/* Custom button returns an ID token string to handleLogin */}
          <CustomGoogleButton onToken={handleLogin} />
        </div>
      </div>
    </div>
  );
};

export default Login;
