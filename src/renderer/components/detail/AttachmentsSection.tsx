import { FileText, Paperclip, Trash2 } from "lucide-react";
import type { Attachment } from "@shared/types";

interface Props {
  attachments: Attachment[];
  onAdd: () => Promise<unknown>;
  onOpen: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<unknown>;
}

/** File attachment list for a task. */
export function AttachmentsSection({ attachments, onAdd, onOpen, onRemove }: Props) {
  return (
    <section className="detail-block">
      <div className="detail-subtitle">Attachments</div>

      {attachments.map((att) => (
        <div key={att.id} className="attachment-row">
          <button className="attachment-link" onClick={() => onOpen(att.id)}>
            <FileText size={14} />
            <span>{att.name}</span>
            <span className="muted">{Math.ceil(att.size / 1024)} KB</span>
          </button>
          <button
            className="icon-button-small danger"
            onClick={() => onRemove(att.id)}
            title="Remove attachment"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <button className="secondary-button" onClick={onAdd}>
        <Paperclip size={14} />
        Attach file
      </button>
    </section>
  );
}
