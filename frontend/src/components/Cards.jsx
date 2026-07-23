import { useEffect, useRef, useState } from "react";
import { highlightCode } from "../lib/highlight.js";

export function CardGrid({ children }) {
  return <div className="card-grid">{children}</div>;
}

function PersonIcon() {
  return (
    <svg className="person-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

// title/language/footer/participantCount live in the bottom bar; the code
// preview takes the full card width above it. `actions` is an optional list
// of {key, label, onClick, danger} rendered behind a "..." menu; `onRename`
// (optional) prepends a "Rename" entry that swaps the title for an inline
// input instead of firing a callback directly, since renaming needs its own
// text-entry step the other actions don't.
export function PreviewCard({ title, language, preview, footer, participantCount, onClick, onRename, actions }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraftTitle(title);
  }, [title, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  function startRename() {
    setDraftTitle(title);
    setEditing(true);
  }

  function commitRename() {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
  }

  function handleTitleKeyDown(e) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      setDraftTitle(title);
      setEditing(false);
    }
  }

  const allActions = [...(onRename ? [{ key: "rename", label: "Rename", onClick: startRename }] : []), ...(actions || [])];

  return (
    <div className="card" onClick={onClick}>
      <pre className="card-preview">
        <code className="hljs" dangerouslySetInnerHTML={highlightCode(preview, language)} />
      </pre>
      <div className="card-foot">
        <div className="card-foot-main">
          {editing ? (
            <input
              className="card-title-input"
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <strong className="card-title">{title}</strong>
          )}
          {language && <span className="card-lang">{language}</span>}
        </div>
        <div className="card-foot-meta">
          {participantCount != null && (
            <span
              className="card-people"
              title={`${participantCount} participant${participantCount === 1 ? "" : "s"}`}
            >
              <PersonIcon /> {participantCount}
            </span>
          )}
          <span className="muted card-time">{footer}</span>
          {allActions.length > 0 && (
            <div className="card-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <button className="card-menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Actions">
                ⋮
              </button>
              {menuOpen && (
                <div className="card-menu-dropdown">
                  {allActions.map((a) => (
                    <button
                      key={a.key}
                      className={a.danger ? "danger" : ""}
                      onClick={() => {
                        setMenuOpen(false);
                        a.onClick();
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
