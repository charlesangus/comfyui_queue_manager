import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import DeleteOutlineSharpIcon from "@mui/icons-material/DeleteOutlineSharp";
import Inventory2SharpIcon from '@mui/icons-material/Inventory2Sharp';
import Stack from "@mui/material/Stack";

import { baseURL } from "../internals/config";
import { apiCall } from "../internals/functions";
import { useAppStore } from "../stores/appStore";
import { QueuePagination } from "./Pagination";
import { ImportExport } from "./ImportExport";

export function Footer({ route, queueData, isFilterOn, appendFilters, appendRoute, fetchQueueItems }) {
  async function archiveAll() {
    try {
      let queryArgs = appendFilters("");

      await fetch(`${baseURL}queue_manager/archive-queue${queryArgs}`);
    } catch (error) {
      console.error("Error fetching queue items:", error);
    }
  }

  async function playAllArchive() {
    await apiCall('queue_manager/play-archive', {
      client_id: useAppStore.getState().clientId,
      filters: isFilterOn() ? useAppStore.getState().filters : null,
      front: useAppStore.getState().shiftDown === true
    })
  }

  async function deleteFromQueue() {
    let queryArgs = appendFilters("?route=" + route);

    try {
      await fetch(`${baseURL}queue_manager/queue${queryArgs}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error(`Error deleting items from ${route}:`, error);
    }
  }

  async function clearPending() {
    try {
      await fetch(`${baseURL}api/queue`, {
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

  return (
    <footer className={"footer"}>
      <QueuePagination
        info={queueData?.info}
        onPageChange={(page) => fetchQueueItems({page, reload: true})}
      />

      <div className="p-2 flex actions">
        <Stack direction="row" spacing={1} className={'min-w-full buttons'}>
          {queueData && (queueData.running.length > 0 || queueData.pending.length > 0) &&
            <>
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

          <ImportExport route={route} />
        </Stack>
      </div>
    </footer>
  );
}
