import { useState } from "react";
import { api } from "../lib/api.js";

const EMPTY_FORM = { title: "", language: "python", code: "" };

export default function TemplateManager({ templates, languages, onChange }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ title: t.title, language: t.language, code: t.code });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.put(`/templates/${editingId}`, form);
      } else {
        await api.post("/templates", form);
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await onChange();
    } catch {
      setError("Failed to save template");
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/templates/${id}`);
      await onChange();
    } catch {
      setError("Failed to delete template");
    }
  }

  return (
    <section className="templates">
      <div className="templates-header">
        <h2>Code templates</h2>
        {!open && (
          <button className="link" onClick={startCreate}>
            + New template
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {open && (
        <form className="template-form" onSubmit={save}>
          <input
            placeholder="Template title (e.g. Two Sum starter)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            {languages.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <textarea
            className="template-code"
            placeholder="Starter code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            rows={10}
          />
          <div className="template-form-actions">
            <button type="submit">{editingId ? "Save changes" : "Create template"}</button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setOpen(false);
                setEditingId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="template-list">
        {templates.map((t) => (
          <li key={t.id}>
            <div>
              <strong>{t.title}</strong>
              <span className="muted"> · {t.language}</span>
            </div>
            <div className="room-actions">
              <button className="link" onClick={() => startEdit(t)}>
                Edit
              </button>
              <button className="link danger" onClick={() => remove(t.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {templates.length === 0 && !open && <li className="muted">No templates yet</li>}
      </ul>
    </section>
  );
}
