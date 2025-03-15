declare module "react-beautiful-dnd" {
  import * as React from "react";

  // Basic types
  export type DraggableId = string;
  export type DroppableId = string;
  export type DraggableLocation = {
    droppableId: DroppableId;
    index: number;
  };
  export type DropResult = {
    draggableId: DraggableId;
    type: TypeId;
    source: DraggableLocation;
    destination?: DraggableLocation;
    reason: "DROP" | "CANCEL";
  };
  export type TypeId = string;

  // Draggable
  export interface DraggableProps {
    draggableId: DraggableId;
    index: number;
    isDragDisabled?: boolean;
    disableInteractiveElementBlocking?: boolean;
    children: (
      provided: DraggableProvided,
      snapshot: DraggableStateSnapshot
    ) => React.ReactNode;
  }
  export interface DraggableProvided {
    innerRef: (element?: HTMLElement | null) => void;
    draggableProps: DraggableProvidedDraggableProps;
    dragHandleProps: DraggableProvidedDragHandleProps | null;
  }
  export interface DraggableProvidedDraggableProps {
    style?: React.CSSProperties;
    "data-rbd-draggable-context-id": string;
    "data-rbd-draggable-id": string;
    [key: string]: any;
  }
  export interface DraggableProvidedDragHandleProps {
    "data-rbd-drag-handle-draggable-id": string;
    "data-rbd-drag-handle-context-id": string;
    role: string;
    tabIndex: number;
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLElement>) => void;
    [key: string]: any;
  }
  export interface DraggableStateSnapshot {
    isDragging: boolean;
    isDropAnimating: boolean;
    dropAnimation?: {
      duration: number;
      curve: string;
      moveTo: {
        x: number;
        y: number;
      };
    };
    draggingOver?: DroppableId;
    combineWith?: DraggableId;
    combineTargetFor?: DraggableId;
    mode?: string;
  }

  // Droppable
  export interface DroppableProps {
    droppableId: DroppableId;
    type?: TypeId;
    isDropDisabled?: boolean;
    direction?: string;
    ignoreContainerClipping?: boolean;
    children: (
      provided: DroppableProvided,
      snapshot: DroppableStateSnapshot
    ) => React.ReactNode;
  }
  export interface DroppableProvided {
    innerRef: (element?: HTMLElement | null) => void;
    droppableProps: DroppableProvidedProps;
    placeholder: React.ReactNode;
  }
  export interface DroppableProvidedProps {
    "data-rbd-droppable-context-id": string;
    "data-rbd-droppable-id": string;
    [key: string]: any;
  }
  export interface DroppableStateSnapshot {
    isDraggingOver: boolean;
    draggingOverWith?: DraggableId;
    draggingFromThisWith?: DraggableId;
  }

  // DragDropContext
  export interface DragDropContextProps {
    onDragStart?: (start: DragStart) => void;
    onDragUpdate?: (update: DragUpdate) => void;
    onDragEnd: (result: DropResult) => void;
    children: React.ReactNode;
  }
  export interface DragStart {
    draggableId: DraggableId;
    type: TypeId;
    source: DraggableLocation;
  }
  export interface DragUpdate {
    draggableId: DraggableId;
    type: TypeId;
    source: DraggableLocation;
    destination?: DraggableLocation;
  }

  // Components
  export class DragDropContext extends React.Component<DragDropContextProps> {}
  export class Droppable extends React.Component<DroppableProps> {}
  export class Draggable extends React.Component<DraggableProps> {}
}
