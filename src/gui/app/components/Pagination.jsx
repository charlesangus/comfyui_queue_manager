import { MenuItem, Pagination, Select } from "@mui/material";

export function QueuePagination({ info, onPageChange }) {
  if (!info || !(info.last_page > 0)) {
    return null;
  }

  return (
    <div className={"pagination"}>
      <Pagination
        shape="rounded"
        variant="outlined"
        boundaryCount={2}
        siblingCount={2}
        page={info.page + 1}
        onChange={(event, value) => {
          onPageChange(value - 1);
        }}
        count={info.last_page + 1}></Pagination>

      {info.last_page > 10 &&
        <div className="page-selector">
          <Select
            value={info.page}
            onChange={(event) => {
              onPageChange(event.target.value);
            }}
            size="small"
          >
            {[...Array(info.last_page + 1).keys()].map((pageNum) => (
              <MenuItem
                key={pageNum}
                value={pageNum}
              >
                {pageNum + 1}
              </MenuItem>
            ))}
          </Select>
        </div>
      }
    </div>
  );
}
