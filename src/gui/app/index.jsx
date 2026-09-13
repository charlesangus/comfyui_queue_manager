"use client";

import UploadSharpIcon from '@mui/icons-material/UploadSharp';

import TopMenu from "./components/TopMenu";
import {Queue} from "./components/Queue";
import {Footer} from "./components/Footer";
import {SelectionBar} from "./components/SelectionBar";
import { useEffect, useState, useCallback, useMemo, useRef} from "react";
import {apiCall} from "./internals/functions";
import useEvent from "react-use-event-hook";
import {AppContext} from "./internals/app-context";
import {SplashScreen} from "./components/SplashScreen";

import {compareVersions} from "./internals/functions";
import {performDelete} from "./internals/deleteUtils";
import {useOptionsStore} from "./stores/optionsStore";
import {useAppStore} from "./stores/appStore";
import {useSelectionStore} from "./stores/selectionStore";
import {LoaderSpinner} from "@/app/components/LoaderSpinner";
import {useComfyTheme} from "./hooks/useComfyTheme";
import {useParentMessages} from "./hooks/useParentMessages";
import {useQueue} from "./hooks/useQueue";

const itemKey = (item) => item?.[3]?.db_id ?? item?.[1];

export default function Home({ onDarkChange }) {
  const options = useOptionsStore((state) => state);
  const pageSize = useOptionsStore((state) => state.Basic.PageSize);
  const previousPageSizeRef = useRef(pageSize);
  const completedListOrder = useOptionsStore((state) => state.Completed.ListOrder);
  const previousListOrderRef = useRef(completedListOrder);
  const setAllOptions = useOptionsStore((state) => state.setAllOptions);

  const filters = useAppStore((state) => state.filters);
  const route = useAppStore((state) => state.route);
  const shiftDown = useAppStore((state) => state.shiftDown);

  const setShiftDown = useAppStore((state) => state.setShiftDown);

  const [showSplash, setShowSplash] = useState(false);

  useComfyTheme(onDarkChange);

  const queryKey = useMemo(() => {
    const f = filters ? JSON.stringify(filters) : "";
    const order = route === "completed" ? String(completedListOrder ?? "") : "";
    return `${route}|${f}|${order}`;
  }, [route, filters, completedListOrder]);
  const lastQueryKeyRef = useRef(null);

  const fetchOptions = useCallback(async () => {
    const newOptions = await apiCall(`queue_manager/options`, null, "GET");
    if (newOptions) {
      setAllOptions({ ...newOptions });

      // show splash screen if needed
      if (compareVersions(newOptions.splash_screen, newOptions.__version__) < 0) {
        setShowSplash(true);
      }
    } else {
      console.error("Failed to fetch options");
    }
  }, [setAllOptions]);

  const {
    data: queueData,
    isLoading: queueIsLoading,
    isReloading: queueIsReloading,
    error: queueError,
    progress: queueProgress,
    fetchQueueItems,
    isFilterOn,
    appendFilters,
    appendRoute,
    onQueueStatusUpdated,
  } = useQueue({ fetchOptions });

  useEffect(() => {
    useSelectionStore.getState().clear();
  }, [route, filters]);

  useEffect(() => {
    if (!queueData) return;

    const items = [...(queueData.running ?? []), ...(queueData.pending ?? [])];
    const currentKeys = items.map((item) => item?.[3]?.db_id ?? item?.[1]);
    useSelectionStore.getState().retain(currentKeys);
  }, [queueData]);

  useEffect(() => {
    const pageSizeChanged = pageSize !== previousPageSizeRef.current;
    const listOrderChanged = completedListOrder !== previousListOrderRef.current;
    previousPageSizeRef.current = pageSize;
    previousListOrderRef.current = completedListOrder;

    // Both settings change which jobs belong on each page.
    if (pageSizeChanged || (route === "completed" && listOrderChanged)) {
      fetchQueueItems({page: 0, reload: true});
    }
  }, [pageSize, completedListOrder, route, fetchQueueItems]);

  useParentMessages({ onQueueStatusUpdated });

  const openSplash = useEvent(() => {
    setShowSplash(true);
  });

  const appContextValue = useMemo(() => {
    return { openSplash, fetchQueueItems };
  }, [openSplash, fetchQueueItems]);

  const closeSplash = useEvent(event => {
    setShowSplash(false);
    if (!options.splash_screen || options.splash_screen !== options.__version__) {
      apiCall('queue_manager/options', {key:"splash_screen", value: true}, 'POST');
    }
  })

  useEffect(() => {
    if (!queueData) return;

    const handleKeyDown = (event) => {
      const isInputLike =
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable;

      if (event.key === 'Escape') {
        useSelectionStore.getState().clear();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
        if (!isInputLike) {
          event.preventDefault();
          const items = [...(queueData.running ?? []), ...(queueData.pending ?? [])];
          const orderedKeys = items.map(itemKey);
          useSelectionStore.getState().selectAll(orderedKeys);
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!isInputLike) {
          const selectedSize = useSelectionStore.getState().selected.size;
          if (selectedSize > 0) {
            let shouldDelete = true;
            if (selectedSize > 5) {
              shouldDelete = window.confirm(`Delete ${selectedSize} items?`);
            }
            if (shouldDelete) {
              const running = queueData?.running ?? [];
              const pending = queueData?.pending ?? [];
              const selected = useSelectionStore.getState().selected;
              const selectedRunning = running.filter((item) => selected.has(itemKey(item)));
              const selectedPending = pending.filter((item) => selected.has(itemKey(item)));
              performDelete(selectedRunning, selectedPending, fetchQueueItems);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueData, fetchQueueItems]);

  // on mount get the queue items from the server
  useEffect(() => {
    fetchQueueItems({route: "queue"});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchOptions sets state only after its internal await; the fetch itself must fire on mount
    fetchOptions();

    window.addEventListener('keydown', e => {
      if (e.key === "Shift") {
        setShiftDown(true);
      }
    });
    window.addEventListener('keyup', e => {
      if (e.key === "Shift") {
        setShiftDown(false);
      }
    });
  }, []);

  return (
    <div className={`route-${route} qm-container` + (queueIsLoading ? ' loading' : '') + (queueIsReloading ? ' reloading' : '')}>
      <header className="px-2 py-1 text-sm header font-bold">
        Queue Manager
        {queueIsLoading &&
          <LoaderSpinner />
        }
      </header>
      <AppContext.Provider value={appContextValue}>
        <TopMenu/>

        {/*
        *
        *  Tabs Nav
        *
        */}
        <div className={"tabs" + (shiftDown ? ' shift-down' : '')}>
          {/* Queue */}
          <button
            className={"tab queue" + (route === 'queue' ? ' active' : '')}
            onClick={() => {
              fetchQueueItems({route: "queue", reload: true});
            }}
          >Queue
          </button>

          {/* Archive */}
          <button
            className={"tab archive" + (route === 'archive' ? ' active' : '')}
            onClick={() => {
              fetchQueueItems({route: "archive", reload: true});
            }}
          >Archive
          </button>

          {/* Completed */}
          <button className={"tab completed" + (route === 'completed' ? ' active' : '')}
                  onClick={() => {
                    fetchQueueItems({route: "completed", reload: true});
                  }}
          >Completed
          </button>

          {shiftDown && route === "archive" &&
            <div className={"play-first"}>
              <UploadSharpIcon/> Press Run to queue at front
            </div>
          }
        </div>

        {/*
        *
        * Filters
        *
        */}
        {isFilterOn() &&
          <div className="filters flex items-center p-2">
            <h2>Filters:</h2>
            {Object.values(filters).map(filter =>
              <div className="filter flex items-center" key={filter.type}>
                <span
                  className="inline-flex close label" style={{ color: "var(--qm-fg-muted)" }}><span
                  className={'type'}>{filter.type + ": "}&nbsp;</span>{filter.valueLabel}</span>
                <button
                  className="qm-btn qm-btn-text qm-icon-btn close"
                  onClick={() => {
                    // remove the filter from the filters object
                    const prev = useAppStore.getState().filters;
                    const newFilters = (({[filter.type]: _, ...f}) => f)(prev);
                    fetchQueueItems({filters: newFilters})
                  }}
                >
                  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em">
                    <path fill="currentColor"
                          d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"></path>
                  </svg>
                </button>
              </div>
            )}

            {/*  Clear all  */}
            <button
              className="close close-all ml-auto qm-btn qm-btn-text"
              onClick={() => {
                fetchQueueItems({filters: {}});
              }}
            >
              <svg viewBox="0 0 24 24" width="1.2em" height="1.2em">
                <path fill="currentColor"
                      d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"></path>
              </svg>
              Clear filters
            </button>
          </div>
        }

        {/*
        *
        * Queue items table
        *
        */}
        <div className={'queue-table'}>
          <Queue data={queueData}
                 error={queueError}
                 isLoading={queueIsLoading}
                 progress={queueProgress}
                 route={route}
          />
        </div>

        <SelectionBar
          route={route}
          queueData={queueData}
          fetchQueueItems={fetchQueueItems}
        />

        <Footer
          route={route}
          queueData={queueData}
          isFilterOn={isFilterOn}
          appendFilters={appendFilters}
          appendRoute={appendRoute}
          fetchQueueItems={fetchQueueItems}
        />
        {showSplash &&
          <SplashScreen onClick={closeSplash}/>
        }
      </AppContext.Provider>
    </div>
  );
}
