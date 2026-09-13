import { apiCall, deleteRunningJob } from "./functions";
import { useSelectionStore } from "../stores/selectionStore";

export async function performDelete(selectedRunning, selectedPending, fetchQueueItems) {
  await Promise.all(selectedRunning.map((item) => deleteRunningJob(item[1])));
  if (selectedPending.length > 0) {
    await apiCall("api/queue", { delete: selectedPending.map((item) => item[1]) });
  }
  useSelectionStore.getState().clear();
  await fetchQueueItems({ reload: true });
}
