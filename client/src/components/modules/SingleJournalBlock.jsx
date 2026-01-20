import React, { useEffect, useState } from "react";

const SingleJournalBlock = ({ quest, journal, onSave, saving }) => {
  const [draftText, setDraftText] = useState("");
  const [draftPhotos, setDraftPhotos] = useState([]); // array of strings
  const [status, setStatus] = useState(""); // "Saved" / error messages

  // when journal prop changes (after fetch or save), sync into local draft
  useEffect(() => {
    setDraftText(journal?.text || "");
    setDraftPhotos(Array.isArray(journal?.photoUrls) ? journal.photoUrls : []);
  }, [journal?.questKey, journal?.text]); // keep it simple

  const parsePhotoInput = (raw) => {
    // comma-separated URLs
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const photoInputValue = draftPhotos.join(", ");

  const handleSave = () => {
    setStatus("");
    onSave({ text: draftText, photoUrls: draftPhotos })
      .then(() => setStatus("Saved"))
      .catch((err) => {
        console.log(err);
        setStatus("Save failed");
      });
  };

  return (
    <div style={{ border: "1px solid", padding: 12, marginBottom: 12, borderRadius: 8 }}>
      <h3 style={{ marginBottom: 4 }}>{quest.title}</h3>
      <div style={{ fontSize: 12}}>
        Quest #{quest.questKey} • Rarity: {quest.rarity} • XP: {quest.xpReward}
      </div>

      <textarea
        rows={4}
        value={draftText}
        onChange={(e) => {
          setDraftText(e.target.value);
          setStatus("");
        }}
        placeholder="Write your notes for this quest..."
        style={{ width: "100%" }}
      />

      <input
        value={photoInputValue}
        onChange={(e) => {
          setDraftPhotos(parsePhotoInput(e.target.value));
          setStatus("");
        }}
        placeholder="Optional: paste image URLs separated by commas"
        style={{ width: "100%" }}
      />

      {/* Preview images */}
      {draftPhotos.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {draftPhotos.map((url) => (
            <img key={url} src={url} alt="journal" style={{ maxHeight: 120, borderRadius: 8 }} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", alignItems: "center"}}>
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        {status && <span style={{ fontSize: 12}}>{status}</span>}
      </div>
    </div>
  );
};

export default SingleJournalBlock;
