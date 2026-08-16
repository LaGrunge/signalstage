import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import Markdown from "./Markdown.jsx";

const SAVE_DEBOUNCE_MS = 800;

const STATE_LABEL = {
  loading: "Loading…",
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Could not save",
};

// One markdown notes document per room, shared by every interviewer and
// invisible to the candidate (the notes live behind an authenticated REST
// endpoint, not in the room's Yjs document - that one is replicated to the
// candidate's browser in full).
//
// Used from both the live room and the playback page, which is the whole
// point: notes taken during a session are read back after it.
export default function NotesPanel({ roomId }) {
  const [notes, setNotes] = useState("");
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("write");
  const [state, setState] = useState("loading");

  const timerRef = useRef(null);
  // The text of an edit that has not reached the server yet, so closing the
  // panel (which unmounts this component) can flush it instead of dropping
  // the last few hundred milliseconds of typing.
  const pendingRef = useRef(null);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/rooms/${roomId}/notes`)
      .then(({ data }) => {
        if (cancelled) return;
        setNotes(data.notes || "");
        setMeta({ updatedAt: data.updatedAt, updatedBy: data.updatedBy });
        setState("saved");
      })
      .catch(() => !cancelled && setState("error"));

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (pendingRef.current !== null) {
        // Fire and forget - the request outlives the component.
        api.put(`/rooms/${roomIdRef.current}/notes`, { notes: pendingRef.current }).catch(() => {});
        pendingRef.current = null;
      }
    };
  }, [roomId]);

  async function save(value) {
    setState("saving");
    try {
      const { data } = await api.put(`/rooms/${roomId}/notes`, { notes: value });
      if (pendingRef.current === value) pendingRef.current = null;
      setMeta({ updatedAt: data.updatedAt, updatedBy: null });
      setState((s) => (s === "saving" ? "saved" : s));
    } catch {
      setState("error");
    }
  }

  function onChange(value) {
    setNotes(value);
    setState("dirty");
    pendingRef.current = value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), SAVE_DEBOUNCE_MS);
  }

  return (
    <div className="notes">
      <div className="notes-toolbar">
        <div className="lang-tabs">
          <button className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>
            Write
          </button>
          <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
            Preview
          </button>
        </div>
        <span className={`notes-state ${state}`}>{STATE_LABEL[state]}</span>
      </div>

      {tab === "write" ? (
        <textarea
          className="notes-input"
          value={notes}
          placeholder={"How did it go?\n\n- **Markdown** is supported\n- `code` too"}
          onChange={(e) => onChange(e.target.value)}
          disabled={state === "loading"}
        />
      ) : (
        <div className="notes-preview">
          {notes.trim() ? <Markdown>{notes}</Markdown> : <div className="muted">Nothing written yet</div>}
        </div>
      )}

      <div className="notes-footer muted">
        {meta?.updatedAt
          ? `Last edited ${formatRelativeTime(meta.updatedAt)}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}`
          : "Not edited yet"}
        {" · "}
        Only interviewers can see this.
      </div>
    </div>
  );
}
