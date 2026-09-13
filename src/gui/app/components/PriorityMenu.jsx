"use client";

import { useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import LowPriorityIcon from "@mui/icons-material/LowPriority";

import { apiCall } from "../internals/functions";

const PRIORITY_MIN = -100;
const PRIORITY_MAX = 100;

export function PriorityMenu({ dbIds, onDone }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [customValue, setCustomValue] = useState("");

  const handleClose = () => setAnchorEl(null);

  const applyPriority = async (priority) => {
    await apiCall("queue_manager/priority", { items: dbIds, priority }, "POST");
    handleClose();
    setCustomValue("");
    await onDone();
  };

  const handleCustomApply = () => {
    if (customValue === "") return;
    const parsed = Math.round(Number(customValue));
    if (!Number.isFinite(parsed)) return;
    applyPriority(Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, parsed)));
  };

  return (
    <>
      <button
        className="qm-btn"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        title="Set priority"
      >
        <LowPriorityIcon fontSize="small" />
        &nbsp;Priority
      </button>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem onClick={() => applyPriority(-1)}>Low (−1)</MenuItem>
        <MenuItem onClick={() => applyPriority(0)}>Normal (0)</MenuItem>
        <MenuItem onClick={() => applyPriority(1)}>High (+1)</MenuItem>
        <MenuItem
          disableRipple
          className="priority-custom"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <TextField
            type="number"
            size="small"
            label="Custom"
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            slotProps={{ htmlInput: { min: PRIORITY_MIN, max: PRIORITY_MAX } }}
          />
          <button className="qm-btn qm-btn-primary" onClick={handleCustomApply} disabled={customValue === ""}>
            Apply
          </button>
        </MenuItem>
      </Menu>
    </>
  );
}
