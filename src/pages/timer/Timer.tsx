import React from "react";
import TimerDisplay from "./TimerDisplay";

const Timer = () => {
  return (
    <div className="">
      <TimerDisplay initialTime={3600} />
    </div>
  );
};

export default Timer;
