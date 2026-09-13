"use client";

import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import UploadSharpIcon from "@mui/icons-material/UploadSharp";
import DeleteOutlineSharpIcon from "@mui/icons-material/DeleteOutlineSharp";
import Inventory2SharpIcon from "@mui/icons-material/Inventory2Sharp";

import { apiCall } from "../internals/functions";
import { msgLoadWorkflow } from "../internals/parentBridge";
import { performDelete } from "../internals/deleteUtils";
import { useAppStore } from "../stores/appStore";
import { useSelectionStore } from "../stores/selectionStore";

const itemKey = (item) => item?.[3]?.db_id ?? item?.[1];

export function SelectionBar({ route, queueData, fetchQueueItems }) {
  const selected = useSelectionStore((state) => state.selected);
  const shiftDown = useAppStore((state) => state.shiftDown);

  if (selected.size === 0) {
    return null;
  }

  const running = queueData?.running ?? [];
  const pending = queueData?.pending ?? [];

  const selectedRunning = running.filter((item) => selected.has(itemKey(item)));
  const selectedPending = pending.filter((item) => selected.has(itemKey(item)));
  const selectedItems = [...selectedRunning, ...selectedPending];

  const finish = async () => {
    useSelectionStore.getState().clear();
    await fetchQueueItems({ reload: true });
  };

  const handleDelete = async () => {
    await performDelete(selectedRunning, selectedPending, fetchQueueItems);
  };

  const handleLoad = async () => {
    const workflow = selectedItems[0]?.[3]?.extra_pnginfo?.workflow;
    if (!workflow) return;
    msgLoadWorkflow(workflow, selectedItems[0][0]);
    await finish();
  };

  const handleArchive = async () => {
    const dbIds = selectedPending.map((item) => item?.[3]?.db_id).filter((id) => id != null);
    await apiCall("queue_manager/archive", { archive: dbIds });
    await finish();
  };

  const handleRun = async () => {
    const { clientId } = useAppStore.getState();
    const dbIds = selectedItems.map((item) => item?.[3]?.db_id).filter((id) => id != null);
    await apiCall("queue_manager/play", { items: dbIds, front: shiftDown, clientId });
    await finish();
  };

  const selectedRunningExternal = selectedRunning.filter((item) => !item?.[3]?.extra_pnginfo);
  const canLoad = selectedItems.length === 1 && selectedRunningExternal.length === 0;
  const canArchive = route === "queue" && selectedRunning.length === 0 && selectedPending.length > 0;
  const canRun = route === "archive";

  return (
    <div className="selection-bar">
      <span className="count qm-badge">{selected.size} selected</span>

      <div className="buttons">
        <button
          className="qm-btn qm-btn-text"
          onClick={() => useSelectionStore.getState().clear()}
        >
          Clear
        </button>

        {canLoad && (
          <button className="qm-btn qm-btn-primary" onClick={handleLoad} title="Load workflow">
            Load
          </button>
        )}

        {canArchive && (
          <button className="qm-btn" onClick={handleArchive} title="Move to the archive">
            <Inventory2SharpIcon fontSize="small" />
            &nbsp;Archive
          </button>
        )}

        {canRun && (
          <button
            className="qm-btn qm-btn-primary"
            onClick={handleRun}
            title={shiftDown ? "Move to queue, at the front" : "Move to queue"}
          >
            <PlayArrowOutlinedIcon fontSize="small" />
            {shiftDown && <UploadSharpIcon fontSize="small" />}
            &nbsp;Run{shiftDown ? " to front" : ""}
          </button>
        )}

        <button
          className="qm-btn qm-btn-danger delete"
          onClick={handleDelete}
          title="Delete from queue"
        >
          <DeleteOutlineSharpIcon fontSize="small" />
          &nbsp;Delete
        </button>
      </div>
    </div>
  );
}
