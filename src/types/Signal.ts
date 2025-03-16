export interface Signal {
  type: "binary" | "number" | "water" | "scale";
  value: number | boolean;
  timestamp?: string | Date;
  metric: string;
  date?: string;
}

export type SignalStatus = "active" | "inactive";

export interface SignalHistory {
  date: string;
  value: number | boolean;
}

export interface AllSignalsHistory {
  [signalKey: string]: SignalHistory[];
}
