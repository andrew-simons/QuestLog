import React, { useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import { post, patch } from "../../utilities";
import "./TutorialOverlay.css";

const STEPS = [
  {
    step: 0,
    route: null,
    title: "Welcome to QuestLog!",
    body: "What’s your beaver’s name?",
  },
  {
    step: 1,
    route: "/home",
    title: (name) => `Welcome to your new home, ${name || "friend"}!`,
    body:
      "This is where your beaver lives! Use WASD to move around. On the right is your inventory and shop. " +
      "Drag furniture to place it, and use the scroll wheel to change its size.",
  },
  {
    step: 2,
    route: "/quests",
    title: "Quests",
    body:
      "Here, you go on quests in real life to earn coins and XP! Today's quests are randomly generated from the 101 things to do at MIT. " +
      "You can also create and complete quests made by friends and others online.",
  },
  {
    step: 3,
    route: "/journal",
    title: "Journal",
    body:
      "After you complete quests, write about your experiences in your journal. " +
      "You can also upload pictures from your adventures!",
  },
  {
    step: 4,
    route: "/friends",
    title: "Social",
    body:
      "Add friends using your friend code. Visit their rooms and walk around with WASD. " +
      "Friends-only quests will show up when they post them!",
  },
];

export default function TutorialOverlay() {
  const { me, setMe, setIsTyping } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const tutorialDone = !!me?.tutorialDone;
  const tutorialStep = Number.isInteger(me?.tutorialStep) ? me.tutorialStep : 0;

  const stepDef = useMemo(() => STEPS.find((s) => s.step === tutorialStep) || null, [tutorialStep]);

  if (!me?._id || tutorialDone || !stepDef) return null;

  const requiredRoute = stepDef.route;
  const onRequiredRoute =
    !requiredRoute ||
    location.pathname === requiredRoute ||
    location.pathname.startsWith(requiredRoute + "/");

  const title = typeof stepDef.title === "function" ? stepDef.title(me?.name) : stepDef.title;

  async function saveTutorial(patchBody) {
    const updated = await patch("/api/me/onboarding", patchBody);
    setMe(updated);
    return updated;
  }

  async function handleSkip() {
    try {
      setSaving(true);
      setErr("");
      await saveTutorial({ tutorialDone: true });
    } catch {
      setErr("Could not skip tutorial.");
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    try {
      setSaving(true);
      setErr("");

      const lastStep = STEPS[STEPS.length - 1].step;

      // If we're already at the last step, finish.
      if (tutorialStep >= lastStep) {
        await saveTutorial({ tutorialDone: true });
        return;
      }

      // Advance to the next step first.
      const nextStep = tutorialStep + 1;
      const updated = await saveTutorial({ tutorialStep: nextStep });

      // Then auto-navigate to the next step's route if needed.
      const nextDef = STEPS.find((s) => s.step === nextStep);
      if (nextDef?.route) {
        const nextRoute = nextDef.route;
        const onNextRoute =
          location.pathname === nextRoute || location.pathname.startsWith(nextRoute + "/");

        if (!onNextRoute) {
          navigate(nextRoute);
        }
      }
    } catch (e) {
      console.log(e);
      setErr("Could not advance tutorial.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNameAndContinue() {
    const trimmed = nameDraft.trim();

    if (!trimmed) return setErr("Please enter a name.");
    if (trimmed.length > 14) return setErr("Name must be 14 characters or fewer.");

    try {
      setSaving(true);
      setErr("");

      const updatedUser = await post("/api/me/name", { name: trimmed });
      setMe(updatedUser);

      await saveTutorial({ tutorialStep: 1 });
      if (location.pathname !== "/home") navigate("/home", { replace: true });
    } catch {
      setErr("Could not save name.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tutorial-backdrop">
      <div className="tutorial-card">
        <div className="tutorial-header">
          <div>
            <div className="tutorial-kicker">QuestLog Tutorial</div>
            <h2 className="tutorial-title">{title}</h2>
          </div>

          <button className="tutorial-skip" onClick={handleSkip} disabled={saving}>
            Skip
          </button>
        </div>
        <div className="tutorial-divider" />

        <p className="tutorial-body">{stepDef.body}</p>

        {tutorialStep === 0 && (
          <div className="tutorial-inputBlock">
            <label>Beaver name</label>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="e.g., Maple"
              maxLength={14}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setIsTyping(false)}
              disabled={saving}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNameAndContinue()}
            />
            <div className="tutorial-hint">14 characters max.</div>
          </div>
        )}

        {requiredRoute && !onRequiredRoute && (
          <div className="tutorial-routeHint">
            To continue, go to <b>{requiredRoute}</b>.
            <button onClick={() => navigate(requiredRoute)}>Go</button>
          </div>
        )}

        {err && <div className="tutorial-error">{err}</div>}

        <div className="tutorial-footer">
          <div className="tutorial-progress">
            Step {tutorialStep + 1} / {STEPS.length}
          </div>

          {tutorialStep === 0 ? (
            <button
              className="tutorial-primary"
              onClick={handleSaveNameAndContinue}
              disabled={saving}
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          ) : (
            <button className="tutorial-primary" onClick={handleNext} disabled={saving}>
              {saving
                ? "Saving..."
                : tutorialStep === STEPS[STEPS.length - 1].step
                  ? "Finish"
                  : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
