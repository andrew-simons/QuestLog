import React, { useEffect, useMemo, useRef, useState } from "react";

const badgeStyle = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(8px)",
  fontWeight: 800,
  color: "rgba(0,0,0,0.72)",
};

const Icon = ({ name }) => {
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

const SingleJournalBlock = ({ item, journal, onSave, saving }) => {
  const [draftText, setDraftText] = useState("");
  const [draftPhotos, setDraftPhotos] = useState([]); // saved photoUrls from DB
  const [status, setStatus] = useState(""); // "", "Saved", "Save failed"

  // local device uploads (not saved yet)
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const fileInputRef = useRef(null);

  useEffect(() => {
    setDraftText(journal?.text || "");
    setDraftPhotos(Array.isArray(journal?.photoUrls) ? journal.photoUrls : []);
    setSelectedFiles([]);
    setStatus("");
  }, [item.source, item.id, journal?.text, journal?.photoUrls]);

  // previews for selected files
  const filePreviews = useMemo(() => {
    return selectedFiles.map((f) => ({
      key: `${f.name}:${f.size}:${f.lastModified}`,
      name: f.name,
      url: URL.createObjectURL(f),
    }));
  }, [selectedFiles]);

  // cleanup blob URLs
  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [filePreviews]);

  const meta = useMemo(() => {
    const sourceLabel = item.source === "builtin" ? "Built-in" : "Custom";
    const rarity = item.raw?.rarity ?? "?";
    const xp = item.raw?.xpReward ?? item.raw?.expReward ?? "?";
    const idLine =
      item.source === "builtin" ? `Quest #${item.id}` : `ID: ${String(item.id).slice(-6)}`;
    const updated = formatDate(journal?.updatedAt);
    return { sourceLabel, rarity, xp, idLine, updated };
  }, [item, journal?.updatedAt]);

  const dirty =
    (draftText || "") !== (journal?.text || "") ||
    JSON.stringify(draftPhotos || []) !== JSON.stringify(journal?.photoUrls || []) ||
    selectedFiles.length > 0;

  const hasAnyContent =
    (draftText || "").trim().length > 0 || (draftPhotos || []).length > 0 || selectedFiles.length > 0;

  const handleSave = () => {
    setStatus("");
    return onSave({ text: draftText, photoUrls: draftPhotos, files: selectedFiles })
      .then(() => {
        setStatus("Saved");
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      })
      .catch((err) => {
        console.log(err);
        setStatus("Save failed");
      });
  };

  const onKeyDownTextarea = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!saving) handleSave();
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // cap to 6 to match upload.array("photos", 6)
    const capped = files.slice(0, 6);

    setSelectedFiles((prev) => {
      const keyOf = (f) => `${f.name}:${f.size}:${f.lastModified}`;
      const seen = new Set(prev.map(keyOf));
      const out = [...prev];
      for (const f of capped) {
        const k = keyOf(f);
        if (!seen.has(k)) {
          seen.add(k);
          out.push(f);
        }
      }
      return out.slice(0, 6);
    });

    setStatus("");
  };

  const removeSelectedFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setStatus("");
  };

  const removeSavedPhoto = (url) => {
    setDraftPhotos((prev) => prev.filter((u) => u !== url));
    setStatus("");
  };

  return (
    <div className="jbCard">
      <div className="jbHeader">
        <div className="jbTitleRow">
          <h3 className="jbTitle">{item.title}</h3>
          <div className="jbRightMeta">
            {dirty && <span className="jbDirtyDot" title="Unsaved changes" />}
            {status === "Saved" && (
              <span className="jbStatus ok" title="Saved">
                <Icon name="check" /> Saved
              </span>
            )}
            {status === "Save failed" && (
              <span className="jbStatus bad" title="Save failed">
                Save failed
              </span>
            )}
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
          {selectedFiles.length > 0 && (
            <span style={badgeStyle}>{selectedFiles.length} new photo(s) selected</span>
          )}
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
            <div className="jbHint">Up to 6 images per save.</div>
          </div>

          <div className="jbPhotoInputRow">
            <button
              className="jbBtn secondary"
              type="button"
              onClick={openFilePicker}
              disabled={saving || selectedFiles.length >= 6}
              title="Upload images from your device"
            >
              <Icon name="photo" /> Upload
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              style={{ display: "none" }}
            />
          </div>

          {/* Previews for newly selected files */}
          {filePreviews.length > 0 && (
            <div className="jbGrid">
              {filePreviews.map((p, idx) => (
                <div className="jbImgWrap" key={p.key}>
                  <img className="jbImg" src={p.url} alt={p.name} loading="lazy" />
                  <button
                    className="jbImgRemove"
                    type="button"
                    onClick={() => removeSelectedFile(idx)}
                    aria-label="Remove selected photo"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Saved photos from DB */}
          {draftPhotos.length > 0 && (
            <div className="jbGrid">
              {draftPhotos.map((url) => (
                <div className="jbImgWrap" key={url}>
                  <img className="jbImg" src={url} alt="journal" loading="lazy" />
                  <button
                    className="jbImgRemove"
                    type="button"
                    onClick={() => removeSavedPhoto(url)}
                    aria-label="Remove saved photo"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
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
            disabled={saving || (!dirty && !hasAnyContent)}
            title={dirty ? "Save changes" : "Nothing new to save"}
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
