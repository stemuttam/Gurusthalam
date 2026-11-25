import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';

export type TableProps = HTMLAttributes<HTMLTableElement>;
export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;
export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;
export type TableFooterProps = HTMLAttributes<HTMLTableSectionElement>;
export type TableRowProps = HTMLAttributes<HTMLTableRowElement>;
export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement>;
export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;
export type TableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/* =====================================================
   TABLE PRIMITIVES
   ===================================================== */

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="gt-table__container" data-table-container="true">
      <table {...props} className={joinClasses('gt-table', className)} />
    </div>
  );
}

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead {...props} className={joinClasses('gt-table__header', className)} />
  );
}

export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody {...props} className={joinClasses('gt-table__body', className)} />
  );
}

export function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot {...props} className={joinClasses('gt-table__footer', className)} />
  );
}

export function TableRow({ className, ...props }: TableRowProps) {
  return <tr {...props} className={joinClasses('gt-table__row', className)} />;
}

export function TableHead({
  className,
  scope = 'col',
  ...props
}: TableHeadProps) {
  return (
    <th
      {...props}
      scope={scope}
      className={joinClasses('gt-table__head', className)}
    />
  );
}

export function TableCell({ className, ...props }: TableCellProps) {
  return <td {...props} className={joinClasses('gt-table__cell', className)} />;
}

export function TableCaption({ className, ...props }: TableCaptionProps) {
  return (
    <caption
      {...props}
      className={joinClasses('gt-table__caption', className)}
    />
  );
}

/* =====================================================
   DATA TABLE TYPES
   ===================================================== */

export interface DataTableSorting {
  id: string;
  desc: boolean;
}

export type DataTableSortingChange = DataTableSorting | null;

export interface DataTableColumn<TData> {
  id: string;
  header: ReactNode;
  accessorKey?: keyof TData;
  accessorFn?: (row: TData) => unknown;
  cell?: (value: unknown, row: TData) => ReactNode;
  enableSorting?: boolean;
  sortFn?: (
    left: unknown,
    right: unknown,
    leftRow: TData,
    rightRow: TData,
  ) => number;
  headerClassName?: string;
  cellClassName?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<TData> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  'data-testid'?: string;
  data: TData[];
  columns: DataTableColumn<TData>[];

  getRowId?: (row: TData, index: number) => string;

  enableSorting?: boolean;
  sorting?: DataTableSortingChange;
  defaultSorting?: DataTableSortingChange;
  onSortingChange?: (sorting: DataTableSortingChange) => void;

  enableRowSelection?: boolean;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectedRowIdsChange?: (selectedIds: string[]) => void;
  isRowSelectionDisabled?: (row: TData) => boolean;

  emptyMessage?: ReactNode;
  caption?: ReactNode;
  ariaLabel?: string;

  tableClassName?: string;
  rowClassName?: (row: TData, index: number) => string | undefined;
}

interface DataTableRow<TData> {
  id: string;
  original: TData;
  originalIndex: number;
}

/* =====================================================
   DATA TABLE UTILITIES
   ===================================================== */

function getDefaultRowId<TData>(row: TData, index: number): string {
  if (
    row !== null &&
    typeof row === 'object' &&
    'id' in row &&
    (typeof row.id === 'string' || typeof row.id === 'number')
  ) {
    return String(row.id);
  }

  return String(index);
}

function getColumnValue<TData>(
  column: DataTableColumn<TData>,
  row: TData,
): unknown {
  if (column.accessorFn) {
    return column.accessorFn(row);
  }

  if (column.accessorKey !== undefined) {
    return row[column.accessorKey];
  }

  return undefined;
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }

  if (left === null || left === undefined) {
    return 1;
  }

  if (right === null || right === undefined) {
    return -1;
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/* =====================================================
   ACCESSIBLE SELECTION CHECKBOX
   ===================================================== */

interface IndeterminateCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}

function IndeterminateCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  ariaLabel,
}: IndeterminateCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="gt-table__checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

/* =====================================================
   DATA TABLE
   ===================================================== */

export function DataTable<TData>({
  data,
  columns,
  getRowId = getDefaultRowId,

  enableSorting = true,
  sorting: controlledSorting,
  defaultSorting = null,
  onSortingChange,

  enableRowSelection = false,
  selectedRowIds: controlledSelectedRowIds,
  defaultSelectedRowIds = [],
  onSelectedRowIdsChange,
  isRowSelectionDisabled,

  emptyMessage = 'No records found.',
  caption,
  ariaLabel = 'Data table',

  tableClassName,
  rowClassName,
  className,
  ...props
}: DataTableProps<TData>) {
  /* ---------------------------------------------------
     SORTING STATE
     --------------------------------------------------- */

  const [uncontrolledSorting, setUncontrolledSorting] =
    useState<DataTableSortingChange>(defaultSorting);

  const isSortingControlled = controlledSorting !== undefined;

  const sorting = isSortingControlled ? controlledSorting : uncontrolledSorting;

  /* ---------------------------------------------------
     ROW SELECTION STATE
     --------------------------------------------------- */

  const [uncontrolledSelectedRowIds, setUncontrolledSelectedRowIds] = useState<
    string[]
  >(defaultSelectedRowIds);

  const isSelectionControlled = controlledSelectedRowIds !== undefined;

  const selectedRowIds = isSelectionControlled
    ? controlledSelectedRowIds
    : uncontrolledSelectedRowIds;

  const selectedIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds],
  );

  /* ---------------------------------------------------
     ROW MODEL
     --------------------------------------------------- */

  const rows = useMemo<DataTableRow<TData>[]>(
    () =>
      data.map((original, originalIndex) => ({
        id: getRowId(original, originalIndex),
        original,
        originalIndex,
      })),
    [data, getRowId],
  );

  /* ---------------------------------------------------
     SORTED ROW MODEL
     --------------------------------------------------- */

  const sortedRows = useMemo(() => {
    if (!enableSorting || !sorting) {
      return rows;
    }

    const column = columns.find((candidate) => candidate.id === sorting.id);

    if (!column || column.enableSorting === false) {
      return rows;
    }

    return [...rows].sort((left, right) => {
      const leftValue = getColumnValue(column, left.original);
      const rightValue = getColumnValue(column, right.original);

      const result = column.sortFn
        ? column.sortFn(leftValue, rightValue, left.original, right.original)
        : compareValues(leftValue, rightValue);

      return sorting.desc ? -result : result;
    });
  }, [columns, enableSorting, rows, sorting]);

  /* ---------------------------------------------------
     SELECTION DERIVATION
     --------------------------------------------------- */

  const selectableRows = sortedRows.filter(
    (row) => !isRowSelectionDisabled?.(row.original),
  );

  const selectedVisibleCount = selectableRows.filter((row) =>
    selectedIdSet.has(row.id),
  ).length;

  const allVisibleSelected =
    selectableRows.length > 0 && selectedVisibleCount === selectableRows.length;

  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  /* ---------------------------------------------------
     SORTING ACTIONS
     --------------------------------------------------- */

  function updateSorting(nextSorting: DataTableSortingChange) {
    if (!isSortingControlled) {
      setUncontrolledSorting(nextSorting);
    }

    onSortingChange?.(nextSorting);
  }

  function toggleSorting(column: DataTableColumn<TData>) {
    if (!enableSorting || column.enableSorting === false) {
      return;
    }

    let nextSorting: DataTableSortingChange;

    if (!sorting || sorting.id !== column.id) {
      nextSorting = {
        id: column.id,
        desc: false,
      };
    } else if (!sorting.desc) {
      nextSorting = {
        id: column.id,
        desc: true,
      };
    } else {
      nextSorting = null;
    }

    updateSorting(nextSorting);
  }

  /* ---------------------------------------------------
     ROW SELECTION ACTIONS
     --------------------------------------------------- */

  function updateSelection(nextIds: string[]) {
    if (!isSelectionControlled) {
      setUncontrolledSelectedRowIds(nextIds);
    }

    onSelectedRowIdsChange?.(nextIds);
  }

  function toggleRowSelection(rowId: string, checked: boolean) {
    const next = new Set(selectedRowIds);

    if (checked) {
      next.add(rowId);
    } else {
      next.delete(rowId);
    }

    updateSelection(Array.from(next));
  }

  function toggleAllVisibleRows(checked: boolean) {
    const next = new Set(selectedRowIds);

    for (const row of selectableRows) {
      if (checked) {
        next.add(row.id);
      } else {
        next.delete(row.id);
      }
    }

    updateSelection(Array.from(next));
  }

  /* ---------------------------------------------------
     RENDER
     --------------------------------------------------- */

  return (
    <div
      {...props}
      className={joinClasses('gt-data-table', className)}
      data-data-table="true"
    >
      <Table
        aria-label={ariaLabel}
        className={joinClasses('gt-data-table__table', tableClassName)}
      >
        {caption ? <TableCaption>{caption}</TableCaption> : null}

        <TableHeader>
          <TableRow>
            {enableRowSelection ? (
              <TableHead className="gt-data-table__selection-head">
                <IndeterminateCheckbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  disabled={selectableRows.length === 0}
                  ariaLabel="Select all visible rows"
                  onChange={toggleAllVisibleRows}
                />
              </TableHead>
            ) : null}

            {columns.map((column) => {
              const canSort = enableSorting && column.enableSorting !== false;

              const activeSort = sorting?.id === column.id ? sorting : null;

              const ariaSort = activeSort
                ? activeSort.desc
                  ? 'descending'
                  : 'ascending'
                : 'none';

              const headerLabel =
                typeof column.header === 'string' ? column.header : column.id;

              return (
                <TableHead
                  key={column.id}
                  className={column.headerClassName}
                  aria-sort={canSort ? ariaSort : undefined}
                  style={{ textAlign: column.align }}
                >
                  {canSort ? (
                    <button
                      type="button"
                      className="gt-data-table__sort-button"
                      onClick={() => toggleSorting(column)}
                      aria-label={`Sort by ${headerLabel}`}
                    >
                      <span>{column.header}</span>

                      <span
                        className="gt-data-table__sort-indicator"
                        aria-hidden="true"
                      >
                        {activeSort ? (activeSort.desc ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (enableRowSelection ? 1 : 0)}
                className="gt-data-table__empty"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedRows.map((row) => {
              const selectionDisabled =
                isRowSelectionDisabled?.(row.original) ?? false;

              return (
                <TableRow
                  key={row.id}
                  className={rowClassName?.(row.original, row.originalIndex)}
                  data-selected={selectedIdSet.has(row.id) ? 'true' : undefined}
                >
                  {enableRowSelection ? (
                    <TableCell className="gt-data-table__selection-cell">
                      <IndeterminateCheckbox
                        checked={selectedIdSet.has(row.id)}
                        disabled={selectionDisabled}
                        ariaLabel={`Select row ${row.id}`}
                        onChange={(checked) =>
                          toggleRowSelection(row.id, checked)
                        }
                      />
                    </TableCell>
                  ) : null}

                  {columns.map((column) => {
                    const value = getColumnValue(column, row.original);

                    return (
                      <TableCell
                        key={column.id}
                        className={column.cellClassName}
                        style={{ textAlign: column.align }}
                      >
                        {column.cell
                          ? column.cell(value, row.original)
                          : value === null || value === undefined
                            ? ''
                            : String(value)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {enableRowSelection ? (
        <div
          className="gt-data-table__selection-status"
          role="status"
          aria-live="polite"
        >
          {selectedRowIds.length} selected
        </div>
      ) : null}
    </div>
  );
}
