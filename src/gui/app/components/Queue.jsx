// `src/gui/app/components/Queue.jsx`

"use client";

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LoaderSpinner } from "../components/LoaderSpinner";
import { QueueCard } from "../components/QueueCard";
import { Lightbox } from "./Lightbox";
import { MediaOutputs } from "../models/MediaOutputs";
import { useAppStore } from "../stores/appStore";
import { useSelectionStore } from "../stores/selectionStore";

const itemKey = (item) => item?.[3]?.db_id ?? item?.[1];

const QueueItems = memo(function QueueItems({ running, pending, info }) {
  const filters = useAppStore((state) => state.filters);
  const selected = useSelectionStore((state) => state.selected);

  const orderedKeys = useMemo(
    () => [...running, ...pending].map(itemKey),
    [running, pending]
  );

  // Kept in a ref (rather than a `handleSelect` dependency) so this stable
  // callback always sees the latest ordered keys without changing identity,
  // which would otherwise defeat QueueCard's memo comparator.
  const orderedKeysRef = useRef(orderedKeys);
  useEffect(() => {
    orderedKeysRef.current = orderedKeys;
  }, [orderedKeys]);

  const handleSelect = useCallback((key, event) => {
    if (event.shiftKey) {
      useSelectionStore.getState().selectRange(orderedKeysRef.current, key);
    } else if (event.ctrlKey || event.metaKey) {
      useSelectionStore.getState().toggle(key);
    } else {
      useSelectionStore.getState().select(key);
    }
  }, []);

  // Every output on the page in card order, so the lightbox can step from one job's outputs into the next.
  const media = useMemo(
    () => [...running, ...pending].flatMap((item) =>
      new MediaOutputs(item?.[3]).files.map((file, fileIndex) => ({ file, key: itemKey(item), fileIndex }))
    ),
    [running, pending]
  );

  // Tracked by job and file rather than by position, so a refetch that shifts the page doesn't swap the image.
  const [lightbox, setLightbox] = useState(null);
  const handleOpenMedia = useCallback((key, fileIndex) => setLightbox({ key, fileIndex }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const lightboxIndex = lightbox
    ? media.findIndex((entry) => entry.key === lightbox.key && entry.fileIndex === lightbox.fileIndex)
    : -1;

  return (
    <>
      {running.map((item) => {
        const key = itemKey(item);
        return (
          <QueueCard
            key={key}
            item={item}
            className="running"
            loader={true}
            mode={item?.[3]?.extra_pnginfo ? "running" : "external"}
            info={info}
            filters={filters}
            isSelected={selected.has(key)}
            onSelect={handleSelect}
            onOpenMedia={handleOpenMedia}
            itemKey={key}
          />
        );
      })}

      {pending.map((item, index) => {
        const key = itemKey(item);
        return (
          <QueueCard
            key={item?.[3]?.db_id ?? `${item?.[1]}-${index}`}
            item={item}
            className="pending"
            index={index}
            info={info}
            filters={filters}
            isSelected={selected.has(key)}
            onSelect={handleSelect}
            onOpenMedia={handleOpenMedia}
            itemKey={key}
          />
        );
      })}

      {lightboxIndex !== -1 ? (
        <Lightbox
          files={media.map((entry) => entry.file)}
          index={lightboxIndex}
          onIndexChange={(index) => setLightbox(media[index])}
          onClose={closeLightbox}
        />
      ) : null}
    </>
  );
});

export const Queue = memo(function Queue({ data, isLoading, error, progress, route }) {
  const running = data?.running ?? [];
  const pending = data?.pending ?? [];

  // The browser's own scroll anchoring is off for the list: when a priority change re-sorts it, React moves the
  // cards around and the native anchor gets lost, throwing the view to the top. Instead keep the first visible card
  // that is still listed with the same priority where it was on screen, so jobs starting, finishing or arriving
  // and cards above changing height don't shift the view, and a re-prioritized card simply moves out of it.
  const containerRef = useRef(null);
  const anchorsRef = useRef([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const items = [...(data?.running ?? []), ...(data?.pending ?? [])];
    const cards = container.getElementsByClassName("qm-card");
    const index = new Map(items.map((item, i) => [itemKey(item), i]));

    const restoreAnchor = () => {
      const anchor = anchorsRef.current.find((a) => a.route === route && index.has(a.key) && items[index.get(a.key)][3]?.priority === a.priority);
      if (anchor) {
        container.scrollTop += cards[index.get(anchor.key)].getBoundingClientRect().top - container.getBoundingClientRect().top - anchor.offset;
      }
      recordAnchors();
    };

    // Like native scroll anchoring, a list scrolled to the very top stays there so new jobs above show up.
    const recordAnchors = () => {
      anchorsRef.current = [];
      if (container.scrollTop === 0) return;
      const top = container.getBoundingClientRect().top;
      const bottom = top + container.clientHeight;
      for (let i = 0; i < items.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (rect.bottom <= top) continue;
        if (rect.top >= bottom) break;
        anchorsRef.current.push({ route, key: itemKey(items[i]), priority: items[i][3]?.priority, offset: rect.top - top });
      }
    };

    restoreAnchor();
    container.addEventListener("scroll", recordAnchors, { passive: true });
    // Covers cards reflowing on a panel resize, which changes heights above the view without a data update.
    const observer = new ResizeObserver(restoreAnchor);
    observer.observe(container.firstElementChild);
    return () => {
      container.removeEventListener("scroll", recordAnchors);
      observer.disconnect();
    };
  }, [data, route]);

  return (
    <div
      className={"overflow-x-auto table-wrapper" + (isLoading ? " loading" : "")}
      style={{ "--job-progress": progress + "%" }}
    >
      <div className={"table-container"} ref={containerRef}>
        <div className="qm-cards">
          {error && (
            <div className="info-cell text-red-500 text-center">
              Loading failed: {error}
            </div>
          )}

          {!isLoading && (!data || (!running.length && !pending.length)) && (
            <div className="info-cell italic text-center" style={{ color: "var(--qm-fg-muted)" }}>
              No items.
            </div>
          )}

          {isLoading && !data && (
            <div className="info-cell italic text-center" style={{ color: "var(--qm-fg-muted)" }}>
              <LoaderSpinner /> Loading...
            </div>
          )}

          {data && <QueueItems running={running} pending={pending} info={data.info} />}
        </div>
      </div>
    </div>
  );
});
