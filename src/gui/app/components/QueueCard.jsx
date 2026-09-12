// `src/gui/app/components/QueueCard.jsx`
"use client";

import React, { memo, useCallback, useContext, useMemo } from "react";
import { apiCall, msgLoadWorkflow } from "../internals/functions";
import { AppContext } from "../internals/app-context";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import { LoaderSpinner } from "../components/LoaderSpinner";
import {useAppStore} from "@/app/stores/appStore";
import { MediaItem, viewURL } from "./MediaItem";
import { MediaOutputs } from "../models/MediaOutputs";

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
  }) {
    const { fetchQueueItems } = useContext(AppContext);

    const dbId = item?.[3]?.db_id;
    const workflow = item?.[3]?.extra_pnginfo?.workflow;

    const cancelQueueItem = useCallback(async () => {
      const cancelRoute = mode === "running" || mode === "external" ? "interrupt" : "queue";
      await apiCall(`api/${cancelRoute}`, { delete: [item[1]] });
    }, [mode, item]);

    const loadQueueItem = useCallback(() => {
      if (workflow) {
        msgLoadWorkflow(workflow, item[0]);
      }
    }, [workflow, item]);

    const archiveQueueItem = useCallback(async () => {
      await apiCall(`queue_manager/archive`, { archive: [dbId] });
    }, [dbId]);

    const playItem = useCallback(async () => {
      const { shiftDown, clientId } = useAppStore.getState();

      await apiCall(`queue_manager/play`, {
        items: [dbId],
        front: shiftDown === true,
        clientId,
      });
    }, [dbId]);

    const filterByWorkflow = useCallback(() => {
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

    return (
      <article className={`qm-card${className ? ` ${className}` : ""}`}>
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
            <div className="execution-time" title="Execution time">
              {executionTimeLabel}
            </div>
          ) : null}

          {mediaOutputs.total > 0 ? (
            <span className="qm-badge" title="Output count">
              {mediaOutputs.total}
            </span>
          ) : null}
        </div>

        <div className="card-body">
          <div className="card-info" />

          <div className="card-outputs">
            {route === "completed" && mediaOutputs.total > 0 && (
              <div className="outputs">
                {mediaOutputs.files.map((file, idx) => (
                  <MediaItem
                    key={idx}
                    file={file}
                    onClick={() => handleThumbnailClick(file)}
                    controls={false}
                    autoplay={false}
                    className="thumbnail"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card-actions">
          <div style={{ justifyContent: "flex-end" }} className="buttons">
            <button
              className="delete qm-btn qm-btn-danger"
              onClick={cancelQueueItem}
              title="Delete workflow from queue"
            >
              Delete
            </button>

            {mode !== "external" ? (
              <button
                className="load qm-btn qm-btn-primary"
                onClick={loadQueueItem}
                title="Load workflow"
              >
                Load
              </button>
            ) : null}

            {route === "queue" && mode !== "running" ? (
              <button
                className="archive qm-btn"
                onClick={archiveQueueItem}
                title="Move to the archive"
              >
                Archive
              </button>
            ) : null}

            {route === "archive" ? (
              <button
                className="run qm-btn qm-btn-primary"
                onClick={playItem}
                title="Move to queue"
              >
                <PlayArrowOutlinedIcon fontSize="small" />
                Run
              </button>
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
      prev.info?.page === next.info?.page &&
      prev.info?.page_size === next.info?.page_size
    );
  }
);
