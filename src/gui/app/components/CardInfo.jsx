"use client";

import { useState } from "react";
import { MediaItem } from "./MediaItem";
import { baseURL } from "../internals/config";

function TextTile({ label, value }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      if (event.key === " ") event.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div
      className={`card-info-tile${expanded ? " expanded" : ""}`}
      title={value}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
    >
      <div className="tile-caption">{label}</div>
      <div className="tile-body">{value}</div>
    </div>
  );
}

function ImageTile({ label, value }) {
  return (
    <div className="card-info-tile">
      {value?.filename ? (
        <MediaItem file={value} controls={false} autoplay={false} className="tile-media" />
      ) : (
        <img src={baseURL + value?.url} className="tile-media" alt={label} />
      )}
      <div className="tile-caption">{label}</div>
    </div>
  );
}

function OtherTile({ label, value }) {
  return (
    <div className="card-info-tile">
      <div className="tile-caption">{label}</div>
      <div className="tile-body">{String(value)}</div>
    </div>
  );
}

export function CardInfo({ entries }) {
  if (!entries?.length) return null;

  const sorted = [...entries].sort((a, b) => a.index - b.index);
  const occurrences = new Map();

  return sorted.map((entry) => {
    const identity = JSON.stringify([entry.index, entry.label]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const key = JSON.stringify([entry.index, entry.label, occurrence]);
    if (entry.kind === "image") {
      return <ImageTile key={key} label={entry.label} value={entry.value} />;
    }
    if (entry.kind === "text") {
      return <TextTile key={key} label={entry.label} value={entry.value} />;
    }
    return <OtherTile key={key} label={entry.label} value={entry.value} />;
  });
}
