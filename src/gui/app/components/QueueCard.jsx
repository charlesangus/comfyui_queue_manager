"use client";

import React, { memo, useCallback, useContext, useMemo } from "react";
import { AppContext } from "../internals/app-context";
import { LoaderSpinner } from "../components/LoaderSpinner";
import { MediaItem, viewURL } from "./MediaItem";
import { MediaOutputs } from "../models/MediaOutputs";
import { CardInfo } from "./CardInfo";

export const QueueCard = memo(
  function QueueCard({
    item,
    className,
    loader,
    index,
    mode,
    info,

    route,
    filters,
    isSelected,
    onSelect,
    itemKey,
  }) {
    const { fetchQueueItems } = useContext(AppContext);

    const workflow = item?.[3]?.extra_pnginfo?.workflow;

    const filterByWorkflow = useCallback((event) => {
      event.stopPropagation();
      if (!workflow?.id) return;

      fetchQueueItems({
        filters: {
          ...filters,
          workflow: {
            type: "workflow",
            value: workflow.id,
            valueLabel: workflow.workflow_name,
          },
        },
      });
    }, [fetchQueueItems, filters, workflow]);

const executionTimeLabel = useMemo(() => {
  const t = item?.[3]?.execution_time;
  if (t == null) return null;

  const rawSeconds = Number(t);
  if (!Number.isFinite(rawSeconds) || rawSeconds < 0) return null;

  const totalSeconds = rawSeconds >= 60 ? Math.round(rawSeconds) : rawSeconds;

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const secondsLabel = rawSeconds >= 60 ? `${seconds}s` : `${seconds.toFixed(2)}s`;

  if (days > 0) return ` ${days}d ${hours}h ${minutes}m ${secondsLabel}`;
  if (hours > 0) return ` ${hours}h ${minutes}m ${secondsLabel}`;
  if (minutes > 0) return ` ${minutes}m ${secondsLabel}`;
  return ` ${rawSeconds.toFixed(2)}s`;
}, [item?.[3]?.execution_time]);

    const rowIndex =
      index === undefined || !info ? "" : index + 1 + info.page * info.page_size;

    const mediaOutputs = useMemo(() => new MediaOutputs(item?.[3]), [item]);

    const handleThumbnailClick = useCallback((file) => {
      window.open(viewURL(file), "_blank");
    }, []);

    const error = item?.[3]?.status === -1 ? item?.[3]?.error : null;
    const priority = item?.[3]?.priority;

    const priorityBadge = useMemo(() => {
      if (!priority) return null;

      if (priority === 1000) {
        return {
          className: "priority-interactive",
          label: "Interactive",
          title: "Interactive: this job jumped the queue because it was run directly from the canvas",
        };
      }

      if (priority === 999) {
        return {
          className: "priority-resumed",
          label: "Resumed",
          title: "Resumed: this job was interrupted to let an interactive run through, and will run again next",
        };
      }

      return {
        className: priority > 0 ? "priority-positive" : "priority-negative",
        label: priority > 0 ? `+${priority}` : `${priority}`,
        title: `Priority ${priority > 0 ? "+" : ""}${priority}`,
      };
    }, [priority]);

    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/role-supports-aria-props -- card selection is mouse-driven only, matching the existing filters/thumbnail interactions in this file
      <article
        className={`qm-card${error ? " failed" : ""}${className ? ` ${className}` : ""}${isSelected ? " selected" : ""}`}
        aria-selected={isSelected}
        onClick={(event) => onSelect(itemKey, event)}
      >
        <div className="card-header">
          <span className="serial">{rowIndex}</span>
          {loader ? <LoaderSpinner /> : null}

          <div className="name-cell">
            <button className="plain" onClick={filterByWorkflow} title="Filter view by the workflow">
              {mode === "external"
                ? "External job"
                : workflow?.workflow_name
                  ? workflow.workflow_name
                  : ""}
            </button>
          </div>

          {route === "completed" && executionTimeLabel ? (
            <div className="qm-badge execution-time" title="Execution time">
              {executionTimeLabel}
            </div>
          ) : null}

          {priorityBadge ? (
            <span
              className={`qm-badge priority-badge ${priorityBadge.className}`}
              title={priorityBadge.title}
            >
              {priorityBadge.label}
            </span>
          ) : null}

          {error ? (
            <span
              className={`qm-badge ${error.kind === "interrupted" ? "qm-badge-warning" : "qm-badge-danger"}`}
              title="Job outcome"
            >
              {error.kind === "interrupted" ? "Interrupted" : "Error"}
            </span>
          ) : null}

          {mediaOutputs.total > 0 ? (
            <span className="qm-badge" title="Output count">
              {mediaOutputs.total}
            </span>
          ) : null}
        </div>

        <div className="card-body">
          <div className="card-info">
            <CardInfo entries={item?.[3]?.card} />
          </div>

          <div className="card-outputs">
            {route === "completed" && mediaOutputs.total > 0 && (
              <div className="outputs">
                {mediaOutputs.files.map((file, idx) => (
                  <MediaItem
                    key={idx}
                    file={file}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleThumbnailClick(file);
                    }}
                    controls={false}
                    autoplay={false}
                    className="thumbnail"
                  />
                ))}
              </div>
            )}

            {error ? (
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stops the details toggle from also triggering card selection
              <details className="error-details" onClick={(event) => event.stopPropagation()}>
                <summary>{error.kind === "interrupted" ? "Interrupted" : "Error"} details</summary>
                {error.message ? <p className="error-message">{error.message}</p> : null}
                <p className="error-node">
                  {error.node_type} #{error.node_id}
                </p>
                {error.traceback ? <pre className="error-traceback">{error.traceback.join("\n")}</pre> : null}
              </details>
            ) : null}
          </div>
        </div>
      </article>
    );
  },
  (prev, next) => {
    const prevId = prev.item?.[3]?.db_id;
    const nextId = next.item?.[3]?.db_id;
    if (prevId !== nextId) return false;

    return (
      prev.loader === next.loader &&
      prev.index === next.index &&
      prev.mode === next.mode &&
      prev.route === next.route &&
      prev.filters === next.filters &&
      prev.isSelected === next.isSelected &&
      prev.onSelect === next.onSelect &&
      prev.itemKey === next.itemKey &&
      prev.info?.page === next.info?.page &&
      prev.info?.page_size === next.info?.page_size &&
      prev.item?.[3]?.card === next.item?.[3]?.card &&
      prev.item?.[3]?.priority === next.item?.[3]?.priority
    );
  }
);
