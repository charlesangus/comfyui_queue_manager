"use client";

import {useEffect} from "react";

export default function Gallery() {

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


  useEffect(() => {
    fetchGallery();
  }, []);


  return (
    <div className="gallery-page">
      <h1>Gallery</h1>
      <p>This is the gallery page where you can view images.</p>
      {/* Add your gallery components here */}
    </div>
  );
}
