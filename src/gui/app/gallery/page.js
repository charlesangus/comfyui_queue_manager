"use client";

import {useEffect, useState} from "react";

import IconButton from "@mui/material/IconButton";
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';


import {baseURL} from "@/internals/config";
import useEvent from "react-use-event-hook";

export default function Gallery() {
  /**
   * Gallery state
   * @type {Array} - array of gallery items
   */
  const [ galleryItems, setGalleryItems ] = useState(null);
  const [ mediaItem, setMediaItem ] = useState(null);


  /**
   * Fetches the gallery metadata and info about item if specified
   * @param item {string|null} - queue item ID
   * @returns {Promise<void>}
   */
  const fetchGallery = async (item) => {
    const itemQuery = item ? `?item=${encodeURIComponent(item)}` : '';

    try {
      const response = await fetch('/queue_manager/gallery' + itemQuery);
      if (!response.ok) {
        throw new Error('Failed to fetch gallery');
      }
      const data = await response.json();
      console.log('Gallery data:', data);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  function closeGallery() {
    // Post message to parent window to close gallery
    window.parent.postMessage({ type: "QM_Gallery_Close" }, "*");
  }

  function totalItemImages(item) {
    // Calculate total of all images in all nodes of the queue item, queueItem.outputs is an array with nodes
    return item.outputs.reduce((acc, node) => {
      if (node.images && Array.isArray(node.images)) {
        return acc + node.images.length;
      }
      return acc;
    }, 0);
  }

  function nextImage() {
    let newData = null;

    // us there next file in the current node?
    if (mediaItem.fileIndex < mediaItem.node.images.length - 1) {
      newData = {
        fileIndex: mediaItem.fileIndex + 1,
        file: mediaItem.node.images[mediaItem.fileIndex + 1]
      }

    // is there next node in the current queue item?
    } else if (mediaItem.nodeIndex < mediaItem.queueItem.outputs.length - 1) {
      // yes, increment nodeIndex and reset fileIndex to 0
      const nextNodeIndex = mediaItem.nodeIndex + 1;
      const nextNode = mediaItem.queueItem.outputs[nextNodeIndex];
      newData = {
        nodeIndex: nextNodeIndex,
        node: nextNode,
        fileIndex: 0,
        file: nextNode.images[0]
      }

    // is there next item in the gallery?
    } else if (mediaItem.itemIndex < galleryItems.length - 1) {
      const nextItemIndex = mediaItem.itemIndex + 1;
      const nextQueueItem = galleryItems[nextItemIndex];
      const nextNode = nextQueueItem.outputs[0];
      newData = {
        itemIndex: nextItemIndex,
        queueItem: nextQueueItem,
        nodeIndex: 0,
        node: nextNode,
        fileIndex: 0,
        file: nextNode.images[0],
        totalImages: totalItemImages(nextQueueItem)
      }
    }

    if (newData) {
      setMediaItem(prev => ({
        ...prev,
        ...newData
      }));
    }
  }
  function previousImage() {
    let newData = null;

    // is there previous file in the current node?
    if (mediaItem.fileIndex > 0) {
      newData = {
        fileIndex: mediaItem.fileIndex - 1,
        file: mediaItem.node.images[mediaItem.fileIndex - 1]
      }

    // is there previous node in the current queue item?
    } else if (mediaItem.nodeIndex > 0) {
      const prevNodeIndex = mediaItem.nodeIndex - 1;
      const prevNode = mediaItem.queueItem.outputs[prevNodeIndex];
      newData = {
        nodeIndex: prevNodeIndex,
        node: prevNode,
        fileIndex: prevNode.images.length - 1,
        file: prevNode.images[prevNode.images.length - 1]
      }

    // is there previous item in the gallery?
    } else if (mediaItem.itemIndex > 0) {
      const prevItemIndex = mediaItem.itemIndex - 1;
      const prevQueueItem = galleryItems[prevItemIndex];
      const prevNode = prevQueueItem.outputs[prevQueueItem.outputs.length - 1];
      newData = {
        itemIndex: prevItemIndex,
        queueItem: prevQueueItem,
        nodeIndex: prevQueueItem.outputs.length - 1,
        node: prevNode,
        fileIndex: prevNode.images.length - 1,
        file: prevNode.images[prevNode.images.length - 1],
        totalImages: totalItemImages(prevQueueItem)
      }
    }

    if (newData) {
      setMediaItem(prev => ({
        ...prev,
        ...newData
      }));
    }
  }

  const handleMessage = useEvent((event) => {
    const { type } = event.data;

    // Request to load gallery item
    if (type === "QM_Gallery_Load") {
      console.log('Gallery loaded:', event.data);
      const data = event.data.galleryData;
      const items = data.items ? data.items : galleryItems;

      // in items find one that has promptID equal to data.promptID
      if (!items || items.length === 0) {
        console.error('No items found in gallery data:', data);
        return;
      }
      const itemIndex = items.findIndex(item => item.promptID === data.promptID);
      if (itemIndex === -1) {
        console.error('Item with promptID not found in gallery data:', data.promptID);
        return;
      }

      const queueItem = items[itemIndex];

      const nodeIndex = queueItem.outputs.findIndex(item => item.nodeKey === data.nodeKey);

      if (nodeIndex === -1) {
        console.error('Node not found in queue item outputs:', data.nodeKey);
        return;
      }
      const node = queueItem.outputs[nodeIndex];
      const file = node.images[data.fileIndex];

      // calculate total of all images in all nodes of the queue item, queueItem.outputs is an array with nodes
      const totalImages = totalItemImages(queueItem);

      if (data.items) {
        setGalleryItems(data.items);
      }

      setMediaItem({
        itemIndex: itemIndex,
        queueItem: queueItem,
        nodeIndex: nodeIndex,
        node: node,
        fileIndex: data.fileIndex,
        file: file,
        totalImages: totalImages
      });
    }

  });

  useEffect(() => {
    /**
     * Messages from iframe
     */
    window.addEventListener("message", handleMessage, false);
  }, []);


  return (
    <div className={"gallery-page"}>

      <IconButton size="large" variant="contained" className={"close-button"} onClick={closeGallery}>
        <DisabledByDefaultIcon fontSize="large" />
      </IconButton>

      {galleryItems &&
      <div className="image-box">
        <header>{mediaItem.queueItem.workflowName} <span>({mediaItem.fileIndex+1} / {mediaItem.totalImages})</span></header>

        <figure>
          <img
            src={baseURL + `api/view?filename=${mediaItem.file.filename}&type=output&subfolder=${mediaItem.file.subfolder}`}
            alt={mediaItem.file.filename}
          />
          <figcaption>
            {/*<Button variant="contained" color="primary" onClick={() => fetchGallery(gallery.itemIndex)}>*/}
            {/*  Reload Gallery*/}
            {/*</Button>*/}
          </figcaption>
        </figure>
        <nav className={"gallery-nav"}>
          <IconButton color="primary" size="large" onClick={previousImage}
                      // disabled={mediaItem.fileIndex === 0}
                      className={"previous-button"}>
            <ArrowForwardIosIcon fontSize="inherit" />
          </IconButton>
          <IconButton color="primary" size="large" onClick={nextImage}
                      // disabled={mediaItem.fileIndex === mediaItem.totalImages - 1}
                      className={"next-button"}>
            <ArrowForwardIosIcon fontSize="inherit" />
          </IconButton>
        </nav>

        <footer></footer>
      </div>
      }
    </div>
  );
}
