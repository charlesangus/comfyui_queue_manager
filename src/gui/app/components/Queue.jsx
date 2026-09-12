// `src/gui/app/components/Queue.jsx`

"use client";

import React, { memo } from "react";
import { LoaderSpinner } from "../components/LoaderSpinner";
import { QueueItemRow } from "../components/QueueItemRow";
import { useAppStore } from "../stores/appStore";

const QueueItems = memo(function QueueItems({ running, pending, info }) {
  // Read global state ONCE here (parent of many rows)
  const route = useAppStore((state) => state.route);
  const filters = useAppStore((state) => state.filters);

  return (
    <>
      {running.map((item) => (
        <QueueItemRow
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
        <QueueItemRow
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

// take items from parent component
export const Queue = memo(function Queue({ data, isLoading, error, progress }) {
  const route = useAppStore((state) => state.route);

  const running = data?.running ?? [];
  const pending = data?.pending ?? [];

  return (
    <div
      className={"overflow-x-auto table-wrapper" + (isLoading ? " loading" : "")}
      style={{ "--job-progress": progress + "%" }}
    >
      <div className={"table-container"}>
        <>
          <table className="min-w-full border border-0">
            <thead className="text-xs uppercase" style={{ backgroundColor: "var(--qm-surface)" }}>
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left workflow-column">
                  Workflow
                </th>
                {route === "completed" &&
                  <th className="px-3 py-2 text-left">
                    Info
                  </th>
                }
                <th className="px-3 py-2" align="right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {error && (
                <tr>
                  <td colSpan={100} className="text-red-500 text-center info-cell">
                    Loading failed: {error}
                  </td>
                </tr>
              )}

              {!isLoading && (!data || (!running.length && !pending.length)) && (
                <tr>
                  <td colSpan={100} className="italic text-center info-cell" style={{ color: "var(--qm-fg-muted)" }}>
                    No items.
                  </td>
                </tr>
              )}

              {isLoading && !data && (
                <tr>
                  <td className="px-3 py-1 serial">
                    <LoaderSpinner />
                  </td>
                  <td colSpan={100} className="italic text-center info-cell" style={{ color: "var(--qm-fg-muted)" }}>
                    Loading...
                  </td>
                </tr>
              )}

              {data && <QueueItems running={running} pending={pending} info={data.info} />}
            </tbody>
          </table>
        </>
      </div>
    </div>
  );
});
