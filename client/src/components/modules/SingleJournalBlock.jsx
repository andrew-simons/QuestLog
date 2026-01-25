import React, { useEffect, useMemo, useState } from "react";

const badgeStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(6px)",
};

const Icon = ({ name }) => {
  // tiny inline icons (no dependency)
  const common = { width: 16, height: 16, display: "inline-block" };
  if (name === "check")
    return (
      <svg style={common} viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (name === "save")
    return (
      <svg style={common} viewBox="0 0 24 24" fill="none">
        <path
          d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 21v-8H7v8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 3v5h8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (name === "photo")
    return (
      <svg style={common} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 7a2 2 0 0 1 2-2h3l2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  return null;
};

const formatDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const isValidUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeUrls = (raw) =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidUrl);

const SingleJournalBlock = ({ item, journal, onSave, saving }) => {
  const [draftText, setDraftText] = useState("");
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [status, setStatus] = useState(""); // "", "Saved", "Save failed"
  const [photoInput, setPhotoInput] = useState("");

  useEffect(() => {
    setDraftText(journal?.text || "");
    setDraftPhotos(Array.isArray(journal?.photoUrls) ? journal.photoUrls : []);
    setPhotoInput("");
    setStatus("");
  }, [item.source, item.id, journal?.text, journal?.photoUrls]);

  const meta = useMemo(() => {
    const sourceLabel = item.source === "builtin" ? "Built-in" : "Custom";
    const rarity = item.raw?.rarity ?? "?";
    const xp = item.raw?.xpReward ?? item.raw?.expReward ?? "?";
    const idLine =
      item.source === "builtin"
        ? `Quest #${item.id}`
        : `ID: ${String(item.id).slice(-6)}`;
    const updated = formatDate(journal?.updatedAt);

    return { sourceLabel, rarity, xp, idLine, updated };
  }, [item, journal?.updatedAt]);

  const dirty =
    (draftText || "") !== (journal?.text || "") ||
    JSON.stringify(draftPhotos || []) !== JSON.stringify(journal?.photoUrls || []);

  const handleSave = () => {
    setStatus("");
    return onSave({ text: draftText, photoUrls: draftPhotos })
      .then(() => setStatus("Saved"))
      .catch((err) => {
        console.log(err);
        setStatus("Save failed");
      });
  };

  const addPhotosFromInput = () => {
    const urls = normalizeUrls(photoInput);
    if (urls.length === 0) return;
    setDraftPhotos((prev) => Array.from(new Set([...prev, ...urls])));
    setPhotoInput("");
    setStatus("");
  };

  const removePhoto = (url) => {
    setDraftPhotos((prev) => prev.filter((u) => u !== url));
    setStatus("");
  };

  const onKeyDownTextarea = (e) => {
    // Cmd/Ctrl+Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!saving) handleSave();
    }
  };

  return (
    <div className="jbCard">
      <div className="jbHeader">
        <div className="jbTitleRow">
          <h3 className="jbTitle">{item.title}</h3>
          <div className="jbRightMeta">
            {dirty && <span className="jbDirtyDot" title="Unsaved changes" />}
            {status === "Saved" && (
              <span className="jbStatus ok">
                <Icon name="check" /> Saved
              </span>
            )}
            {status === "Save failed" && <span className="jbStatus bad">Save failed</span>}
          </div>
        </div>

        <div className="jbBadges">
          <span style={badgeStyle}>{meta.sourceLabel}</span>
          <span style={badgeStyle}>{meta.idLine}</span>

          {item.source === "builtin" && (
            <>
              <span style={badgeStyle}>Rarity: {meta.rarity}</span>
              <span style={badgeStyle}>XP: {meta.xp}</span>
            </>
          )}

          {meta.updated && <span style={badgeStyle}>Updated: {meta.updated}</span>}
        </div>

        {item.description && <div className="jbDesc">{item.description}</div>}
      </div>

      <div className="jbBody">
        <label className="jbLabel">Your notes</label>
        <textarea
          className="jbTextarea"
          rows={5}
          value={draftText}
          onKeyDown={onKeyDownTextarea}
          onChange={(e) => {
            setDraftText(e.target.value);
            setStatus("");
          }}
          placeholder="What did you do? What did you learn? What was hard? (Cmd/Ctrl+Enter to save)"
        />

        <div className="jbPhotosSection">
          <div className="jbPhotosTop">
            <label className="jbLabel">Photos</label>
            <span className="jbHint">Paste image URLs and press Enter</span>
          </div>

          <div className="jbPhotoInputRow">
            <div className="jbPhotoInputWrap">
              <span className="jbPhotoIcon">
                <Icon name="photo" />
              </span>
              <input
                className="jbPhotoInput"
                value={photoInput}
                onChange={(e) => {
                  setPhotoInput(e.target.value);
                  setStatus("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPhotosFromInput();
                  }
                }}
                placeholder="https://… , https://…"
              />
            </div>

            <button
              className="jbBtn secondary"
              type="button"
              onClick={addPhotosFromInput}
              disabled={saving || normalizeUrls(photoInput).length === 0}
              title="Add valid URLs"
            >
              Add
            </button>
          </div>

          {draftPhotos.length > 0 && (
            <>
              <div className="jbChips">
                {draftPhotos.map((url) => (
                  <span className="jbChip" key={url} title={url}>
                    <span className="jbChipText">{url}</span>
                    <button
                      className="jbChipX"
                      type="button"
                      onClick={() => removePhoto(url)}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="jbGrid">
                {draftPhotos.map((url) => (
                  <div className="jbImgWrap" key={url}>
                    <img className="jbImg" src={url} alt="journal" loading="lazy" />
                    <button
                      className="jbImgRemove"
                      type="button"
                      onClick={() => removePhoto(url)}
                      aria-label="Remove"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="jbFooter">
          <div className="jbFooterLeft">
            <span className="jbSmall">
              {dirty ? "Unsaved changes" : "Up to date"}
              {dirty && <span className="jbSmallHint"> • Cmd/Ctrl+Enter to save</span>}
            </span>
          </div>

          <button
            className="jbBtn primary"
            type="button"
            onClick={handleSave}
            disabled={saving || (!dirty && (draftText || "").length === 0 && draftPhotos.length === 0)}
          >
            <Icon name="save" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SingleJournalBlock;
