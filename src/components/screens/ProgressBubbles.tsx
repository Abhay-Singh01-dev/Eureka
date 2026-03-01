import React, { type FC } from "react";

interface ProgressBubblesProps {
  totalScreens: number;
  currentScreen: number;
  completedScreens: number[];
}

const ProgressBubbles: FC<ProgressBubblesProps> = ({
  totalScreens,
  currentScreen,
  completedScreens,
}) => {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 px-4">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalScreens }, (_, i) => {
          const screenId = i + 1;
          const isCompleted = completedScreens.includes(screenId);
          const isCurrent = screenId === currentScreen;

          let stateClass = "scrn-bubble--future";
          if (isCompleted) stateClass = "scrn-bubble--completed";
          else if (isCurrent) stateClass = "scrn-bubble--current";

          return (
            <span
              key={screenId}
              data-bubble-id={screenId}
              className={`scrn-bubble ${stateClass}`}
              aria-label={
                isCompleted
                  ? `Screen ${screenId} completed`
                  : isCurrent
                    ? `Screen ${screenId} current`
                    : `Screen ${screenId} upcoming`
              }
            />
          );
        })}
      </div>
      <span className="text-xs text-gray-400 font-medium select-none">
        Screen {currentScreen} of {totalScreens}
      </span>
    </div>
  );
};

export default ProgressBubbles;
