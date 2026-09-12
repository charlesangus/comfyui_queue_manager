// `src/gui/app/components/Queue.jsx`

"use client";

import React, { memo } from "react";
import { LoaderSpinner } from "../components/LoaderSpinner";
import { QueueCard } from "../components/QueueCard";
import { useAppStore } from "../stores/appStore";

const QueueItems = memo(function QueueItems({ running, pending, info }) {
  const route = useAppStore((state) => state.route);
  const filters = useAppStore((state) => state.filters);

  return (
    <>
      {running.map((item) => (
        <QueueCard
          key={item?.[3]?.db_id ?? item?.[1]}
          item={item}
          className="running"
          loader={true}
          mode={item?.[3]?.extra_pnginfo ? "running" : "external"}
          info={info}
          route={route}
          filters={filters}
        />
      ))}

      {pending.map((item, index) => (
        <QueueCard
          key={item?.[3]?.db_id ?? `${item?.[1]}-${index}`}
          item={item}
          className="pending"
          index={index}
          info={info}
          route={route}
          filters={filters}
        />
      ))}
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
