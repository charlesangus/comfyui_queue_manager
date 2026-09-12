"use client";

import { useState } from "react";
import { MediaItem } from "./MediaItem";
import { baseURL } from "../internals/config";

function TextTile({ label, value }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card-info-tile${expanded ? " expanded" : ""}`}
      title={value}
      onClick={() => setExpanded((prev) => !prev)}
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

  return sorted.map((entry) => {
    if (entry.kind === "image") {
      return <ImageTile key={entry.index} label={entry.label} value={entry.value} />;
    }
    if (entry.kind === "text") {
      return <TextTile key={entry.index} label={entry.label} value={entry.value} />;
    }
    return <OtherTile key={entry.index} label={entry.label} value={entry.value} />;
  });
}
