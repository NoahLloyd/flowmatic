import React from "react";
import { Tag, X, LayoutPanelTop } from "lucide-react";
import type { Bucket, Note } from "../Notes";

interface TagBucketsProps {
  buckets: Bucket[];
  activeBucket: string;
  setActiveBucket: React.Dispatch<React.SetStateAction<string>>;
  availableTags: string[];
  notes: Note[];
  handleDropOnBucket: (bucketId: string, noteId: string) => Promise<void>;
  draggedNote: string | null;
  showAllTags: boolean;
  setShowAllTags: React.Dispatch<React.SetStateAction<boolean>>;
}

const TagBuckets: React.FC<TagBucketsProps> = ({
  buckets,
  activeBucket,
  setActiveBucket,
  availableTags,
  notes,
  handleDropOnBucket,
  draggedNote,
  showAllTags,
  setShowAllTags,
}) => {
  return (
    <>
      {/* Category Buckets */}
      <div className="flex mb-6 overflow-x-auto pb-2">
        <div className="flex gap-3 flex-nowrap">
          {buckets.map((bucket) => {
            // Correctly count notes for this bucket
            const noteCount = notes.filter(bucket.filter).length;

            return (
              <div
                key={bucket.id}
                className={`relative p-3 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-700 ${
                  activeBucket === bucket.id
                    ? bucket.color
                    : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/70"
                }`}
                style={{ minWidth: "140px", maxWidth: "180px" }}
                onClick={() => setActiveBucket(bucket.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add(
                    "bg-blue-50",
                    "dark:bg-blue-900/20"
                  );
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove(
                    "bg-blue-50",
                    "dark:bg-blue-900/20"
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove(
                    "bg-blue-50",
                    "dark:bg-blue-900/20"
                  );
                  if (draggedNote) {
                    handleDropOnBucket(bucket.id, draggedNote);
                  }
                }}
              >
                <div className="flex items-center mb-1">
                  <span className="mr-2 text-gray-700 dark:text-gray-300">
                    {bucket.icon}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {bucket.name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {noteCount} {noteCount === 1 ? "note" : "notes"}
                  </span>
                </div>
              </div>
            );
          })}

          {availableTags.length > 5 && (
            <div
              className="relative p-3 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/70"
              style={{ minWidth: "140px", maxWidth: "180px" }}
              onClick={() => setShowAllTags(true)}
            >
              <div className="flex items-center mb-1">
                <span className="mr-2 text-gray-700 dark:text-gray-300">
                  <Tag className="w-4 h-4" />
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  See all tags
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Tags Modal */}
      {showAllTags && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                All Tags
              </h3>
              <button
                onClick={() => setShowAllTags(false)}
                className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {availableTags.map((tag) => {
                // Correctly count notes for this tag
                const tagCount = notes.filter((note) =>
                  note.tags?.includes(tag)
                ).length;

                // Create bucket ID consistent with the bucket filter
                const tagBucketId = `tag-${tag}`;

                return (
                  <button
                    key={tag}
                    onClick={() => {
                      setActiveBucket(tagBucketId);
                      setShowAllTags(false);
                    }}
                    className={`flex flex-col p-3 rounded-lg ${
                      activeBucket === tagBucketId
                        ? "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800"
                        : "bg-gray-50 dark:bg-gray-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 border-gray-200 dark:border-gray-700"
                    } border`}
                  >
                    <div className="flex items-center mb-1">
                      <Tag className="w-4 h-4 mr-2 text-gray-600 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        #{tag}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {tagCount} {tagCount === 1 ? "note" : "notes"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAllTags(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TagBuckets;
