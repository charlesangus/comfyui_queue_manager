"use client";           // (keep for app-router; harmless in pages-router)

import React, {useContext, useEffect, useState} from "react";
import {baseURL} from "@/internals/config";
import {apiCall} from "@/internals/functions";
import {AppContext} from "@/internals/app-context";
import MediaItem from "@/components/MediaItem";
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

// take items from parent component
export default function Queue( { data, isLoading, error, progress } ) {

  const [state, setState] = useState({
    pending:[],
    running:[],
  })

  /**
   *
   * Single Queue Item Row
   *
   */
  function QueueItemRow({item, className, loader, index, mode}) {

    const {appStatus, setAppStatus} = useContext(AppContext)

    async function cancelQueueItem() {
      const route = mode === 'running' ? 'interrupt' : 'queue';

      await apiCall(`api/${route}`, {
        delete: [item[1]],
      })
    }

    /**
     * Post message to parent window to load workflow stored in pnginfo
     */
    async function loadQueueItem() {
      // console.log("Loading queue item", item);
      window.parent.postMessage(
        { type: "QM_LoadWorkflow", workflow: item[3].extra_pnginfo.workflow, number: item[0] },
        "*"
      );
    }

    // POST to /api/archive with array of item ids to archive
    async function archiveQueueItem() {
      await apiCall(`queue_manager/archive`, {
        archive: [item[3].db_id],
      })
    }

    async function playItem() {
      console.log("Playing item from client: " + appStatus.clientId);
      await apiCall(`queue_manager/play`, {items: [item[3].db_id], front: appStatus.shiftDown === true, clientId: appStatus.clientId})
    }

    async function filterByWorkflow() {
      // Post message to parent window to filter by workflow
      setAppStatus(prev => ({...prev, filters: {...appStatus.filters, workflow: {
            type: 'workflow',
            value: item[3].extra_pnginfo.workflow.id,
            valueLabel: item[3].extra_pnginfo.workflow.workflow_name
          }}}));
    }


    return (
      <>
        {/*
          *
          * Queue Item Details
          *
          */}
        <TableRow className={(className ? ' ' + className : '')} key={"details" + item[3].db_id}>

          {/* Index and loader */}
          <TableCell className="px-3 py-1 serial">
            <span>{(index === undefined || !data.info) ? '' : index + 1 + data.info.page * data.info.page_size}</span>
            {loader &&
              <LoaderSpinner />
            }
          </TableCell>

          {/* Workflow Name */}
          <TableCell className="px-3 py-1 text-left name">
            <button className={'plain'} onClick={filterByWorkflow}>
              {item[3].extra_pnginfo.workflow.workflow_name ? item[3].extra_pnginfo.workflow.workflow_name : ""}
            </button>
          </TableCell>

          {/* Item Actions */}
          <TableCell className={'px-3 py-1 text-right actions'}>
            <Stack direction="row" sx={{ justifyContent: "flex-end" }} spacing={1}>
              <Button variant="contained" size="small" color="error"  onClick={cancelQueueItem}>Delete</Button>
              <Button variant="contained" size="small" color="success" onClick={loadQueueItem}>Load</Button>
              {appStatus.route === 'queue' && mode !== 'running' &&
                <Button variant="contained" size="small" color="warning" onClick={archiveQueueItem}>Archive</Button>
              }
              {appStatus.route === 'archive' &&
                <Button variant="contained" size="small" className={"run"} onClick={playItem}>
                  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em">
                    <path className={'run'} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
                          strokeWidth="2"
                          d="m6 3l14 9l-14 9z"></path>
                    <g className={'run-first'} fill="none" stroke="currentColor" strokeLinecap="round"
                       strokeLinejoin="round" strokeWidth="2">
                      <path d="M16 12H3m13 6H3m7-12H3m18 12V8a2 2 0 0 0-2-2h-5"></path>
                      <path d="m16 8l-2-2l2-2"></path>
                    </g>
                  </svg>
                  &nbsp;&nbsp;Run
                </Button>
              }
            </Stack>
          </TableCell>
        </TableRow>

        {/*
          *
          * Queue Item Outputs
          *
          */}
        {item[3].outputs && Object.values(item[3].outputs).length > 0 && appStatus.route === 'completed' &&
          <tr className="dark:odd:bg-neutral-900 odd:bg-neutral-100 gallery" key={"gallery" + item[3].db_id}>
            <td colSpan={3} className="px-3 py-1">
              <div className="flex flex-wrap gap-2 items">
                {Object.values(item[3].outputs).flatMap(output => {
                  const images = output.images ?? output.gifs ?? [];
                  return images.map(image => {
                    return <MediaItem file={image} key={image.filename} />
                  });
                })}
              </div>
            </td>
          </tr>
        }
      </>

    );
  }

  function LoaderSpinner() {
    return <span className="loader py-1 ">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
             stroke="currentColor" className="size-6"><path strokeLinecap="round" strokeLinejoin="round"
                                                            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
      </span>;
  }

  function QueueItems({running, pending, error, isLoading}) {
    if (error) return <TableCell colSpan={3} className="text-red-500 text-center info-cell">Loading
      failed: {error}</TableCell>;
    if (!isLoading && (!data || (!data.running.length && !data.pending.length))) return <TableCell colSpan={3}
                                                                                                   className="italic text-center info-cell">No
      items.</TableCell>;
    if (isLoading && !data) return <>
      <TableCell className="px-3 py-1 serial">
        <LoaderSpinner />
      </TableCell>
      <TableCell colSpan={2} className="italic text-center info-cell">Loading...</TableCell></>;

    return (
      <>
        {running.map(item => (
          <QueueItemRow item={item} key={item[1]} className={'running'} loader={true} mode={'running'}/>
        ))}
        {pending.map((item, index) => (
          <QueueItemRow item={item} key={item[3].db_id} className={'pending'} index={index}/>
        ))}
      </>
    );

  }

  useEffect(function () {
    if (!data) return;
    setState({
      pending: data.pending ? data.pending : [],
      running: data.running ? data.running : [],
    });
  }, [data]);



  return (
    <div className={"overflow-x-auto table-wrapper" + (isLoading ? ' loading' : '')} style={{"--job-progress": progress + "%"}}>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table className="min-w-full border border-0" size="small" stickyHeader>
            <TableHead className="dark:bg-neutral-800 bg-neutral-200 text-xs uppercase">
              <TableRow>
                <TableCell className="px-3 py-2 text-left">#</TableCell>
                <TableCell className="px-3 py-2 text-left">Workflow</TableCell>
                <TableCell className="px-3 py-2" align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <QueueItems isLoading={isLoading} running={state.running} pending={state.pending} error={error} />
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

    </div>
  );
}
