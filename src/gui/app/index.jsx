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
import Button from "@mui/material/Button";
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

export default function Home() {
  const [appStatus, setAppStatus] = useState({
    loading: true,
    reloading: false,
    error: null,
    queue: null,
  });

  const options = useOptionsStore((state) => state);
  const pageSize = useOptionsStore((state) => state.Basic.PageSize);
  const previousPageSizeRef = useRef(pageSize);
  const completedListOrder = useOptionsStore((state) => state.Completed.ListOrder);
  const previousListOrderRef = useRef(completedListOrder);
  const setAllOptions = useOptionsStore((state) => state.setAllOptions);
  const setOption = useOptionsStore((state) => state.setOption);

  const filters = useAppStore((state) => state.filters);
  const route = useAppStore((state) => state.route);
  const shiftDown = useAppStore((state) => state.shiftDown);

  const setFilters = useAppStore((state) => state.setFilters);
  const setRoute = useAppStore((state) => state.setRoute);
  const setShiftDown = useAppStore((state) => state.setShiftDown);

  const [currentJob, setProgress] = useState({
    id: null,
    nodes: {
      // [node_id]: string|boolean - true executed, node id - not executed
    },
    integrity: true, // false if events about workflow execution are received before the workflow data is loaded
    progress: 0.0,
  });

  const [showSplash, setShowSplash] = useState(false);

  const fetchIdRef = useRef(0);

  const queryKey = useMemo(() => {
    const f = filters ? JSON.stringify(filters) : "";
    const order = route === "completed" ? String(completedListOrder ?? "") : "";
    return `${route}|${f}|${order}`;
  }, [route, filters, completedListOrder]);
  const lastQueryKeyRef = useRef(null);


  const isFilterOn = useCallback(() => {
    return filters && Object.keys(filters).length > 0;
  }, [filters]);

  const appendFilters = useCallback((queryArgs, _filters) => {
    if (!_filters) {
      _filters = filters;
    }

    if (_filters && Object.keys(_filters).length > 0) {
      queryArgs += (queryArgs ? '&filters=' : '?filters=') + encodeURIComponent(JSON.stringify(_filters));
    }
    return queryArgs;
  }, [filters]);


  const appendRoute = useCallback((queryArgs, _route) => {
    if (!_route) {
      _route = route;
    }

    if (_route) {
      queryArgs += (queryArgs ? '&route=' : '?route=') + _route;
    }
    return queryArgs;
  }, [route]);

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

  const fetchQueueItems = useCallback(async ({page, route: requestedRoute, filters, reload = false} = {}) => {

    const fetchId = ++fetchIdRef.current;

    let queryArgs = "";
    if (page !== undefined && page !== null) queryArgs = `?page=${page}`;

    queryArgs = appendFilters(queryArgs, filters);
    queryArgs = appendRoute(queryArgs, requestedRoute);
    // Use the live value; ComfyUI may still be saving the setting on the server.
    if (pageSize !== undefined) {
      queryArgs += `${queryArgs ? '&' : '?'}page_size=${encodeURIComponent(pageSize)}`;
    }
    if ((requestedRoute || route) === "completed") {
      const order = completedListOrder === "Oldest first" ? "asc" : "desc";
      queryArgs += `${queryArgs ? '&' : '?'}order=${order}`;
    }

    setAppStatus((prev) => ({ ...prev, loading: true, error: null, reloading: reload }));

    try {
      const response = await fetch(`${baseURL}queue_manager/queue${queryArgs}`);
      if (!response.ok) throw new Error("Network response was not ok");

      const queue = await response.json();

      // If a newer fetch started after this one, ignore this response
      if (fetchId !== fetchIdRef.current) return;

      if (requestedRoute) {
        setRoute(requestedRoute);

        if (requestedRoute === "completed") {
          setTimeout(() => {
            fetchOptions();
          });
        }
      }

      if (filters) {
        setFilters(filters);
      }

      setAppStatus((prev) => ({ ...prev, loading: false, error: null, queue, reloading: false }));
    } catch (error) {
      if (fetchId !== fetchIdRef.current) return;

      setAppStatus((prev) => ({
        ...prev,
        loading: false,
        reloading: false,
        error: error?.message ?? String(error),
        queue: null,
      }));
      console.error(`Error fetching ${requestedRoute || route} items:`, error);
    }
  }, [appendFilters, appendRoute, fetchOptions, setFilters, setRoute, pageSize, completedListOrder, route]);

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

  function getNodeIDs(nodes) {
    const nodeIDs = {};
    for (const node of nodes) {
      if (node.id) {
        nodeIDs[node.id] = node.id;
      }
    }

    return nodeIDs;
  }

  function getTheJob(jobID, queue) {
    if (!queue) {
      return null;
    }

    // check if the job is running
    for (const item of queue.running) {
      if (item[1] === jobID) {
        return item;
      }
    }

    // check if the job is in the queue
    for (const item of queue.pending) {
      if (item[1] === jobID) {
        return item;
      }
    }

    return null;
  }

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

  const onQueueStatusUpdated = (event) => {

    switch (event.data.message.name) {
      case "status":
        if (route === 'queue' || route === 'completed') {
          fetchQueueItems((appStatus.queue && appStatus.queue.info) ? appStatus.queue.info.page : 0);
        }
        break;
      case "execution_start": {
          const {prompt_id} = event.data.message.detail;

          const theJob = getTheJob(prompt_id, appStatus.queue);

          if (theJob) {
            const nodeIDs = getNodeIDs(theJob[3].extra_pnginfo.workflow.nodes);
            // set the current job
            setProgress(prev => ({
              ...prev,
              id: prompt_id,
              nodes: nodeIDs,
              integrity: true
            }));

            break;
          }

          // set the current job with the prompt id and false integrity flag
          // we don't have the workflow data yet, so set integrity to false so we can pick up progress later when we get the workflow data
          setProgress(prev => ({...prev, id: prompt_id, integrity: false, nodes: {}}));
        }
        break;

      case 'execution_cached': {
          // set cached node ids as executed
          const {nodes} = event.data.message.detail; // array of node id strings

          if (!nodes || nodes.length === 0) {
            return;
          }

          const newNodes = {};
          for (const node of nodes) {
            newNodes[node] = true;
          }


          setProgress(prev => ({
            ...prev,
            nodes: {
              ...prev.nodes,
              ...newNodes
            }
          }));
        }
        break;

      case "executing": {
          // set executed node id as executed
          const node_id = event.data.message.detail;
          if (!node_id) {
            return;
          }

          setProgress(prev => ({
            ...prev,
            nodes: {
              ...prev.nodes,
              [node_id]: true
            }
          }));
        }
        break;

      case "queue-manager-queue-updated":
        fetchQueueItems()
        break;
    }
  }

  const onParentKeypress = (keypress) => {
    if (!keypress) {
      return;
    }

    if (keypress.key === "Shift") {
      setShiftDown(keypress.isDown);
    }
  }

  const handleMessage = useEvent((event) => {
    // In production must be same origin, in development as set in config.js
    if (event.origin !== (baseURL === '/' ? window.location.protocol + "//" + window.location.host : baseURL.replace(/\/+$/, ""))) {
      return;
    }

    switch (event.data.type) {
      case "QM_queueStatusUpdated":
        onQueueStatusUpdated(event);
        break;
      case "QM_ParentKeypress":
        onParentKeypress(event.data.message);
        break;
      case "QM_QueueManager_Hello":
        useAppStore.getState().setClientId(event.data.clientId);
        setAllOptions({...event.data.settings});
        break;
      case "QM_Setting_Changed": {
          // check if path like "Basic.PageSize" in event.data.message.setting represent an existing object path in options
          const settingPath = event.data.message.setting.split('.');
          let current = options;
          let exists = true;
          for (const segment of settingPath) {
            if (Object.prototype.hasOwnProperty.call(current, segment)) {
              current = current[segment];
            } else {
              exists = false;
            }
          }

          const CategorySlug = settingPath[0];
          const SettingKey = settingPath[1];

          if (exists) {
            setOption(CategorySlug, SettingKey, event.data.message.newValue);
          }
        }
        break;
    }
  });

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

  // when progress data is updated
  useEffect(() => {
    const progress =
      Object.values(currentJob.nodes).length > 0 ?
        Math.round(
          Math.max(
            (Object.values(currentJob.nodes).filter(v => typeof v === 'boolean').length - 1),
            0
          ) / Object.values(currentJob.nodes).length * 100,
          2
        )
        :
        0;

    setProgress(prev => ({
      ...prev,
      progress: progress
    }));

  }, [currentJob.nodes]);

  // when new queue items are added to the queue
  useEffect(() => {
    // Are we already tracking a job but have not saved the workflow data yet?
    if (currentJob.id && currentJob.integrity === false) {
      const theJob = getTheJob(currentJob.id, appStatus.queue);
      if (theJob) {
        const nodeIDs = getNodeIDs(theJob[3].extra_pnginfo.workflow.nodes);

        // if we already marked some nodes as executed do not overwrite them
        for (const nodeID in currentJob.nodes) {
          if (currentJob.nodes[nodeID] === true) {
            nodeIDs[nodeID] = true;
          }
        }

        // set the current job
        setProgress(prev => ({
          ...prev,
          nodes: nodeIDs,
          integrity: true
        }));
      }
    }
  }, [appStatus.queue, currentJob.id, currentJob.integrity, currentJob.nodes]);

  // on mount get the queue items from the server
  useEffect(() => {
    fetchQueueItems({route: "queue"});
    fetchOptions();

    window.addEventListener("message", handleMessage);

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

    window.parent.postMessage(
      { type: "QM_QueueManager_Hello" },
      "*"
    );

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className={`route-${route} qm-container` + (appStatus.loading ? ' loading' : '') + (appStatus.reloading ? ' reloading' : '')}>
      <header className="px-2 py-1 text-sm header font-bold">
        Queue Manager
        {appStatus.loading &&
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
                  className="inline-flex text-neutral-800 dark:text-neutral-200 close label"><span
                  className={'type'}>{filter.type + ": "}&nbsp;</span>{filter.valueLabel}</span>
                <button
                  className="shiny-button close "
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
              className="close close-all ml-auto shiny-button"
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
          <Queue data={appStatus.queue}
                 error={appStatus.error}
                 isLoading={appStatus.loading}
                 progress={currentJob.progress}
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
          {appStatus.queue && appStatus.queue.info && (appStatus.queue.info.last_page > 0) &&
            <>
              <div className={"pagination"}>
                <Pagination
                  shape="rounded"
                  variant="outlined"
                  boundaryCount={2}
                  siblingCount={2}
                  page={appStatus.queue.info.page + 1}
                  onChange={(event, value) => {
                    fetchQueueItems({page:value -1, reload: true});
                  }}
                  count={appStatus.queue.info.last_page + 1}></Pagination>

                {/* If more than 11 pages show page selector */}
                {appStatus.queue.info.last_page > 10 &&
                  <div className="page-selector">
                    <Select
                      value={appStatus.queue.info.page}
                      onChange={(event) => {
                        const pageNum = event.target.value;
                        fetchQueueItems({page:pageNum, reload: true});
                      }}
                      size="small"
                    >
                      {[...Array(appStatus.queue.info.last_page + 1).keys()].map((pageNum) => (
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
              {appStatus.queue && (appStatus.queue.running.length > 0 || appStatus.queue.pending.length > 0) &&
                <>


                  {/* Queue Actions  */}
                  {route === 'queue' &&
                    <>
                      <button onClick={archiveAll} className={"shiny-button yellow-button"}>
                        <Inventory2SharpIcon/>&nbsp;
                        Archive All {isFilterOn() ? "*" : "Pending"}
                      </button>
                      <a className={"shiny-button"}
                              href={baseURL + "queue_manager/export" + appendRoute(appendFilters(""))}>
                        <FileDownloadOutlinedIcon/>&nbsp;&nbsp;Export {isFilterOn() ? "*" : "Queue"}
                      </a>
                      <button color="error" onClick={isFilterOn() ? deleteFromQueue : clearPending}
                              className={"order-last delete red-button shiny-button"} >
                        <DeleteOutlineSharpIcon/>&nbsp;&nbsp;Delete All {isFilterOn() ? "*" : "Pending"}
                      </button>
                    </>
                  }

                  {/* Archive Actions */}
                  {route === 'archive' &&
                    <>
                      <button onClick={playAllArchive}
                              className="shiny-button blue-button">
                        <PlayArrowOutlinedIcon/>&nbsp;&nbsp;Run All {isFilterOn() ? "*" : ""}
                      </button>
                      <a className={"shiny-button"}
                              href={baseURL + "queue_manager/export" + appendFilters("?route=archive")}>
                        <FileDownloadOutlinedIcon/>&nbsp;&nbsp;Export {isFilterOn() ? "*" : "Archive"}
                      </a>
                      <button onClick={deleteFromQueue}
                              className={"shiny-button delete red-button order-last"}>
                        <DeleteOutlineSharpIcon/>&nbsp;&nbsp;Delete {isFilterOn() ? "All *" : "All Archive"}
                      </button>
                    </>
                  }

                  {/* Completed Actions */}
                  {route === 'completed' &&
                    <>
                      <a className={"shiny-button"}
                              href={baseURL + "queue_manager/export" + appendFilters("?route=completed")}>
                        <FileDownloadOutlinedIcon/>&nbsp;&nbsp;Export {isFilterOn() ? "*" : "Completed Jobs"}
                      </a>
                      <button onClick={deleteFromQueue}
                              className={"order-last delete red-button shiny-button"}>
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
                  <Button variant="contained" color="inherit" size="small" component="label" className={"shiny-button"}>
                    <DriveFolderUploadOutlinedIcon/>&nbsp;&nbsp;Import {route === 'queue' ? 'Queue' : 'Archive'}
                    <VisuallyHiddenInput
                      type="file"
                      onChange={uploadQueue}
                      multiple
                      name="queue_json"
                      accept=".json"
                      required
                    />
                  </Button>
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
