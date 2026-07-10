'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '../library/shadcn/alert';
import { Toaster } from 'sonner';

const ImageArtifacts = ({ processId }: {
  processId: string
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let isMounted = true;
    const imageElement = imgRef.current;

    const fetchAndStreamImages = async () => {
      try {
        setIsLoading(true);

        if (imageElement) {
          const streamUrl = `/api/workflows/process/${processId}/artifacts?type=images`;

          // Set up events to monitor the image loading state
          imageElement.onload = () => {
            if (isMounted) {
              setIsLoading(false);
            }
          };

          imageElement.onerror = () => {
            if (isMounted) {
              // Try to reconnect after a delay if there's an error
              setTimeout(() => {
                if (isMounted) {
                  fetchAndStreamImages();
                }
              }, 100);
            }
          };

          // Set the image source to the stream URL
          imageElement.src = streamUrl;
        }
      } catch (err) {
        // Only set error if the component is still mounted, and it's not an abort error
        if (isMounted && !(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Error fetching image stream:', err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    fetchAndStreamImages();

    // Cleanup function
    return () => {
      isMounted = false;

      // Clear image src if using direct approach
      if (imageElement) {
        imageElement.src = '';
        imageElement.onload = null;
        imageElement.onerror = null;
      }
    };
  }, [processId]);

  return (
    <div className="mt-2 mb-6">
      <Alert
        className={`${error ? 'bg-red-100 border-red-600 text-red-600' : 'bg-green-100 border-green-600 text-green-600'}`}>
        <AlertDescription>
          <Toaster />
          {isLoading && (
            <div className="flex justify-center items-center py-4">
              <div
                className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
              <span
                className="ml-2">Loading... Content will appear here as soon as it is processed.</span>
            </div>
          )}

          {error && (
            <div className="py-2"> {error} </div>
          )}

          <div className="mt-2">
            <div
              className="relative rounded-md overflow-hidden border border-green-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                alt="Web browsing artifacts"
                className="object-cover w-full h-full"
                style={{ display: 'block' }}
              />
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ImageArtifacts;
