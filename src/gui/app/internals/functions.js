import {baseURL} from "../internals/config";

export async function apiCall(endpoint, data, method = "POST") {
  // is endpoint an absolute URL
  const url = (endpoint.startsWith("https://") || endpoint.startsWith("http://")) ?
    endpoint :
    `${baseURL}${endpoint}`;


  try {

    let request = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (method.toLowerCase() !== "get") {
      request.body = JSON.stringify(data);
    }

    const response = await fetch(url, request);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    // is response body non empty and json?
    const contentType = response.headers.get("content-type");
    const contentLength = parseInt(response.headers.get("content-length"));


    if (contentLength === 0) {
      return null;
    }
    if (contentType.includes("application/json")) {
      return await response.json();
    } else {
      // plain text response
      return await response.text()
    }
  } catch (error) {
    console.error("Error running apiCall:", error);
    throw error;
  }
}

export async function deleteRunningJob(promptId) {
  return apiCall("queue_manager/running", { prompt_id: promptId }, "DELETE");
}

export function compareVersions(a, b) {
  const pa = String(a).split('.').map(x => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// Queue timestamps come from SQLite CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS" in UTC.
// Shows the time alone for today, the date and time earlier this year, and only the date before that.
export function formatCardTime(value, now = new Date()) {
  if (!value) return null;

  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return null;

  let options = { hour: "numeric", minute: "2-digit" };
  if (date.getFullYear() !== now.getFullYear()) {
    options = { year: "numeric", month: "short", day: "numeric" };
  } else if (date.toDateString() !== now.toDateString()) {
    options = { month: "short", day: "numeric", ...options };
  }

  return { label: date.toLocaleString(undefined, options), title: date.toLocaleString() };
}
