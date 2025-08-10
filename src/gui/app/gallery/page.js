"use client";

import {useEffect, useState} from "react";

import IconButton from "@mui/material/IconButton";
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import KeyboardDoubleArrowRightSharpIcon from '@mui/icons-material/KeyboardDoubleArrowRightSharp';
import KeyboardDoubleArrowLeftSharpIcon from '@mui/icons-material/KeyboardDoubleArrowLeftSharp';


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

  function previousImage() {

    // is there previous file in the current node?
    if (mediaItem.fileIndex > 0) {
      setMediaItem(prev => ({
        ...prev,
        fileIndex: mediaItem.fileIndex - 1,
        file: mediaItem.node.images[mediaItem.fileIndex - 1]
      }));

      return;
    }

    // no more image, show previous node with last file
    previousNode(true);
  }

  function previousNode(showLastFile = false) {
    // is there previous node in the current queue item?
    if (mediaItem.nodeIndex > 0) {
      const prevNodeIndex = mediaItem.nodeIndex - 1;
      const prevNode = mediaItem.queueItem.outputs[prevNodeIndex];
      // if showLastFile is true, then show last file in the previous node
      const prevFileIndex = showLastFile ? prevNode.images.length - 1 : 0;

      setMediaItem(prev => ({
        ...prev,
        nodeIndex: prevNodeIndex,
        node: prevNode,
        fileIndex: prevFileIndex,
        file: prevNode.images[prevFileIndex]
      }));

      return;
    }

    // no more nodes, show previous item with last file
    previousItem(showLastFile);
  }

  function previousItem(showLastFile = false) {
    // is there previous item in the gallery?
    if (mediaItem.itemIndex > 0) {
      const prevItemIndex = mediaItem.itemIndex - 1;
      const prevQueueItem = galleryItems[prevItemIndex];
      // if showLastFile is true, then show last file in the previous node
      const prevNodeIndex = showLastFile ? mediaItem.queueItem.outputs.length - 1 : 0;
      const prevNode = prevQueueItem.outputs[prevNodeIndex];
      const prevFileIndex = showLastFile ? prevNode.images.length - 1 : 0;

      setMediaItem(prev => ({
        ...prev,
        itemIndex: prevItemIndex,
        queueItem: prevQueueItem,
        nodeIndex: prevNodeIndex,
        node: prevNode,
        fileIndex: prevFileIndex,
        file: prevNode.images[prevFileIndex],
        totalImages: totalItemImages(prevQueueItem)
      }));
    }
  }

  function nextImage() {
    let newData = null;

    // us there next file in the current node?
    if (mediaItem.fileIndex < mediaItem.node.images.length - 1) {
      setMediaItem(prev => ({
        ...prev,
        fileIndex: mediaItem.fileIndex + 1,
        file: mediaItem.node.images[mediaItem.fileIndex + 1]
      }));

      return;
    }

    // no more image, show next node
    nextNode();
  }

  function nextNode() {
    // is there next node in the current queue item?
    if (mediaItem.nodeIndex < mediaItem.queueItem.outputs.length - 1) {
      const nextNodeIndex = mediaItem.nodeIndex + 1;
      const nextNode = mediaItem.queueItem.outputs[nextNodeIndex];

      setMediaItem(prev => ({
        ...prev,
        nodeIndex: nextNodeIndex,
        node: nextNode,
        fileIndex: 0,
        file: nextNode.images[0]
      }));

      return;
    }

    // no more nodes, show next item
    nextItem();
  }

  function nextItem() {
    // is there next item in the gallery?
    if (mediaItem.itemIndex < galleryItems.length - 1) {
      const nextItemIndex = mediaItem.itemIndex + 1;
      const nextQueueItem = galleryItems[nextItemIndex];
      const nextNode = nextQueueItem.outputs[0];

      setMediaItem(prev => ({
        ...prev,
        itemIndex: nextItemIndex,
        queueItem: nextQueueItem,
        nodeIndex: 0,
        node: nextNode,
        fileIndex: 0,
        file: nextNode.images[0],
        totalImages: totalItemImages(nextQueueItem)
      }));
    }
  }

  function isFirstItem() {
    return mediaItem.itemIndex === 0;
  }
  function isLastItem() {
    return mediaItem.itemIndex === galleryItems.length - 1;
  }
  function isFirstNode() {
    return mediaItem.nodeIndex === 0 && isFirstItem();
  }
  function isLastNode() {
    return mediaItem.nodeIndex === mediaItem.queueItem.outputs.length - 1 &&
           isLastItem();
  }
  function isFirstImage() {
    return mediaItem.fileIndex === 0 && isFirstNode();
  }
  function isLastImage() {
    return mediaItem.fileIndex === mediaItem.node.images.length - 1 && isLastNode();
  }

  const handleMessage = useEvent((event) => {
    if (event.origin !== (baseURL === '/' ? window.location.protocol + "//" + window.location.host : baseURL.replace(/\/+$/, ""))) {
      return;
    }

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
          <div className={'node-thumbs'}>
            <button type={"button"} className={"prev-node" + (isFirstNode() ? ' inactive':'')} onClick={() => previousNode()} title={'Previous Node'}>
              <KeyboardDoubleArrowLeftSharpIcon fontSize="inherit" />
            </button>

            {/*  Display all images from the node */}
            {mediaItem.node.images.map((image, index) => (
                <img
                  key={index}
                  src={baseURL + `api/view?filename=${image.filename}&type=output&subfolder=${image.subfolder}`}
                  alt={image.filename}
                  className={`node-thumb ${index === mediaItem.fileIndex ? 'active' : ''}`}
                  onClick={() => setMediaItem(prev => ({
                    ...prev,
                    fileIndex: index,
                    file: image
                  }))}
                />
            ))}

            <button type={"button"} className={"next-node" + (isLastNode() ? ' inactive':'')} onClick={() => nextNode()} title={'Next Node'}>
              <KeyboardDoubleArrowRightSharpIcon fontSize="inherit" />
            </button>
          </div>
        </figure>
        <nav className={"gallery-nav"}>
          {!isFirstImage() &&
            <IconButton color="primary" size="large" onClick={() => previousImage()}
              // disabled={mediaItem.fileIndex === 0}
                        className={"previous-button"} title={'Previous Image'}>
              <ArrowForwardIosIcon fontSize="inherit"/>
            </IconButton>
          }

          {!isLastImage() &&
            <IconButton color="primary" size="large" onClick={() => nextImage()}
              // disabled={mediaItem.fileIndex === mediaItem.totalImages - 1}
                        className={"next-button"} title={'Next Image'}>
              <ArrowForwardIosIcon fontSize="inherit" />
            </IconButton>
          }
        </nav>

        <nav className={"footer-nav"}>
        {/*  Nav to go to next / previous item.*/}
          {mediaItem.itemIndex > 0 && (
            <button type={"button"} className={"prev-item"} onClick={() => previousItem()} title={'Previous Prompt'}>
              <KeyboardDoubleArrowLeftSharpIcon fontSize="inherit" />
              <img
                src={baseURL + `api/view?filename=${galleryItems[mediaItem.itemIndex - 1].outputs[0].images[0].filename}&type=output&subfolder=${galleryItems[mediaItem.itemIndex - 1].outputs[0].images[0].subfolder}`}
                alt={galleryItems[mediaItem.itemIndex - 1].outputs[0].images[0].filename}
              />
            </button>
          )}

          {mediaItem.itemIndex < galleryItems.length - 1 && (
            <button type={"button"} className={"next-item"} onClick={() => nextItem()} title={'Next Prompt'}>
              <KeyboardDoubleArrowRightSharpIcon fontSize="inherit" />
              <img
                src={baseURL + `api/view?filename=${galleryItems[mediaItem.itemIndex + 1].outputs[0].images[0].filename}&type=output&subfolder=${galleryItems[mediaItem.itemIndex + 1].outputs[0].images[0].subfolder}`}
                alt={galleryItems[mediaItem.itemIndex + 1].outputs[0].images[0].filename}
              />
            </button>
          )}
        </nav>

      </div>
      }
    </div>
  );
}
