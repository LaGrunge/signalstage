import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Tree } from "react-arborist";

// Folder nodes carry the materialized path the server stores; problem nodes
// are leaves (no children array at all, which is how react-arborist tells the
// two apart). Node ids are prefixed because folders and problems are separate
// tables and their UUIDs would otherwise collide in the tree's id space.
export function buildTree(folders, problems) {
  const byPath = new Map();
  const roots = [];

  for (const folder of [...folders].sort((a, b) => a.path.localeCompare(b.path))) {
    const node = {
      id: `f:${folder.id}`,
      kind: "folder",
      folderId: folder.id,
      path: folder.path,
      name: folder.path.split("/").pop(),
      mine: folder.mine,
      children: [],
    };
    byPath.set(folder.path, node);
    const cut = folder.path.lastIndexOf("/");
    const parent = cut === -1 ? null : byPath.get(folder.path.slice(0, cut));
    (parent ? parent.children : roots).push(node);
  }

  const folderById = new Map(folders.map((f) => [f.id, byPath.get(f.path)]));
  for (const problem of problems) {
    const parent = problem.folderId ? folderById.get(problem.folderId) : null;
    const node = { id: `p:${problem.id}`, kind: "problem", problem, name: problem.title };
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

// The node renderer has to be a STABLE component reference: passing an inline
// arrow to <Tree> creates a new component type on every render, so React
// unmounts and remounts every row - which silently breaks anything spanning
// two events on the same element, double-click included. So the callback
// travels by context instead of by prop.
const OpenProblemContext = createContext(() => {});

function pathOf(node) {
  return node?.data.kind === "folder" ? node.data.path : null;
}

// The path a node dropped on `parentNode` should end up under ("" = root).
function parentPathOf(parentNode) {
  return pathOf(parentNode) ?? "";
}

function join(parentPath, name) {
  return parentPath ? `${parentPath}/${name}` : name;
}

// react-window (under react-arborist) needs a pixel height, but the panel is
// sized by CSS - measure it instead of hardcoding rows, or the tree either
// clips or leaves a dead box below itself.
function useMeasuredHeight(ref, fallback = 420) {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeight(Math.max(160, entry.contentRect.height)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

export default function ProblemTree({
  folders,
  problems,
  // Which folders are expanded. Owned by the caller because opening a problem
  // unmounts this tree (the editor takes the pane over), and a tree that
  // collapses back to the root every time you come back from editing is
  // useless once the bank has any depth.
  openState,
  onOpenChange,
  onOpenProblem,
  onSelect,
  createFolder,
  renameFolder,
  deleteFolder,
  renameProblem,
  moveProblem,
  deleteProblem,
}) {
  const treeRef = useRef(null);
  const bodyRef = useRef(null);
  const height = useMeasuredHeight(bodyRef);
  const data = buildTree(folders, problems);

  // react-arborist is in controlled mode: these handlers persist the change
  // and the caller refetches, so the server stays the single source of truth
  // for the tree (no optimistic local mutation to drift out of sync).
  async function onCreate({ parentNode }) {
    const parentPath = parentPathOf(parentNode);
    const siblings = new Set(
      folders.filter((f) => f.path.slice(0, f.path.lastIndexOf("/") + 1) === (parentPath ? parentPath + "/" : ""))
        .map((f) => f.path.split("/").pop())
    );
    let name = "New folder";
    for (let n = 2; siblings.has(name); n++) name = `New folder ${n}`;
    const created = await createFolder(join(parentPath, name));
    // Remember that the parent is now expanded, or the new child vanishes on
    // the next remount of the tree.
    if (created && parentNode) onOpenChange(parentNode.id, true);
    return created ? { id: `f:${created.id}` } : null;
  }

  async function onRename({ node, name }) {
    if (!name.trim()) return;
    if (node.data.kind === "folder") {
      const cut = node.data.path.lastIndexOf("/");
      await renameFolder(node.data.folderId, join(cut === -1 ? "" : node.data.path.slice(0, cut), name.trim()));
    } else {
      await renameProblem(node.data.problem.id, name.trim());
    }
  }

  async function onMove({ dragNodes, parentNode }) {
    const parentPath = parentPathOf(parentNode);
    for (const node of dragNodes) {
      if (node.data.kind === "folder") {
        await renameFolder(node.data.folderId, join(parentPath, node.data.name));
      } else {
        await moveProblem(node.data.problem.id, parentNode?.data.folderId ?? null);
      }
    }
  }

  async function onDelete({ nodes }) {
    for (const node of nodes) {
      if (node.data.kind === "folder") await deleteFolder(node.data.folderId);
      else await deleteProblem(node.data.problem.id);
    }
  }

  return (
    <div className="problem-tree">
      <div className="problem-tree-toolbar">
        <button className="link" onClick={() => treeRef.current?.createInternal()} title="New folder inside the selection">
          + Folder
        </button>
        <button
          className="link"
          onClick={() => {
            const node = treeRef.current?.focusedNode;
            if (node) node.edit();
          }}
          title="Rename the selected item (F2)"
        >
          Rename
        </button>
        <button
          className="link danger"
          onClick={() => {
            const node = treeRef.current?.focusedNode;
            if (node) treeRef.current.delete(node);
          }}
          title="Delete the selected item"
        >
          Delete
        </button>
      </div>
      <div className="problem-tree-body" ref={bodyRef}>
      <OpenProblemContext.Provider value={onOpenProblem}>
      <Tree
        ref={treeRef}
        data={data}
        openByDefault={false}
        initialOpenState={openState}
        onToggle={(id) => onOpenChange(id, !openState[id])}
        width="100%"
        height={height}
        indent={16}
        rowHeight={28}
        disableMultiSelection
        onCreate={onCreate}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
        onSelect={(nodes) => onSelect(nodes[0]?.data ?? null)}
      >
        {TreeNode}
      </Tree>
      </OpenProblemContext.Provider>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 2h8l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm8 1.5V8h4.5L14 3.5z" />
    </svg>
  );
}

function TreeNode({ node, style, dragHandle }) {
  const onOpenProblem = useContext(OpenProblemContext);
  const isFolder = node.data.kind === "folder";
  return (
    <div
      ref={dragHandle}
      style={style}
      className={`tree-node ${node.isSelected ? "selected" : ""} ${node.willReceiveDrop ? "drop-target" : ""}`}
      onClick={() => isFolder && node.toggle()}
      onDoubleClick={() => !isFolder && onOpenProblem(node.data.problem)}
      title={isFolder ? node.data.path : "Double-click to edit"}
    >
      <span className={`tree-chevron ${isFolder && node.isOpen ? "open" : ""}`}>{isFolder ? "\u25B8" : ""}</span>
      <span className="tree-node-icon">{isFolder ? <FolderIcon /> : <FileIcon />}</span>
      {node.isEditing ? (
        <input
          className="tree-node-input"
          autoFocus
          defaultValue={node.data.name}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (e.key === "Escape") node.reset();
            if (e.key === "Enter") node.submit(e.currentTarget.value);
          }}
        />
      ) : (
        <>
          <span className="tree-node-name">{node.data.name}</span>
          {!isFolder && (
            <span className="tree-node-meta">
              {"★".repeat(node.data.problem.difficulty)}
              {node.data.problem.likedByMe ? " ♥" : ""}
            </span>
          )}
        </>
      )}
    </div>
  );
}
