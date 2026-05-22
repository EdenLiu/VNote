import { useState } from "react";
import { Tag, X, Plus } from "lucide-react";
import type { Task, TaskList, Category } from "@shared/types";

interface Props {
  task: Task;
  list?: TaskList;
  categories: Category[];
  /** Whether the task is in today's My Day. */
  inMyDay: boolean;
  onAddToMyDay: () => void;
  onRemoveFromMyDay: () => void;
  onTagsChange: (tags: string[]) => void;
}

/** Read/write meta section showing list, tags, category, and My Day status. */
export function MetaSection({ task, list, categories, inMyDay, onAddToMyDay, onRemoveFromMyDay, onTagsChange }: Props) {
  const [newTag, setNewTag] = useState("");
  const category = categories.find((c) => c.id === task.categoryId);

  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/^#/, "");
    if (!tag) return;
    const updated = Array.from(new Set([...task.tags, tag]));
    onTagsChange(updated);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    onTagsChange(task.tags.filter((t) => t !== tag));
  };

  return (
    <section className="detail-block">
      <div className="detail-subtitle">Meta</div>

      <div className="meta-line">
        <span>List</span>
        <span>{list?.name ?? "-"}</span>
      </div>

      <div className="meta-line">
        <span>Category</span>
        <span>
          {category ? (
            <span className="badge" style={{ background: category.color + "20", color: category.color }}>
              {category.name}
            </span>
          ) : "-"}
        </span>
      </div>

      <div className="meta-line">
        <span>My Day</span>
        <button className="text-button" onClick={inMyDay ? onRemoveFromMyDay : onAddToMyDay}>
          {inMyDay ? "Remove" : "Add"}
        </button>
      </div>

      <div className="meta-block">
        <span>Tags</span>
        <div className="tag-list">
          {task.tags.map((tag) => (
            <span key={tag} className="badge tag-chip">
              <Tag size={12} />
              {tag}
              <button className="tag-remove" onClick={() => removeTag(tag)} title={`Remove #${tag}`}>
                <X size={10} />
              </button>
            </span>
          ))}
          <div className="tag-add-wrap">
            <input
              className="tag-input"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTag();
              }}
            />
            <button className="icon-button-small" onClick={addTag} title="Add tag">
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
