import { useCallback, useEffect, useRef, useState } from "react";
import { baseURL } from "../internals/config";
import { useAppStore } from "../stores/appStore";
import { useOptionsStore } from "../stores/optionsStore";

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

  for (const item of queue.running) {
    if (item[1] === jobID) {
      return item;
    }
  }

  for (const item of queue.pending) {
    if (item[1] === jobID) {
      return item;
    }
  }

  return null;
}

export function useQueue({ fetchOptions } = {}) {
  const [appStatus, setAppStatus] = useState({
    loading: true,
    reloading: false,
    error: null,
    queue: null,
  });

  const pageSize = useOptionsStore((state) => state.Basic.PageSize);
  const completedListOrder = useOptionsStore((state) => state.Completed.ListOrder);

  const filters = useAppStore((state) => state.filters);
  const route = useAppStore((state) => state.route);
  const setFilters = useAppStore((state) => state.setFilters);
  const setRoute = useAppStore((state) => state.setRoute);

  const [currentJob, setProgress] = useState({
    id: null,
    nodes: {},
    integrity: true,
    progress: 0.0,
  });

  const fetchIdRef = useRef(0);

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

  const fetchQueueItems = useCallback(async ({page, route: requestedRoute, filters, reload = false} = {}) => {

    const fetchId = ++fetchIdRef.current;

    let queryArgs = "";
    if (page !== undefined && page !== null) queryArgs = `?page=${page}`;

    queryArgs = appendFilters(queryArgs, filters);
    queryArgs = appendRoute(queryArgs, requestedRoute);
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

      if (fetchId !== fetchIdRef.current) return;

      if (requestedRoute) {
        setRoute(requestedRoute);

        if (requestedRoute === "completed") {
          setTimeout(() => {
            fetchOptions?.();
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
            setProgress(prev => ({
              ...prev,
              id: prompt_id,
              nodes: nodeIDs,
              integrity: true
            }));

            break;
          }

          setProgress(prev => ({...prev, id: prompt_id, integrity: false, nodes: {}}));
        }
        break;

      case 'execution_cached': {
          const {nodes} = event.data.message.detail;

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
  };

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

  useEffect(() => {
    if (currentJob.id && currentJob.integrity === false) {
      const theJob = getTheJob(currentJob.id, appStatus.queue);
      if (theJob) {
        const nodeIDs = getNodeIDs(theJob[3].extra_pnginfo.workflow.nodes);

        for (const nodeID in currentJob.nodes) {
          if (currentJob.nodes[nodeID] === true) {
            nodeIDs[nodeID] = true;
          }
        }

        setProgress(prev => ({
          ...prev,
          nodes: nodeIDs,
          integrity: true
        }));
      }
    }
  }, [appStatus.queue, currentJob.id, currentJob.integrity, currentJob.nodes]);

  return {
    data: appStatus.queue,
    isLoading: appStatus.loading,
    isReloading: appStatus.reloading,
    error: appStatus.error,
    progress: currentJob.progress,
    fetchQueueItems,
    isFilterOn,
    appendFilters,
    appendRoute,
    onQueueStatusUpdated,
  };
}
