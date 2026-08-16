import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown rendering, currently used only by interviewer notes.
//
// Raw HTML inside the markdown is NOT rendered: react-markdown ignores it
// unless rehype-raw is added, and it deliberately is not. Notes are written by
// an interviewer and read back by any interviewer, so a pasted <script> or a
// styled overlay would be one account's text executing in another's page.
//
// Problem descriptions deliberately do not go through this: they are written
// as preformatted plain text (aligned examples, hand-drawn tables), which
// markdown would collapse.
export default function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}
