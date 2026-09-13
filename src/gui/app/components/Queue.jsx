// `src/gui/app/components/Queue.jsx`

"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { LoaderSpinner } from "../components/LoaderSpinner";
import { QueueCard } from "../components/QueueCard";
import { useAppStore } from "../stores/appStore";
import { useSelectionStore } from "../stores/selectionStore";

const itemKey = (item) => item?.[3]?.db_id ?? item?.[1];

const QueueItems = memo(function QueueItems({ running, pending, info }) {
  const route = useAppStore((state) => state.route);
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
            route={route}
            filters={filters}
            isSelected={selected.has(key)}
            onSelect={handleSelect}
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
            route={route}
            filters={filters}
            isSelected={selected.has(key)}
            onSelect={handleSelect}
            itemKey={key}
          />
        );
      })}
    </>
  );
});

export const Queue = memo(function Queue({ data, isLoading, error, progress }) {
  const running = data?.running ?? [];
  const pending = data?.pending ?? [];

  return (
    <div
      className={"overflow-x-auto table-wrapper" + (isLoading ? " loading" : "")}
      style={{ "--job-progress": progress + "%" }}
    >
      <div className={"table-container"}>
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
