import type { ModalProps } from "antd";
import { Modal } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DraggableData, DraggableEvent } from "react-draggable";
import Draggable from "react-draggable";
const DraggableModal: React.FC<ModalProps> = ({
  title,
  open,
  modalRender,
  ...rest
}) => {
  const [dragDisabled, setDragDisabled] = useState(true);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const draggleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [open]);
  const dragTitle = useMemo(
    () => (
      <div
        style={{ width: "100%", cursor: "move" }}
        onMouseOver={() => {
          if (dragDisabled) {
            setDragDisabled(false);
          }
        }}
        onMouseOut={() => setDragDisabled(true)}
      >
        {title ?? ""}
      </div>
    ),
    [dragDisabled, title]
  );
  const handleDrag = (event: DraggableEvent, uiData: DraggableData) => {
    setDragOffset({ x: uiData.x, y: uiData.y });
  };
  return (
    <Modal
      {...rest}
      open={open}
      title={dragTitle}
      modalRender={(modal) => (
        <Draggable
          disabled={dragDisabled}
          nodeRef={draggleRef}
          position={dragOffset}
          onDrag={handleDrag}
        >
          <div ref={draggleRef}>
            {modalRender ? modalRender(modal) : modal}
          </div>
        </Draggable>
      )}
    />
  );
};
export default DraggableModal;
