import threading
from typing import Optional

from execution import PromptQueue
from server import PromptServer
import nodes

import json
import heapq

from .inc.exceptions import BadRouteException
from .qm_card import load_card_by_prompt_id, remove_card_images, save_static_card
from .qm_db import get_conn, read_query, read_single, write_query, write_many
from .qm_log import qm_log

PRIORITY_MIN = -100
PRIORITY_MAX = 100
PRIORITY_PREEMPTED = 999
PRIORITY_INTERACTIVE = 1000
PRIORITY_RESERVED = (PRIORITY_PREEMPTED, PRIORITY_INTERACTIVE)


def clamp_priority(priority):
    if priority in PRIORITY_RESERVED:
        return priority
    return max(PRIORITY_MIN, min(PRIORITY_MAX, priority))


class QM_Queue:
    def __init__(self, queue_manager):
        self.queue_manager = queue_manager
        self.user_manager = PromptServer.instance.user_manager
        self.restored = False

        settings = self.user_manager.settings.get_settings(None)
        start_mode = settings.get("QueueManager.Basic.StartMode", "Last state")
        current_state = queue_manager.options.get("queue_paused", False)

        if start_mode == "Last state":
            self.paused = current_state
        else:
            self.paused = start_mode == "Pause"
            if self.paused != current_state:
                queue_manager.options.set("queue_paused", self.paused)

        qm_log.info("Queue status: %s", "not paused" if not self.paused else "paused")

        client_id, timestamp = queue_manager.options.get("takeover_client", False, True)
        if client_id:
            self.takeover_client = {"client_id": client_id, "timestamp": timestamp}
        else:
            self.takeover_client = None

        if self.paused:
            self.restore_queue(True)

        # ===================================================================
        # ================ Hijack Native Queue ==============================
        # ===================================================================
        #
        # While we hijack most crucial methods of the native queue, we retain
        # most of the original mechanisms, events and processes to avoid
        # as many compatibility issues as possible.
        #
        # ===================================================================
        # ===================================================================
        self.native_queue = PromptServer.instance.prompt_queue
        self.pause_lock = threading.Condition(self.native_queue.mutex)
        self.pending_delete = set()
        self.preempted = None

        # Hijack PromptQueue.get() to get the item marked for execution and mark the item as running in the database
        self.original_get = self.native_queue.get
        self.native_queue.get = self.queue_get

        # Hijack PromptQueue.put() to get the queue newly added pending item; add the item to the database
        self.original_put = self.native_queue.put
        self.native_queue.put = self.queue_put

        # Hijack PromptQueue.get_current_queue() to get first page of the current queue
        self.original_get_current_queue = self.native_queue.get_current_queue
        self.native_queue.get_current_queue = self.get_current_queue

        # Hijack PromptQueue.get_tasks_remaining() to get true number of tasks remaining
        self.original_get_tasks_remaining = self.native_queue.get_tasks_remaining
        self.native_queue.get_tasks_remaining = self.get_tasks_remaining

        # Hijack PromptQueue.task_done() to mark the task as finished in the database
        self.original_task_done = self.native_queue.task_done
        self.native_queue.task_done = self.task_done

    # NOTE: This hijack will make native queue API endpoint to not return pending items.
    # We do this to avoid bottleneck in the native queue when it goes massive
    # and to avoid duplicate bandwidth for requesting queue by execution store and queue manager.
    def get_current_queue(self, page=0, page_size=0, route="queue", filters=None, return_meta=False, order=None):
        # qm_log.info('get_current_queue: %d, %d', page, page_size)
        # Get the first page of the current queue

        with self.native_queue.mutex:
            # Split running and pending jobs into tuple of running and pending tuples
            running = []
            pending = []
            total_rows = 0
            last_page = 0
            order_string = "ORDER BY priority DESC, number"
            join_string = ""
            select_string = "SELECT queue.id as id, prompt, number, priority"

            match route:
                case "queue":
                    for native_item in self.native_queue.currently_running.values():
                        item = list(native_item)
                        item[3] = item[3].copy()
                        priority_row = read_single("SELECT priority FROM queue WHERE prompt_id = ?", (item[1],))
                        if priority_row is not None:
                            item[3]["priority"] = priority_row[0]
                        card = load_card_by_prompt_id(item[1])
                        if card is not None:
                            item[3]["card"] = card
                        running.append(tuple(item))
                case "archive":
                    order_string = "ORDER BY queue.updated_at, number"
                case "completed":
                    order_string = "ORDER BY queue.updated_at ASC" if order == "asc" else "ORDER BY queue.updated_at DESC"
                    order_string += (
                        ", number ASC" if order == "asc" else ", number DESC"
                    )  # just in case, normally there won't be two items completed at the same time

                    join_string = "LEFT JOIN meta as outputs ON queue.id = outputs.item_id AND outputs.key = 'outputs'"
                    join_string += " LEFT JOIN meta as exec_time ON queue.id = exec_time.item_id AND exec_time.key = 'execution_time'"
                    join_string += " LEFT JOIN meta AS error ON queue.id = error.item_id AND error.key = 'error'"
                    select_string = f"{select_string}, queue.status, outputs.value as outputs, exec_time.value as execution_time, error.value as error"

            join_string += """
                LEFT JOIN meta AS card
                    ON queue.id = card.item_id
                    AND card.key = 'card'
                    AND card.id = (
                        SELECT MAX(candidate.id)
                        FROM meta AS candidate
                        WHERE candidate.item_id = queue.id AND candidate.key = 'card'
                    )
            """
            select_string = f"{select_string}, card.value AS card"

            where_clauses = [self.get_route_query(route)]

            where_string, params = self.get_filters(filters, where_clauses)

            if page_size > 0:
                total_rows = read_single(f"""SELECT COUNT(*) FROM queue WHERE {where_string}""", params)[0]

            if total_rows > 0:
                last_page = (total_rows - 1) // (0 if page_size == 0 else page_size)

                # If requesting page that doesn't exist then return next adjacent one
                if page > last_page:
                    page = last_page
                if page < 0:
                    page = 0

                params += (page * page_size, page_size)

                rows = read_query(
                    f"""
                    {select_string}
                    FROM queue
                    {join_string}
                    WHERE {where_string}
                    {order_string}
                    LIMIT ?, ?
                """,
                    params,
                )

                # array of prompts
                for row in rows:
                    item = json.loads(row["prompt"])
                    # Add db_id to the item
                    item[3]["db_id"] = row["id"]
                    item[3]["priority"] = row["priority"]
                    if row["card"] is not None:
                        item[3]["card"] = json.loads(row["card"])

                    if route == "queue":
                        item[0] = row["number"]  # set the number to the one from the database

                    if route == "completed":
                        if row["outputs"] is not None:
                            # If we have outputs then add them to the item
                            item[3]["outputs"] = json.loads(row["outputs"])
                            # Count all files in outputs
                            total_images = 0
                            total_videos = 0
                            for output in item[3]["outputs"].values():
                                if "images" in output:
                                    # if output contains "animated" key and it's true then count as video
                                    if "animated" in output and output["animated"]:
                                        total_videos += len(output["images"])
                                    else:
                                        total_images += len(output["images"])
                                if "gifs" in output:
                                    total_videos += len(output["gifs"])
                            item[3]["total_files"] = total_images + total_videos
                            item[3]["total_images"] = total_images
                            item[3]["total_videos"] = total_videos
                        else:
                            item[3]["total_files"] = 0
                            item[3]["total_images"] = 0
                            item[3]["total_videos"] = 0

                        if row["execution_time"] is not None:
                            item[3]["execution_time"] = float(row["execution_time"])
                        else:
                            item[3]["execution_time"] = None

                        item[3]["status"] = row["status"]

                        if row["error"] is not None:
                            item[3]["error"] = json.loads(row["error"])
                        else:
                            item[3]["error"] = None

                    pending.append(tuple(item))

            # If called without parameters, return all three values

            if return_meta:
                return (
                    running,
                    pending,
                    {
                        "total": total_rows,
                        "page": page,
                        "page_size": page_size,
                        "last_page": last_page,
                    },
                )
            else:
                return running, pending

    def get_full_queue(self, route="queue", filters=None):
        with self.native_queue.mutex:
            where_string, params = self.get_filters(filters, [self.get_route_query(route, True)])

            rows = read_query(
                f"""
                SELECT id, prompt, priority
                FROM queue
                WHERE {where_string}
                ORDER BY created_at DESC
            """,
                params,
            )

            # array of prompts
            prompts = []
            for row in rows:
                item = json.loads(row[1])
                item[3]["qm_priority"] = row[2]
                # Convert the item to a tuple
                # item = tuple(item)
                # Add the item to the pending list
                prompts.append(item)
            return prompts

    def get_tasks_remaining(self):
        with self.native_queue.mutex:
            # Get the number of tasks remaining in the database

            return read_single("""
                SELECT COUNT(*)
                FROM queue
                WHERE status = 0 OR status = 1
            """)[0]  # total

    def _call_original_task_done(self, item_id, history_result, status, process_item=None):
        if (process_item is None) or (not process_item):  # accommodate original method signature
            self.original_task_done(item_id, history_result, status)
            return
        self.original_task_done(item_id, history_result, status, process_item)

    def task_done(self, item_id, history_result, status: Optional["PromptQueue.ExecutionStatus"], process_item=None):
        with self.native_queue.mutex:
            # log debug arguments
            # qm_log.info("Task done: item_id=%s, history_result=%s, status=%s", item_id, history_result, status)
            # qm_log.info("Task done: history_result = %s", json.dumps(history_result))
            # qm_log.info("Task done: status = %s", json.dumps(status))
            # qm_log.info("Task done: item_id = %s", item_id)

            # Mark the task as finished in the database

            # Get the running item from the native queue dictionary
            item = self.native_queue.currently_running.get(item_id, None)
            if item is not None:
                prompt_id = item[1]  # Get the prompt_id from the item

                if self.preempted is not None and self.preempted["prompt_id"] == prompt_id:
                    preempted_number = self.preempted["number"]
                    self.preempted = None

                    # interrupt_processing() only takes effect at the executor's next
                    # between-node check, so the job may have completed on its own in the
                    # meantime; that result is real and must not be thrown away.
                    interrupted = (
                        status is not None
                        and len(status) >= 3
                        and any(event[0] == "execution_interrupted" for event in status[2])
                    )

                    # A job the user deleted while it ran must stay deleted, so the pending
                    # delete below outranks the requeue of the job we interrupted for it.
                    if interrupted and prompt_id not in self.pending_delete:
                        write_query(
                            """
                            UPDATE queue
                            SET status = 0, number = ?, priority = ?
                            WHERE prompt_id = ?
                        """,
                            (preempted_number, PRIORITY_PREEMPTED, prompt_id),
                        )
                        qm_log.info("Requeued preempted job: %s", prompt_id)
                        PromptServer.instance.send_sync("queue-manager-queue-updated", {"requeued": prompt_id})
                        PromptServer.instance.queue_updated()
                        self._call_original_task_done(item_id, history_result, status, process_item)
                        return

                # Mark the item as finished in the database
                final_status = 2
                if status is not None and len(status) >= 3 and status[0] == "error":
                    final_status = -1

                write_query(
                    """
                    UPDATE queue
                    SET status = ?
                    WHERE prompt_id = ?
                """,
                    (final_status, prompt_id),
                )

                if prompt_id in self.pending_delete:
                    write_query(
                        """
                        DELETE FROM queue
                        WHERE prompt_id = ?
                    """,
                        (prompt_id,),
                    )
                    remove_card_images([prompt_id])
                    self.pending_delete.discard(prompt_id)
                    self._call_original_task_done(item_id, history_result, status, process_item)
                    return

                outputs = {}
                if history_result is not None and "outputs" in history_result:
                    # get id column from the prompt
                    db_id = read_single(
                        """
                        SELECT id
                        FROM queue
                        WHERE prompt_id = ?
                    """,
                        (prompt_id,),
                    )
                    if db_id is None:
                        # Most likely because the item execution was interrupted and the handler deleted the item already
                        # Call the original task_done method so it clears the native queue
                        self.original_task_done(item_id, history_result, status)
                        return

                    db_id = db_id[0]  # get the first element of the tuple

                    # Save only persistent outputs
                    for node_id, output in history_result["outputs"].items():
                        images = None
                        if "images" in output:
                            images = output["images"]
                        elif "gifs" in output:
                            images = output["gifs"]

                        if images is not None:
                            if images[0]["type"] == "output":
                                outputs[node_id] = output

                    if len(outputs) > 0:
                        # Save outputs to the meta table
                        write_query(
                            """
                                DELETE FROM meta
                                WHERE item_id = ? AND key = 'outputs'
                            """,
                            (db_id,),
                        )
                        write_query(
                            """
                                INSERT INTO meta (item_id, key, value)
                                VALUES (?, 'outputs', ?)
                            """,
                            (
                                db_id,
                                json.dumps(outputs),
                            ),
                        )

                # If status provided and success then  save execution time to the meta table
                if status is not None and len(status) >= 3 and status[0] == "success":
                    exec_time = None
                    for event in status[2]:
                        if event[0] == "execution_start":
                            start_time = event[1]["timestamp"]
                        if event[0] == "execution_success":
                            end_time = event[1]["timestamp"]

                            # Convert milliseconds to seconds and round to 3 decimal places
                            exec_time = round((end_time - start_time) / 1000, 3)
                            break

                    if exec_time is not None:
                        write_query(
                            """
                                DELETE FROM meta
                                WHERE item_id = ? AND key = 'execution_time'
                            """,
                            (db_id,),
                        )
                        write_query(
                            """
                                INSERT INTO meta (item_id, key, value)
                                VALUES (?, 'execution_time', ?)
                            """,
                            (
                                db_id,
                                str(exec_time),
                            ),
                        )

                write_query(
                    """
                        DELETE FROM meta
                        WHERE item_id = ? AND key = 'error'
                    """,
                    (db_id,),
                )

                if status is not None and len(status) >= 3 and status[0] == "error":
                    error_meta = None
                    for event in status[2]:
                        if event[0] in ("execution_error", "execution_interrupted"):
                            payload = event[1]
                            error_meta = {
                                "kind": "error" if event[0] == "execution_error" else "interrupted",
                                "message": payload.get("exception_message"),
                                "node_id": payload.get("node_id"),
                                "node_type": payload.get("node_type"),
                                "traceback": payload.get("traceback"),
                            }
                            break

                    if error_meta is not None:
                        write_query(
                            """
                                INSERT INTO meta (item_id, key, value)
                                VALUES (?, 'error', ?)
                            """,
                            (
                                db_id,
                                json.dumps(error_meta),
                            ),
                        )

                self._call_original_task_done(item_id, history_result, status, process_item)

    # Put item for execution
    # NOTE: We keep only up to one item in native "pending" queue (to avoid bottleneck for large queues).
    def queue_put(self, item):  # comfy server calls this method
        # logging.info(json.dumps(item))

        with self.native_queue.mutex:
            # if item[3]["extra_pnginfo"] is not set then we pass it to original put
            # It suggests request does not come from ComfyUI but from external source (like API or some app's plugin) - as such they won't benefit from queue manager features
            if "extra_pnginfo" not in item[3] or "workflow" not in item[3]["extra_pnginfo"]:
                # item = tuple(item)
                self.original_put(tuple(item))
                return

            existing = read_single(
                """
                SELECT status
                FROM queue
                WHERE prompt_id = ?
            """,
                (item[1],),
            )
            # A running row's native-queue slot is already occupied by the in-flight
            # item; upserting here would reset its status to 0 and let a resubmission
            # share that row, merging two logical tasks into one.
            if existing is not None and existing[0] == 1:
                return

            mode = item[3]["extra_pnginfo"]["workflow"].pop("qm_interactive", None)

            qm_priority = item[3].pop("qm_priority", 0)
            priority = PRIORITY_INTERACTIVE if mode in ("front", "interrupt") else clamp_priority(qm_priority)

            # Read before the upsert: once the row is written, a resubmission of the
            # prefetched item would be compared against its own new priority.
            head_prompt_id = self.native_queue.queue[0][1] if len(self.native_queue.queue) > 0 else None

            # Add the item to the database
            write_query(
                """
                INSERT INTO queue (prompt_id, number, name, workflow_id, prompt, status, priority)
                VALUES (?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(prompt_id) DO UPDATE SET
                    number = excluded.number,
                    name = excluded.name,
                    workflow_id = excluded.workflow_id,
                    prompt = excluded.prompt,
                    status = 0,
                    priority = excluded.priority
            """,
                (
                    item[1],
                    item[0],
                    item[3]["extra_pnginfo"]["workflow"]["workflow_name"],
                    item[3]["extra_pnginfo"]["workflow"]["id"],
                    json.dumps(item),
                    priority,
                ),
            )

            db_row = read_single("SELECT id FROM queue WHERE prompt_id = ?", (item[1],))
            save_static_card(db_row[0], item[2])

            # qm_log.info("Workflow queued: %s at %s", item[1], item[0])

            if mode == "interrupt":
                self.preempt_running()

            self.notify_if_paused_interactive(priority)

            if not self.paused and (
                head_prompt_id is None
                or head_prompt_id == item[1]
                or self.outranks_heap_head(priority, item[0])
            ):
                self.native_queue.queue = []
                self.pull_head_into_heap()
            else:  # just notify frontend that we have a new item
                PromptServer.instance.queue_updated()

    def pull_head_into_heap(self):
        row = read_single("""
            SELECT prompt
            FROM queue
            WHERE status = 0
            ORDER BY priority DESC, number
            LIMIT 1
        """)

        if row is None:
            return

        item = tuple(json.loads(row[0]))

        # Backwards compatibility: if item[5] does not exist, create it with empty dict
        if len(item) < 6:
            item = item + ({},)

        self.original_put(item)

    # Callers must check heap emptiness themselves; an empty heap has no head to outrank.
    def outranks_heap_head(self, priority, number):
        if len(self.native_queue.queue) == 0:
            return False

        head_row = read_single(
            "SELECT priority, number FROM queue WHERE prompt_id = ?",
            (self.native_queue.queue[0][1],),
        )
        # A head with no row was queued straight through original_put, so the database
        # cannot restore it if we drop it from the heap.
        if head_row is None:
            return False

        return (priority, -number) > (head_row[0], -head_row[1])

    def preempt_heap_head_if_stale(self):
        if len(self.native_queue.queue) == 0:
            return False

        head_prompt_id = self.native_queue.queue[0][1]
        # A head with no row was queued straight through original_put, so the database
        # cannot restore it if we drop it from the heap.
        if read_single("SELECT id FROM queue WHERE prompt_id = ?", (head_prompt_id,)) is None:
            return False

        best = read_single("""
            SELECT prompt_id
            FROM queue
            WHERE status = 0
            ORDER BY priority DESC, number
            LIMIT 1
        """)
        if best is None or best[0] == head_prompt_id:
            return False

        self.native_queue.queue = []
        self.pull_head_into_heap()
        return True

    def preempt_running(self):
        running = next(iter(self.native_queue.currently_running.values()), None)
        if running is None:
            return

        prompt_id = running[1]
        row = read_single("SELECT priority FROM queue WHERE prompt_id = ?", (prompt_id,))
        # A running job with no row was queued straight through original_put, so the
        # database cannot bring it back once we interrupt it.
        if row is None or row[0] >= PRIORITY_PREEMPTED:
            return

        PromptServer.instance.number += 1
        self.preempted = {"prompt_id": prompt_id, "number": -PromptServer.instance.number}

        qm_log.info("Interrupting running job for interactive run: %s", prompt_id)
        nodes.interrupt_processing()

    # Callers must already hold the native queue mutex that pause_lock wraps.
    def notify_if_paused_interactive(self, priority):
        # A worker already parked in queue_get's pause wait only re-tests the
        # interactive bypass after it wakes, so inserting the row is not enough.
        if self.paused and priority >= PRIORITY_INTERACTIVE:
            self.pause_lock.notify()

    def queue_get(self, timeout=None):
        with self.pause_lock:
            while self.paused:
                if read_single("SELECT 1 FROM queue WHERE status = 0 AND priority >= ? LIMIT 1", (PRIORITY_INTERACTIVE,)) is not None:
                    break
                notified = self.pause_lock.wait(timeout=timeout)
                if timeout is not None and not notified:
                    return None  # give up

            # if no pending item in the native queue then we get the one from the database
            if len(self.native_queue.queue) == 0:
                # if we are on the first iteration and there's no item running then check if there is anything that need to be restored
                if self.native_queue.task_counter == 0 and len(self.native_queue.currently_running) == 0:
                    self.restore_queue(True)

                # Get the item with highest priority from the queue in database
                item_db = read_single("""
                    SELECT number, prompt, updated_at
                    FROM queue
                    WHERE status = 0
                    ORDER BY priority DESC, number
                    LIMIT 1
                """)

                if item_db is not None:
                    item = json.loads(item_db[1])

                    # SIML: TODO: Perhaps use different column to check timestamp? i.e. queued_at since item might be updated for other reasons?
                    # If we have takeover client then we need to set the client_id in the prompt
                    if self.takeover_client and self.takeover_client["timestamp"] > item_db[2]:
                        item[3]["client_id"] = self.takeover_client["client_id"]

                    # Native format is a tuple
                    item = tuple(item)

                    # Backwards compatibility: if item[5] does not exist, create it with empty dict
                    if len(item) < 6:
                        item = item + ({},)

                    heapq.heappush(self.native_queue.queue, item)

            queue_item = self.original_get(
                timeout
            )  # Wait for an item to be available in the queue (either one from the database (above) or wait for put())

            if queue_item is not None:
                # Mark the item as running in the database
                write_query(
                    """
                    UPDATE queue
                    SET status = 1
                    WHERE prompt_id = ?
                """,
                    (queue_item[0][1],),
                )
                qm_log.info(
                    "Executing workflow: \033[33m%s\033[0m at %s",
                    queue_item[0][3]["extra_pnginfo"]["workflow"]["workflow_name"],
                    queue_item[0][0],
                )
                return queue_item  # (item, task_counter)
            else:
                # No item in the queue
                return None

    # ===========================================================
    # ================== NON-HIJACK METHODS =====================
    # ===========================================================

    def toggle_playback(self):
        with self.pause_lock:
            # Toggle the playback of the queue
            self.paused = not self.paused
            qm_log.info("Queue " + ("paused." if self.paused else "play."))
            PromptServer.instance.send_sync(
                "queue-manager-toggle-queue",
                {
                    "paused": self.paused,
                },
            )

            # Save option in the database
            self.queue_manager.options.set("queue_paused", self.paused)

            # unlock the pause lock if we are playing
            if not self.paused:
                self.pause_lock.notify()
            else:
                # remove the pending item from the native queue if we are paused
                self.native_queue.queue = []
                PromptServer.instance.queue_updated()
                # native queue might also be locked waiting for an item to be available
                # we need to notify it to wake up so it can move on, and so we can reach the pause lock
                # and avoid executing a new item while we are paused
                self.native_queue.not_empty.notify()

    def delete_items(self, items):
        """
        Delete items from the database
        """
        with self.native_queue.mutex:
            qm_log.info("Deleting items from queue: %s", items)
            # Delete the item from the database

            prompt_ids = []
            deleted = 0
            for item in items:
                row = read_single("SELECT prompt_id FROM queue WHERE prompt_id = ?", (item,))
                if row is not None:
                    prompt_ids.append(row[0])
                deleted += write_query(
                    """
                    DELETE FROM queue
                    WHERE prompt_id = ?
                """,
                    (item,),
                    False,
                )

            get_conn().commit()
            remove_card_images(prompt_ids)

            if deleted > 0:
                PromptServer.instance.queue_updated()
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"deleted": deleted})

    def wipe_queue(self):
        with self.native_queue.mutex:
            prompt_ids = [row[0] for row in read_query("SELECT prompt_id FROM queue WHERE status = 0")]
            # Wipe the queue from the database
            write_query("""
                DELETE FROM queue
                WHERE status = 0
            """)
            remove_card_images(prompt_ids)

    # Set status of pending and running items to 3 (archived)
    def archive_queue(self, filters=None):
        with self.native_queue.mutex:
            where_string, params = self.get_filters(filters, ["status = 0"])

            # Archive the queue from the database
            total = write_query(
                f"""
                UPDATE queue
                SET status = 3
                WHERE {where_string}
            """,
                params,
            )

            # remove the items from the native queue and heapify queue
            self.native_queue.queue = []
            heapq.heapify(self.native_queue.queue)

            # If affected any rows notify the frontend that the queue and archive have been archived
            if total > 0:
                qm_log.info("Queue Archived: %d item(s)", total)
                PromptServer.instance.queue_updated()
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"total_moved": total})
            else:
                qm_log.info("No items to archive")

            return total

    def archive_items(self, items):
        """
        Archive items to the database
        """
        with self.native_queue.mutex:
            # Archive the item from the database

            archived = 0
            for item in items:
                archived += write_query(
                    """
                    UPDATE queue
                    SET status = 3
                    WHERE id = ?
                """,
                    (item,),
                    False,
                )

            get_conn().commit()

            if archived > 0:
                qm_log.info("Queue Item Archived: %d item(s)", archived)
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"total_moved": archived})

            return archived

    def set_priority(self, db_ids, priority):
        """
        Set priority for pending or archived items in the database
        """
        if type(priority) is not int or not (PRIORITY_MIN <= priority <= PRIORITY_MAX):
            raise BadRouteException("Invalid priority: " + str(priority))

        with self.native_queue.mutex:
            updated = 0
            pending_updated = False
            for db_id in db_ids:
                row = read_single("SELECT status FROM queue WHERE id = ?", (db_id,))
                if row is None or row[0] not in (0, 3):
                    continue

                updated += write_query(
                    """
                    UPDATE queue
                    SET priority = ?
                    WHERE id = ? AND status IN (0, 3)
                """,
                    (priority, db_id),
                    False,
                )

                if row[0] == 0:
                    pending_updated = True

            get_conn().commit()

            if pending_updated and self.preempt_heap_head_if_stale():
                self.native_queue.not_empty.notify()

            if updated > 0:
                qm_log.info("Queue Item Priority Updated: %d item(s)", updated)
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"priority": updated})
                PromptServer.instance.queue_updated()

            return updated

    def delete_running_job(self, prompt_id=None):
        with self.native_queue.mutex:
            prompt_ids = [
                row[0]
                for row in read_query(
                    "SELECT prompt_id FROM queue WHERE status = 1 AND (? IS NULL OR prompt_id = ?)",
                    (prompt_id, prompt_id),
                )
            ]
            self.pending_delete.update(prompt_ids)
            if prompt_ids:
                nodes.interrupt_processing()
            return len(prompt_ids)

    def play_items(self, items, front, client_id=None):
        """
        Play items from the archive
        """
        with self.native_queue.mutex:
            # Play the item from the database

            moved = 0
            for db_id in items:
                PromptServer.instance.number += 1

                qm_log.info(
                    "Playing item: %s, priority: %d, front: %s",
                    db_id,
                    PromptServer.instance.number * (-1 if front else 1),
                    front,
                )

                # Get the item and update the client id in prompt json
                row = read_single(
                    """
                    SELECT prompt
                    FROM queue
                    WHERE id = ?
                """,
                    (db_id,),
                )
                if row is None:
                    continue

                prompt = json.loads(row[0])
                prompt[3]["client_id"] = client_id

                # Backwards compatibility: if prompt[5] does not exist, create it with empty dict
                if len(prompt) < 6:
                    prompt.append({})

                moved += write_query(
                    f"""
                    UPDATE queue
                    SET status = 0, number = ?, prompt = ?,
                        priority = CASE WHEN priority > {PRIORITY_MAX} THEN 0 ELSE priority END
                    WHERE id = ?
                """,
                    # Ensure correct priority
                    (
                        PromptServer.instance.number * (-1 if front else 1),
                        json.dumps(prompt),
                        db_id,
                    ),
                    False,
                )

            get_conn().commit()

            if moved > 0:
                # if moved to the front then remove the pending item from the native queue so next iteration will get the one
                # with highest priority in the database
                if front:
                    self.native_queue.queue = []
                else:
                    self.preempt_heap_head_if_stale()

                # Notify native queue lock so if it's waiting it can move on and go for next iteration
                PromptServer.instance.prompt_queue.not_empty.notify()

                qm_log.info("%d item(s) scheduled for generation.", moved)
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"total_moved": moved})
                PromptServer.instance.queue_updated()

            return moved

    # Change status to 0 for all items with status 3, update the client_id and set correct priority for each item
    def play_archive(self, client_id=None, filters=None, front=False):
        with self.native_queue.mutex:
            # Play the item from the database
            where_string, params = self.get_filters(filters, ["status = 3"])

            # If front we queue from last to first to retain order after applying negative priority
            if front:
                order = "DESC"
            else:
                order = "ASC"

            # Get the archived items from the database
            rows = read_query(
                f"""
                SELECT id, prompt
                FROM queue
                WHERE {where_string}
                ORDER BY updated_at {order}, `number` {order}
            """,
                params,
            )

            # Convert the items to a list of tuples
            parameters = []
            for row in rows:
                PromptServer.instance.number += 1

                item = json.loads(row[1])
                item[3]["client_id"] = client_id
                item[0] = PromptServer.instance.number * (-1 if front else 1)
                parameters.append(
                    (
                        item[0],
                        json.dumps(item),
                        row[0],
                    )
                )

            # Update the items in the database
            moved = write_many(
                f"""
                UPDATE queue
                SET status = 0, number = ?, prompt = ?,
                    priority = CASE WHEN priority > {PRIORITY_MAX} THEN 0 ELSE priority END
                WHERE id = ?
            """,
                parameters,
            )

            if moved > 0:
                if not front:
                    self.preempt_heap_head_if_stale()

                # Notify native queue lock so if it's waiting it can move on and go for next iteration
                PromptServer.instance.prompt_queue.not_empty.notify()

                qm_log.info("%d item(s) scheduled for generation.", moved)
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"total_moved": moved})
                PromptServer.instance.queue_updated()
            return moved

    def delete_from_queue(self, route="queue", filters=None):
        with self.native_queue.mutex:
            where_string, params = self.get_filters(filters, [self.get_route_query(route)])
            prompt_ids = [row[0] for row in read_query(f"SELECT prompt_id FROM queue WHERE {where_string}", params)]
            # Delete the archive from the database
            deleted = write_query(
                f"""
                DELETE FROM queue
                WHERE {where_string}
            """,
                params,
            )
            remove_card_images(prompt_ids)

            if route == "queue":
                PromptServer.instance.queue_updated()
            else:
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"deleted": deleted})

            return deleted

    # Import queue from uploaded json file
    def import_queue(self, items, client_id=None, status=0, api_key_comfy_org=None):
        theServer = PromptServer.instance
        theQueue = theServer.prompt_queue
        with theQueue.mutex:
            # Add items to the queue in database

            query_params = []

            for item in items:
                # TODO: Check if the item is a list, has the correct length, and contains valid data format
                # SIML: Check if all prompts in the queue are valid

                if client_id is not None:
                    item[3]["client_id"] = client_id

                if api_key_comfy_org is not None:
                    if len(item) < 6:
                        item.append({})
                    item[5] = {"api_key_comfy_org": api_key_comfy_org} if api_key_comfy_org is not None else {}

                priority = clamp_priority(item[3].pop("qm_priority", 0))

                PromptServer.instance.number += 1
                query_params.append(
                    (
                        item[1],
                        PromptServer.instance.number,
                        item[3]["extra_pnginfo"]["workflow"]["workflow_name"],
                        item[3]["extra_pnginfo"]["workflow"]["id"],
                        json.dumps(item),
                        status,
                        priority,
                    )
                )

            total = 0
            top_priority = PRIORITY_MIN
            with get_conn() as conn:
                for item, params in zip(items, query_params):
                    cursor = conn.execute(
                        """
                            INSERT OR IGNORE INTO queue (prompt_id, number, name, workflow_id, prompt, status, priority)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        params,
                    )
                    if cursor.rowcount:
                        save_static_card(cursor.lastrowid, item[2], conn=conn)
                        total += 1
                        top_priority = max(top_priority, params[6])

            if total > 0:
                if status == 0:
                    self.preempt_heap_head_if_stale()
                    self.notify_if_paused_interactive(top_priority)
                theQueue.not_empty.notify()
                if status == 0:
                    theServer.queue_updated()
                if status == 3:
                    PromptServer.instance.send_sync("queue-manager-queue-updated", {"total_imported": total})

            return total, len(items)

    # If there are any items in the queue with status 1 (running), restore them to status 0 (pending) with highest priority
    # TODO: Add a setting to enable/disable this feature
    def restore_queue(self, called_by_queue_get=False):
        with PromptServer.instance.prompt_queue.mutex:
            if self.restored:
                return

            # Get running items from the database
            rows = read_query("""
                SELECT prompt_id, number, name, workflow_id, prompt, priority
                FROM queue
                WHERE status = 1
                ORDER BY number
            """)
            if len(rows) > 0:
                qm_log.info("Restoring unfinished jobs: %d item(s)", len(rows))
                # Ordering is priority DESC, number ASC, so a restored row only needs to
                # beat the pending rows sharing its own priority.
                min_numbers = {}

                # Set the priority of the running items to the current highest priority
                for row in rows:
                    priority = row[5]
                    if priority not in min_numbers:
                        lowest = read_single(
                            """
                            SELECT number
                            FROM queue
                            WHERE status = 0 AND priority = ?
                            ORDER BY number
                            LIMIT 1
                        """,
                            (priority,),
                        )
                        min_numbers[priority] = lowest[0] - 1 if lowest else 0

                    write_query(
                        """
                        UPDATE queue
                        SET status = 0, number = ?
                        WHERE prompt_id = ?
                    """,
                        (
                            min_numbers[priority],
                            row[0],
                        ),
                    )
                    min_numbers[priority] -= 1

            # Get task counter (highest absolute task number) from the database
            rows = read_single("""
                SELECT
                    MIN(number) as min_number,
                    MAX(number) as max_number
                FROM queue
                WHERE status = 1 OR status = 0 -- pending or running
            """)
            if rows:
                min_num = rows[0] if rows[0] is not None else 0
                max_num = rows[1] if rows[1] is not None else 0

                task_counter = max(abs(min_num), abs(max_num)) + 1
            else:
                task_counter = 1

            # Set the task counter in the queue
            PromptServer.instance.prompt_queue.task_counter = task_counter
            # Set the number in server
            PromptServer.instance.number = task_counter

            qm_log.info("Task counter set to %d", task_counter)

            # Start queue processing
            # TODO: Add a setting to enable/disable auto-start
            if not called_by_queue_get:  # prevent circular call
                PromptServer.instance.prompt_queue.get(1000)

            self.restored = True  # we restore the queue only once per server start

    def get_filters(self, filters=None, where_clauses=None, params=None):
        if filters is not None:
            if where_clauses is None:
                where_clauses = []
            if params is None:
                params = []

            # If there are any filters, add them to the where clauses
            for key, the_filter in filters.items():
                if key == "workflow":
                    where_clauses.append("workflow_id = ?")
                    params.append(the_filter["value"])
                # elif key == "checkpoint":
                #     where_clauses.append("name LIKE ?")
                #     params.append(f"%{value}%")

        return " AND ".join(where_clauses), () if params is None else tuple(params)  # convert to tuple if not None

    def get_route_query(self, route="queue", include_running=False):
        # Get the query for the given route
        match route:
            case "queue":
                return "(status = 0" + (" OR status = 1)" if include_running else ")")  # pending
            case "archive":
                return "status = 3"
            case "completed":
                return "status IN (2, -1)"  # completed or errored/interrupted

        return ""
