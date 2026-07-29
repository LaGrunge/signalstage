import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import Ansi from "ansi-to-react";
import { api } from "../lib/api.js";
import { highlightCode } from "../lib/highlight.js";
import { buildTimeAxis } from "../lib/playbackTime.js";
import { MONACO_LANGUAGE } from "../components/CollabEditor.jsx";

const SPEEDS = [1, 2, 4, 8];
// A backward scrub rebuilds from the nearest checkpoint, so this bounds the
// worst-case number of Y.applyUpdate calls per seek.
const CHECKPOINT_EVERY = 500;

const MARKER_META = {
  run: { color: "#4f8cff", label: "Run" },
  test_run: { color: "#b78cff", label: "Run tests" },
  test_submit: { color: "#3dd68c", label: "Submit" },
  join: { color: "#8a8aa3", label: "joined" },
  leave: { color: "#8a8aa3", label: "left" },
  ended: { color: "#ff6b6b", label: "Session ended" },
};

function decodeUpdate(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function formatClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function Playback() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playhead, setPlayhead] = useState(0); // compressed ms
  const [text, setText] = useState("");
  const [viewingEvent, setViewingEvent] = useState(null);

  // Replay machinery lives in refs - it mutates per animation frame and must
  // not retrigger React renders beyond the text/playhead state updates.
  const docRef = useRef(null); // current Y.Doc
  const appliedRef = useRef(-1); // index of last applied update
  const checkpointsRef = useRef([]); // [{index, state: Uint8Array}]
  const rafRef = useRef(null);
  const lastTickRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    api
      .get(`/rooms/${roomId}/playback`)
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.status === 404 ? "Session not found" : "Failed to load playback"));
  }, [roomId]);

  const updates = useMemo(
    () =>
      (data?.updates ?? []).map((u) => ({
        t: u.t,
        keyframe: Boolean(u.k),
        bytes: decodeUpdate(u.u),
      })),
    [data]
  );
  const events = data?.events ?? [];

  const axis = useMemo(
    () => buildTimeAxis([...updates.map((u) => u.t), ...events.map((e) => e.t)]),
    [updates, events]
  );

  // One pass over the whole log up front: build the checkpoint ladder that
  // makes backward scrubbing O(CHECKPOINT_EVERY) applies instead of O(n).
  // Keyframe rows start a fresh Y.Doc - each document (re)load began a new
  // Yjs history, so cross-segment applies would duplicate text.
  useEffect(() => {
    if (!data) return;
    const checkpoints = [];
    let doc = new Y.Doc();
    for (let i = 0; i < updates.length; i++) {
      if (updates[i].keyframe) doc = new Y.Doc();
      Y.applyUpdate(doc, updates[i].bytes);
      if (updates[i].keyframe || (i + 1) % CHECKPOINT_EVERY === 0) {
        checkpoints.push({ index: i, state: Y.encodeStateAsUpdate(doc) });
      }
    }
    checkpointsRef.current = checkpoints;
    // Start parked at the end (the natural "what did the session produce"
    // view); the interviewer scrubs back or hits play-from-start.
    docRef.current = doc;
    appliedRef.current = updates.length - 1;
    setText(updates.length ? doc.getText("code").toString() : data.meta.lastCode ?? "");
    setPlayhead(axis.duration);
  }, [data, updates, axis]);

  function applyTo(targetIdx) {
    if (targetIdx === appliedRef.current) return;
    let doc = docRef.current;
    let from = appliedRef.current + 1;
    if (targetIdx < appliedRef.current) {
      // Backward: restart from the nearest checkpoint at or before target.
      const cp = [...checkpointsRef.current].reverse().find((c) => c.index <= targetIdx);
      doc = new Y.Doc();
      if (cp) {
        Y.applyUpdate(doc, cp.state);
        from = cp.index + 1;
      } else {
        from = 0;
      }
    }
    for (let i = from; i <= targetIdx; i++) {
      if (updates[i].keyframe) doc = new Y.Doc();
      Y.applyUpdate(doc, updates[i].bytes);
    }
    docRef.current = doc;
    appliedRef.current = targetIdx;
    setText(targetIdx >= 0 ? doc.getText("code").toString() : "");
  }

  function seekCompressed(c) {
    const clamped = Math.max(0, Math.min(c, axis.duration));
    setPlayhead(clamped);
    const realT = axis.toReal(clamped);
    // Number of updates with t <= realT, as an index.
    let lo = 0, hi = updates.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (updates[mid].t <= realT) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    applyTo(idx);
  }

  // rAF playback clock.
  useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();
    const tick = (now) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      setPlayhead((prev) => {
        const next = prev + dt * speed;
        if (next >= axis.duration) {
          setPlaying(false);
          return axis.duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed, axis]);

  // Apply updates as the playhead moves (during play; seeks call applyTo
  // directly via seekCompressed).
  useEffect(() => {
    if (!playing) return;
    const realT = axis.toReal(playhead);
    let idx = appliedRef.current;
    while (idx + 1 < updates.length && updates[idx + 1].t <= realT) idx++;
    if (idx !== appliedRef.current) applyTo(idx);
  }, [playhead, playing, updates, axis]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (playhead >= axis.duration) seekCompressed(0);
    setPlaying(true);
  }

  function onTimelinePointer(e) {
    const rect = timelineRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekCompressed(frac * axis.duration);
  }

  function markerClick(ev, e) {
    e.stopPropagation();
    seekCompressed(axis.toCompressed(ev.t));
    if (ev.kind === "run" || ev.kind === "test_run" || ev.kind === "test_submit") {
      setViewingEvent(ev);
    }
    setPlaying(false);
  }

  if (error) return <div className="center-message">{error}</div>;
  if (!data) return <div className="center-message">Loading playback…</div>;

  const { meta } = data;
  const hasRecording = updates.length > 0;

  return (
    <div className="room playback">
      <header className="room-header">
        <img
          className="logo room-logo"
          src="/SignalStageNoTitle.png"
          alt="SignalStage"
          onClick={() => navigate("/dashboard")}
          style={{ cursor: "pointer" }}
        />
        <div>
          <strong>{meta.title}</strong>
          <span className="status offline">playback</span>
        </div>
        <button className="link" onClick={() => navigate("/dashboard")}>
          ← Back to dashboard
        </button>
      </header>

      {!hasRecording && (
        <div className="pb-banner muted">
          No keystroke recording for this session — showing the final code and event markers only.
        </div>
      )}

      <div className="pb-editor">
        <Editor
          height="100%"
          theme="vs-dark"
          language={MONACO_LANGUAGE[meta.language] || "plaintext"}
          value={hasRecording ? text : meta.lastCode ?? ""}
          options={{ readOnly: true, fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
        />
      </div>

      <div className="pb-controls">
        <button onClick={togglePlay} disabled={!hasRecording} title={playing ? "Pause" : "Play"}>
          {playing ? "⏸" : "▶"}
        </button>
        <button
          className="link"
          disabled={!hasRecording}
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          title="Playback speed"
        >
          {speed}x
        </button>
        <span className="muted pb-clock">
          {formatClock(playhead)} / {formatClock(axis.duration)}
        </span>
        <div className="pb-timeline" ref={timelineRef} onPointerDown={onTimelinePointer}>
          <div className="pb-progress" style={{ width: `${axis.duration ? (playhead / axis.duration) * 100 : 0}%` }} />
          {events.map((ev, i) => {
            const m = MARKER_META[ev.kind] ?? { color: "#8a8aa3", label: ev.kind };
            const passFail =
              ev.kind === "test_run" || ev.kind === "test_submit"
                ? ` ${ev.passedCount}/${ev.totalCount}`
                : "";
            return (
              <button
                key={i}
                className={`pb-marker pb-marker-${ev.kind}`}
                style={{
                  left: `${axis.duration ? (axis.toCompressed(ev.t) / axis.duration) * 100 : 0}%`,
                  backgroundColor:
                    ev.kind === "test_run" || ev.kind === "test_submit"
                      ? ev.passedCount === ev.totalCount
                        ? "#3dd68c"
                        : "#ff6b6b"
                      : m.color,
                }}
                title={`${ev.actor ? ev.actor + " · " : ""}${m.label}${passFail}`}
                onPointerDown={(e) => markerClick(ev, e)}
              />
            );
          })}
        </div>
      </div>

      {viewingEvent && (
        <div className="modal-overlay" onClick={() => setViewingEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>
                {MARKER_META[viewingEvent.kind]?.label} · {viewingEvent.actor}
                {viewingEvent.kind === "run" && viewingEvent.status ? ` · ${viewingEvent.status}` : ""}
                {viewingEvent.kind !== "run"
                  ? ` · ${viewingEvent.passedCount}/${viewingEvent.totalCount} passed`
                  : ""}
              </strong>
              <button className="link" onClick={() => setViewingEvent(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              {viewingEvent.kind === "run" ? (
                <>
                  <div className="modal-code">
                    <label>Code</label>
                    <pre>
                      <code
                        className="hljs"
                        dangerouslySetInnerHTML={highlightCode(viewingEvent.code, viewingEvent.language)}
                      />
                    </pre>
                  </div>
                  <div className="modal-output">
                    <label>Result</label>
                    {viewingEvent.compileOutput && (
                      <pre className="compile">
                        <Ansi>{viewingEvent.compileOutput}</Ansi>
                      </pre>
                    )}
                    {viewingEvent.stdout && (
                      <pre>
                        <Ansi>{viewingEvent.stdout}</Ansi>
                      </pre>
                    )}
                    {viewingEvent.stderr && (
                      <pre className="stderr">
                        <Ansi>{viewingEvent.stderr}</Ansi>
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="modal-output">
                  <label>Test results</label>
                  <div className="test-case-list">
                    {(viewingEvent.results ?? []).map((r, i) => (
                      <div key={i} className={`test-case ${r.passed ? "passed" : "failed"}`}>
                        <div className="test-case-title">
                          {r.passed ? "✓" : "✗"} {r.name}
                        </div>
                        {r.message && <div className="test-case-error">{r.message}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
