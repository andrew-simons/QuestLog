import React, { useEffect, useMemo, useState, useContext } from "react";
import { get, patch } from "../../utilities";
import { UserContext } from "../App";
import JournalCard from "../modules/JournalCard";
import "./Journal.css";

const Journal = () => {
  const { userId } = useContext(UserContext);

  const [completedQuests, setCompletedQuests] = useState([]);
  const [journalByQuestKey, setJournalByQuestKey] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const [filterSource, setFilterSource] = useState("all"); // all|builtin|custom
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // recent|alpha

  const [savingKey, setSavingKey] = useState(null);

  const uploadPhotos = async (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("photos", f));

    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    if (!res.ok) throw new Error("Upload failed");
    return res.json(); // { urls: [...] }
  };

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    get("/api/journal")
      .then(({ builtinQuests, customQuests, journals }) => {
        const combined = [
          ...(builtinQuests || []).map((q) => ({
            source: "builtin",
            id: q.questKey,
            title: q.title,
            description: q.description,
            raw: q,
          })),
          ...(customQuests || []).map((cq) => ({
            source: "custom",
            id: cq._id,
            title: cq.title,
            description: cq.description,
            raw: cq,
          })),
        ];

        setCompletedQuests(combined);

        const map = new Map();
        (journals || []).forEach((j) => {
          const key =
            j.source === "builtin" ? `builtin:${j.questKey}` : `custom:${String(j.customQuestId)}`;
          map.set(key, j);
        });
        setJournalByQuestKey(map);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, [userId]);

  const saveJournal = async (item, { text, photoUrls, files }) => {
    if (!userId) throw new Error("Not logged in");

    const savingId = item.source === "builtin" ? item.id : String(item.id);
    setSavingKey(`${item.source}:${savingId}`);

    try {
      let uploadedUrls = [];
      if (files && files.length) {
        const out = await uploadPhotos(files);
        uploadedUrls = out.urls || [];
      }

      const finalPhotoUrls = [...(photoUrls || []), ...uploadedUrls];

      const body =
        item.source === "builtin"
          ? { source: "builtin", questKey: item.id, text, photoUrls: finalPhotoUrls }
          : { source: "custom", customQuestId: String(item.id), text, photoUrls: finalPhotoUrls };

      const updatedDoc = await patch("/api/journal", body);

      setJournalByQuestKey((prev) => {
        const next = new Map(prev);
        const key =
          updatedDoc.source === "builtin"
            ? `builtin:${updatedDoc.questKey}`
            : `custom:${String(updatedDoc.customQuestId)}`;
        next.set(key, updatedDoc);
        return next;
      });

      return updatedDoc;
    } finally {
      setSavingKey(null);
    }
  };

  const getJournalFor = (item) => {
    const key = item.source === "builtin" ? `builtin:${item.id}` : `custom:${String(item.id)}`;
    return (
      journalByQuestKey.get(key) || {
        source: item.source,
        questKey: item.source === "builtin" ? item.id : undefined,
        customQuestId: item.source === "custom" ? String(item.id) : undefined,
        text: "",
        photoUrls: [],
      }
    );
  };

  const visibleItems = useMemo(() => {
    const s = search.trim().toLowerCase();

    return completedQuests
      .filter((it) => {
        if (filterSource !== "all" && it.source !== filterSource) return false;
        if (!s) return true;
        return (
          (it.title || "").toLowerCase().includes(s) ||
          (it.description || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        if (sortBy === "alpha") return (a.title || "").localeCompare(b.title || "");

        const ja = getJournalFor(a);
        const jb = getJournalFor(b);

        const ta = ja?.createdAt ? new Date(ja.createdAt).getTime() : 0;
        const tb = jb?.createdAt ? new Date(jb.createdAt).getTime() : 0;

        if (ta === 0 && tb === 0) return 0;
        if (ta === 0) return 1;
        if (tb === 0) return -1;
        return tb - ta;
      });
  }, [completedQuests, filterSource, search, sortBy]);

  const stats = useMemo(() => {
    const total = completedQuests.length;
    const shown = visibleItems.length;
    const withText = visibleItems.filter(
      (it) => (getJournalFor(it)?.text || "").trim().length > 0
    ).length;
    const withPhotos = visibleItems.filter(
      (it) => (getJournalFor(it)?.photoUrls || []).length > 0
    ).length;
    return { total, shown, withText, withPhotos };
  }, [completedQuests.length, visibleItems]); 

  return (
    <div className="jrPage">
      <div className="jrHero">
        <div className="jrHeroLeft">
          <h1 className="jrH1">Journal</h1>
          <div className="jrSubtitle">Write about your experiences side questing here! :D</div>
        </div>

        <div className="jrStats" aria-label="Journal stats">
          <div className="jrStat">
            <div className="jrStatNum">{stats.total}</div>
            <div className="jrStatLbl">Completed</div>
          </div>
          <div className="jrStat">
            <div className="jrStatNum">{stats.shown}</div>
            <div className="jrStatLbl">Showing</div>
          </div>
          <div className="jrStat">
            <div className="jrStatNum">{stats.withText}</div>
            <div className="jrStatLbl">With notes</div>
          </div>
          <div className="jrStat">
            <div className="jrStatNum">{stats.withPhotos}</div>
            <div className="jrStatLbl">With photos</div>
          </div>
        </div>
      </div>

      <div className="jrControls">
        <div className="jrSearchWrap">
          <span className="jrSearchIcon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="jrSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles + descriptions…"
          />
          {search.trim() && (
            <button
              className="jrClear"
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              title="Clear"
            >
              ×
            </button>
          )}
        </div>

        <div className="jrPills" role="tablist" aria-label="Filter">
          <button
            className={`jrPill ${filterSource === "all" ? "active" : ""}`}
            type="button"
            onClick={() => setFilterSource("all")}
          >
            All
          </button>
          <button
            className={`jrPill ${filterSource === "builtin" ? "active" : ""}`}
            type="button"
            onClick={() => setFilterSource("builtin")}
          >
            Built-in
          </button>
          <button
            className={`jrPill ${filterSource === "custom" ? "active" : ""}`}
            type="button"
            onClick={() => setFilterSource("custom")}
          >
            Custom
          </button>
        </div>

        <div className="jrSelectWrap">
          <label className="jrSelectLabel" htmlFor="jrSort">
            Sort
          </label>
          <select
            id="jrSort"
            className="jrSelect"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="recent">Most recent</option>
            <option value="alpha">A → Z</option>
          </select>
        </div>
      </div>

      <JournalCard
        loading={loading}
        completedQuests={visibleItems}
        getJournalFor={getJournalFor}
        onSaveJournal={saveJournal}
        savingKey={savingKey}
      />
    </div>
  );
};

export default Journal;
