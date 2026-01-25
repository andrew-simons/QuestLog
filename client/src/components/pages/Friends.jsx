import React, { useEffect, useState } from "react";
import "./Friends.css";

export default function Friends() {
  const [me, setMe] = useState(null);
  const [friendCodeInput, setFriendCodeInput] = useState("");

  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingIncoming, setLoadingIncoming] = useState(true);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 1600);
  }

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(String(text));
      showToast(label);
    } catch {
      setError("Copy failed (clipboard permissions). Try selecting manually.");
    }
  }

  async function apiJson(url, opts = {}) {
    const res = await fetch(url, { credentials: "include", ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
    return data;
  }

  async function fetchMe() {
    setLoadingMe(true);
    try {
      const data = await apiJson("/api/whoami");
      setMe(data && data._id ? data : null);
    } catch (e) {
      setError(e.message);
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  }

  async function fetchFriends() {
    setLoadingFriends(true);
    try {
      const data = await apiJson("/api/friends");
      setFriends(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }

  async function fetchIncoming() {
    setLoadingIncoming(true);
    try {
      const data = await apiJson("/api/friends/requests");
      setIncoming(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
      setIncoming([]);
    } finally {
      setLoadingIncoming(false);
    }
  }

  async function refreshAll() {
    setError("");
    await Promise.all([fetchMe(), fetchFriends(), fetchIncoming()]);
    showToast("Refreshed");
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (me?.name) setNameInput(me.name);
  }, [me]);

  const isLoggedOut = !loadingMe && (!me || !me._id);

  async function sendRequestByCode() {
    setError("");

    const code = friendCodeInput.trim().toUpperCase();
    if (!code) return setError("Enter a friend code.");

    try {
      await apiJson("/api/friends/requestByCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode: code }),
      });

      setFriendCodeInput("");
      showToast("Request sent");
      // incoming might not change, but safe
      fetchIncoming();
    } catch (e) {
      setError(e.message);
    }
  }

  async function acceptRequest(requesterId) {
    setError("");
    try {
      await apiJson("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId }),
      });
      showToast("Accepted");
      await fetchIncoming();
      await fetchFriends();
    } catch (e) {
      setError(e.message);
    }
  }

  async function declineRequest(requesterId) {
    setError("");
    try {
      await apiJson("/api/friends/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId }),
      });
      showToast("Declined");
      fetchIncoming();
    } catch (e) {
      setError(e.message);
    }
  }

  function visitRoom(friendUserId) {
    window.location.href = `/room/${friendUserId}`;
  }

  async function saveName() {
    setError("");
    try {
      const updated = await apiJson("/api/me/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });

      setMe(updated);
      setEditingName(false);
      showToast("Name updated");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="friendsPage">
      {toast && <div className="toast">{toast}</div>}

      <header className="friendsHeader">
        <div>
          <h1 className="friendsTitle">Friends</h1>
          <p className="friendsSubtitle">Share your friend code or add someone else’s.</p>
        </div>
        <button className="btn btnGhost" onClick={refreshAll}>
          Refresh
        </button>
      </header>

      {error && (
        <div className="alert alertError">
          <b>Error:</b> {error}
        </div>
      )}

      {isLoggedOut ? (
        <div className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">You’re not logged in</h2>
          </div>
          <p className="muted">Log in on Home first, then come back here.</p>
        </div>
      ) : (
        <div className="grid">
          {/* Your info */}
          <section className="card">
            <div className="cardHeader">
              <h2 className="cardTitle">Your Friend Code</h2>
              <span className="badge">{loadingMe ? "…" : "ready"}</span>
            </div>

            <div className="twoCol">
              <div className="field">
                <div className="fieldLabel">Share this code</div>
                <div className="fieldRow">
                  <div className="pill pillStrong">{me?.friendCode || "—"}</div>
                  <button
                    className="btn"
                    disabled={!me?.friendCode}
                    onClick={() => copyToClipboard(me.friendCode, "Friend code copied")}
                  >
                    Copy
                  </button>
                </div>
                <div className="hint">Anyone with this code can send you a request.</div>
              </div>

              <div className="field">
                <div className="fieldLabel">Your name</div>

                {!editingName ? (
                  <>
                    <div className="fieldRow">
                      <div className="pill">{me?.name || "—"}</div>
                      <button className="btn" onClick={() => setEditingName(true)}>
                        Edit
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="fieldRow">
                      <input
                        className="input"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                      />
                      <button className="btn btnPrimary" onClick={saveName}>
                        Save
                      </button>
                      <button className="btn btnGhost" onClick={() => setEditingName(false)}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                <div className="hint">This is what friends will see.</div>
              </div>
            </div>
          </section>

          {/* Add friend */}
          <section className="card">
            <div className="cardHeader">
              <h2 className="cardTitle">Add a friend</h2>
              <span className="badge">friend code only</span>
            </div>

            <div className="formRow">
              <input
                className="input"
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder="Friend code (e.g., BEAVR7Q)"
              />
              <button className="btn btnPrimary" onClick={sendRequestByCode}>
                Send
              </button>
            </div>

            <div className="hint">Tip: friend codes are case-insensitive.</div>
          </section>

          {/* Incoming */}
          <section className="card">
            <div className="cardHeader">
              <h2 className="cardTitle">Incoming requests</h2>
              <span className="badge">{loadingIncoming ? "…" : `${incoming.length} pending`}</span>
            </div>

            {loadingIncoming ? (
              <p className="muted">Loading…</p>
            ) : incoming.length === 0 ? (
              <p className="muted">No incoming requests.</p>
            ) : (
              <ul className="list">
                {incoming.map((edge) => (
                  <li className="listItem" key={edge._id}>
                    <div className="listMain">
                      <div className="listName">{edge.requester?.name || "Unknown"}</div>
                      <div className="listMeta">
                        Friend code: {edge.requester?.friendCode || "—"}
                      </div>
                    </div>
                    <div className="listActions">
                      <button
                        className="btn btnPrimary"
                        onClick={() => acceptRequest(edge.requester._id)}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btnDanger"
                        onClick={() => declineRequest(edge.requester._id)}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Friends list */}
          <section className="card">
            <div className="cardHeader">
              <h2 className="cardTitle">Your friends</h2>
              <span className="badge">{loadingFriends ? "…" : `${friends.length}`}</span>
            </div>

            {loadingFriends ? (
              <p className="muted">Loading…</p>
            ) : friends.length === 0 ? (
              <p className="muted">No friends yet. Add someone using their friend code.</p>
            ) : (
              <ul className="list">
                {friends.map((f) => (
                  <li className="listItem" key={f._id}>
                    <div className="listMain">
                      <div className="listName">{f.name || "Unnamed"}</div>
                      <div className="listMeta">Friend code: {f.friendCode || "—"}</div>
                    </div>
                    <div className="listActions">
                      <button
                        className="btn"
                        onClick={() => copyToClipboard(f.friendCode || "", "Friend code copied")}
                        disabled={!f.friendCode}
                      >
                        Copy code
                      </button>
                      <button className="btn btnPrimary" onClick={() => visitRoom(f._id)}>
                        Visit room
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
