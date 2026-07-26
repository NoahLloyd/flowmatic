import React from "react";
import { linkifyText } from "../../utils/linkifyText";

interface LinkifiedTaskTextProps {
  text: string;
}

const openLink = async (href: string) => {
  try {
    if (window.electron?.openExternal) {
      const opened = await window.electron.openExternal(href);
      if (opened) return;
    }
  } catch (error) {
    console.error("Failed to open link through Electron:", error);
  }

  window.open(href, "_blank", "noopener,noreferrer");
};

const LinkifiedTaskText: React.FC<LinkifiedTaskTextProps> = ({ text }) => (
  <>
    {linkifyText(text).map((segment, index) =>
      segment.type === "link" ? (
        <a
          key={`${segment.href}-${index}`}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-blue-600 underline decoration-blue-400/60 underline-offset-2 hover:text-blue-700 hover:decoration-blue-600 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:decoration-blue-500/60 dark:hover:text-blue-300"
          title={`Open ${segment.href}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openLink(segment.href);
          }}
          onAuxClick={(event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            event.stopPropagation();
            void openLink(segment.href);
          }}
        >
          {segment.value}
        </a>
      ) : (
        <React.Fragment key={`text-${index}`}>{segment.value}</React.Fragment>
      ),
    )}
  </>
);

export default LinkifiedTaskText;
