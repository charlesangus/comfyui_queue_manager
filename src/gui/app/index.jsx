"use client";

import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import DeleteOutlineSharpIcon from "@mui/icons-material/DeleteOutlineSharp";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import UploadSharpIcon from '@mui/icons-material/UploadSharp';
import Inventory2SharpIcon from '@mui/icons-material/Inventory2Sharp';
import { styled } from '@mui/material/styles';

import TopMenu from "./components/TopMenu";
import {Queue} from "./components/Queue";
import Stack from "@mui/material/Stack";
import {baseURL} from "./internals/config";
import { useEffect, useState, useCallback, useMemo, useRef} from "react";
import {apiCall} from "./internals/functions";
import useEvent from "react-use-event-hook";
import {AppContext} from "./internals/app-context";
import {SplashScreen} from "./components/SplashScreen";

import {compareVersions} from "./internals/functions";
import {useOptionsStore} from "./stores/optionsStore";
import {useAppStore} from "./stores/appStore";
import {MenuItem, Pagination, Select} from "@mui/material";
import {LoaderSpinner} from "@/app/components/LoaderSpinner";
import {useComfyTheme} from "./hooks/useComfyTheme";
import {useParentMessages} from "./hooks/useParentMessages";
import {useQueue} from "./hooks/useQueue";

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

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
    const pageSizeChanged = pageSize !== previousPageSizeRef.current;
    const listOrderChanged = completedListOrder !== previousListOrderRef.current;
    previousPageSizeRef.current = pageSize;
    previousListOrderRef.current = completedListOrder;

    // Both settings change which jobs belong on each page.
    if (pageSizeChanged || (route === "completed" && listOrderChanged)) {
      fetchQueueItems({page: 0, reload: true});
    }
  }, [pageSize, completedListOrder, route, fetchQueueItems]);

  async function archiveAll() {
    try {
      let queryArgs = appendFilters("");

      const response = await fetch(`${baseURL}queue_manager/archive-queue${queryArgs}`);
    } catch (error) {
      console.error("Error fetching queue items:", error);
    }
  }

  async function playAllArchive() {
    await apiCall('queue_manager/play-archive', {
      client_id: useAppStore.getState().clientId,
      filters: isFilterOn() ? filters : null,
      front: useAppStore.getState().shiftDown === true
    })
  }

  async function deleteFromQueue() {
    let queryArgs = appendFilters("?route=" + route);

    try {
      const response = await fetch(`${baseURL}queue_manager/queue${queryArgs}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error(`Error deleting items from ${route}:`, error);
    }
  }

  async function clearPending() {
    try {
        // POST {"clear":true} to /api/queue
        const response = await fetch(`${baseURL}api/queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({clear: true})
        });
      } catch (error) {
        console.error("Error fetching queue items:", error);
      }
  }

  useParentMessages({ onQueueStatusUpdated });

  const uploadQueue = useEvent( async (e) => {
    // if empty value then bounce
    if (!e.target.files || !e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];


    const formData = new FormData();
    formData.append("queue_json", file);
    formData.append("client_id", useAppStore.getState().clientId);

    const comfyApiKey = localStorage.getItem("comfy_api_key");
    if (comfyApiKey) {
      formData.append("api_key_comfy_org", comfyApiKey);
    }

    if (route === 'archive') {
      formData.append("archive", true);
    }


    try {
      const response = await fetch(`${baseURL}queue_manager/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      console.log("Queue imported successfully", data);

      e.target.value = "";

    } catch (error) {
      console.error("Error importing queue:", error);
    }
  });

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

        {/*
        *
        * Footer with paging and actions
        *
        */}
        <footer className={"footer"}>
          {/* Paging */}
          {queueData && queueData.info && (queueData.info.last_page > 0) &&
            <>
              <div className={"pagination"}>
                <Pagination
                  shape="rounded"
                  variant="outlined"
                  boundaryCount={2}
                  siblingCount={2}
                  page={queueData.info.page + 1}
                  onChange={(event, value) => {
                    fetchQueueItems({page:value -1, reload: true});
                  }}
                  count={queueData.info.last_page + 1}></Pagination>

                {/* If more than 11 pages show page selector */}
                {queueData.info.last_page > 10 &&
                  <div className="page-selector">
                    <Select
                      value={queueData.info.page}
                      onChange={(event) => {
                        const pageNum = event.target.value;
                        fetchQueueItems({page:pageNum, reload: true});
                      }}
                      size="small"
                    >
                      {[...Array(queueData.info.last_page + 1).keys()].map((pageNum) => (
                        <MenuItem
                          key={pageNum}
                          value={pageNum}
                        >
                          {pageNum + 1}
                        </MenuItem>
                      ))}
                    </Select>
                  </div>
                }
              </div>


            </>

          }

          {/* Footer Actions */}
          <div className="p-2 flex actions">
            <Stack direction="row" spacing={1} className={'min-w-full buttons'}>
              {queueData && (queueData.running.length > 0 || queueData.pending.length > 0) &&
                <>


                  {/* Queue Actions  */}
                  {route === 'queue' &&
                    <>
                      <button onClick={archiveAll} className={"qm-btn"}>
                        <Inventory2SharpIcon/>&nbsp;
                        Archive All {isFilterOn() ? "*" : "Pending"}
                      </button>
                      <a className={"qm-btn"}
                              href={baseURL + "queue_manager/export" + appendRoute(appendFilters(""))}>
                        <FileDownloadOutlinedIcon/>&nbsp;&nbsp;Export {isFilterOn() ? "*" : "Queue"}
                      </a>
                      <button color="error" onClick={isFilterOn() ? deleteFromQueue : clearPending}
                              className={"order-last delete qm-btn qm-btn-danger"} >
                        <DeleteOutlineSharpIcon/>&nbsp;&nbsp;Delete All {isFilterOn() ? "*" : "Pending"}
                      </button>
                    </>
                  }

                  {/* Archive Actions */}
                  {route === 'archive' &&
                    <>
                      <button onClick={playAllArchive}
                              className="qm-btn qm-btn-primary">
                        <PlayArrowOutlinedIcon/>&nbsp;&nbsp;Run All {isFilterOn() ? "*" : ""}
                      </button>
                      <a className={"qm-btn"}
                              href={baseURL + "queue_manager/export" + appendFilters("?route=archive")}>
                        <FileDownloadOutlinedIcon/>&nbsp;&nbsp;Export {isFilterOn() ? "*" : "Archive"}
                      </a>
                      <button onClick={deleteFromQueue}
                              className={"delete order-last qm-btn qm-btn-danger"}>
                        <DeleteOutlineSharpIcon/>&nbsp;&nbsp;Delete {isFilterOn() ? "All *" : "All Archive"}
                      </button>
                    </>
                  }

                  {/* Completed Actions */}
                  {route === 'completed' &&
                    <>
                      <a className={"qm-btn"}
                              href={baseURL + "queue_manager/export" + appendFilters("?route=completed")}>
                        <FileDownloadOutlinedIcon/>&nbsp;&nbsp;Export {isFilterOn() ? "*" : "Completed Jobs"}
                      </a>
                      <button onClick={deleteFromQueue}
                              className={"order-last delete qm-btn qm-btn-danger"}>
                        <DeleteOutlineSharpIcon/>&nbsp;&nbsp;Delete {isFilterOn() ? "All *" : "All Completed Jobs"}
                      </button>
                    </>
                  }
                </>
              }

              {['queue', 'archive'].includes(route) &&
                <form
                  method="post"
                  encType="multipart/form-data"
                  className={"import-form"}
                >
                  <label className="qm-btn">
                    <DriveFolderUploadOutlinedIcon/>&nbsp;&nbsp;Import {route === 'queue' ? 'Queue' : 'Archive'}
                    <VisuallyHiddenInput
                      type="file"
                      onChange={uploadQueue}
                      multiple
                      name="queue_json"
                      accept=".json"
                      required
                    />
                  </label>
                </form>
              }

            </Stack>
          </div>
        </footer>
        {showSplash &&
          <SplashScreen onClick={closeSplash}/>
        }
      </AppContext.Provider>
    </div>
  );
}
