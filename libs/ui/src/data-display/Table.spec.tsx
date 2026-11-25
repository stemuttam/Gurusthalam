import type { DataTableProps, DataTableColumn } from './Table.js';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DataTable,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './Table.js';

interface Student {
  id: string;
  name: string;
  score: number;
  active: boolean;
}

const students: Student[] = [
  { id: 'student-1', name: 'Aarav', score: 82, active: true },
  { id: 'student-2', name: 'Diya', score: 95, active: true },
  { id: 'student-3', name: 'Kabir', score: 71, active: false },
];

const columns: DataTableColumn<Student>[] = [
  {
    id: 'name',
    header: 'Student',
    accessorKey: 'name',
  },
  {
    id: 'score',
    header: 'Score',
    accessorKey: 'score',
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'active',
    cell: (value) => (value ? 'Active' : 'Inactive'),
    enableSorting: false,
  },
];

function renderDataTable(props: Partial<DataTableProps<Student>> = {}) {
  return render(
    <DataTable<Student> data={students} columns={columns} {...props} />,
  );
}

/* =====================================================
   TABLE PRIMITIVES
   ===================================================== */

describe('Table primitives', () => {
  it('renders semantic table elements', () => {
    render(
      <Table aria-label="Student records">
        <TableCaption>Student records</TableCaption>

        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow>
            <TableCell>Aarav</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('table', { name: 'Student records' })).toBeTruthy();

    expect(screen.getByText('Aarav')).toBeTruthy();
    expect(screen.getByText('Student records')).toBeTruthy();
  });

  it('preserves custom classes and attributes', () => {
    render(
      <Table className="custom-table" data-testid="table">
        <TableBody>
          <TableRow data-testid="row">
            <TableCell className="custom-cell">Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('table').className).toContain('custom-table');

    expect(screen.getByTestId('row')).toBeTruthy();

    expect(screen.getByText('Value').className).toContain('custom-cell');
  });
});

/* =====================================================
   DATA TABLE
   ===================================================== */

describe('DataTable', () => {
  it('renders column headers and row data', () => {
    renderDataTable();

    expect(screen.getByRole('columnheader', { name: /Student/ })).toBeTruthy();

    expect(screen.getByRole('columnheader', { name: /Score/ })).toBeTruthy();

    expect(screen.getByText('Aarav')).toBeTruthy();
    expect(screen.getByText('Diya')).toBeTruthy();
    expect(screen.getByText('Kabir')).toBeTruthy();
  });

  it('renders custom cell content', () => {
    renderDataTable();

    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Inactive')).toBeTruthy();
  });

  it('uses the configured accessible table label', () => {
    renderDataTable({
      ariaLabel: 'Class results',
    });

    expect(screen.getByRole('table', { name: 'Class results' })).toBeTruthy();
  });

  it('renders an empty state when there are no records', () => {
    renderDataTable({
      data: [],
      emptyMessage: 'No students available.',
    });

    expect(screen.getByText('No students available.')).toBeTruthy();
  });

  it('renders a custom caption', () => {
    renderDataTable({
      caption: 'Class 9 examination results',
    });

    expect(screen.getByText('Class 9 examination results')).toBeTruthy();
  });

  /* ---------------------------------------------------
     SORTING
     --------------------------------------------------- */

  it('sorts ascending when a sortable header is clicked', () => {
    renderDataTable();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Sort by Student',
      }),
    );

    const rows = screen.getAllByRole('row');

    expect(rows[1]?.textContent).toContain('Aarav');
    expect(rows[2]?.textContent).toContain('Diya');
    expect(rows[3]?.textContent).toContain('Kabir');
  });

  it('toggles sorting from ascending to descending', () => {
    renderDataTable();

    const sortButton = screen.getByRole('button', {
      name: 'Sort by Score',
    });

    fireEvent.click(sortButton);
    fireEvent.click(sortButton);

    const rows = screen.getAllByRole('row');

    expect(rows[1]?.textContent).toContain('Diya');
    expect(rows[2]?.textContent).toContain('Aarav');
    expect(rows[3]?.textContent).toContain('Kabir');
  });

  it('clears sorting on the third click', () => {
    renderDataTable();

    const sortButton = screen.getByRole('button', {
      name: 'Sort by Score',
    });

    fireEvent.click(sortButton);
    fireEvent.click(sortButton);
    fireEvent.click(sortButton);

    const rows = screen.getAllByRole('row');

    expect(rows[1]?.textContent).toContain('Aarav');
    expect(rows[2]?.textContent).toContain('Diya');
    expect(rows[3]?.textContent).toContain('Kabir');
  });

  it('does not render sorting controls for disabled columns', () => {
    renderDataTable();

    expect(
      screen.queryByRole('button', {
        name: 'Sort by Status',
      }),
    ).toBeNull();

    expect(
      screen.getByRole('columnheader', {
        name: 'Status',
      }),
    ).toBeTruthy();
  });

  it('supports controlled sorting', () => {
    const onSortingChange = vi.fn();

    renderDataTable({
      sorting: null,
      onSortingChange,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Sort by Student',
      }),
    );

    expect(onSortingChange).toHaveBeenCalledWith({
      id: 'name',
      desc: false,
    });
  });

  it('exposes the active sorting direction through aria-sort', () => {
    renderDataTable({
      sorting: {
        id: 'score',
        desc: true,
      },
    });

    expect(
      screen
        .getByRole('columnheader', { name: /Score/ })
        .getAttribute('aria-sort'),
    ).toBe('descending');
  });

  it('uses a custom sorting function', () => {
    const customColumns: DataTableColumn<Student>[] = [
      {
        id: 'name',
        header: 'Student',
        accessorKey: 'name',
        sortFn: (left, right) => String(right).localeCompare(String(left)),
      },
    ];

    renderDataTable({
      columns: customColumns,
      defaultSorting: {
        id: 'name',
        desc: false,
      },
    });

    const rows = screen.getAllByRole('row');

    expect(rows[1]?.textContent).toContain('Kabir');
    expect(rows[2]?.textContent).toContain('Diya');
    expect(rows[3]?.textContent).toContain('Aarav');
  });

  /* ---------------------------------------------------
     ROW SELECTION
     --------------------------------------------------- */

  it('renders row selection controls when enabled', () => {
    renderDataTable({
      enableRowSelection: true,
    });

    expect(
      screen.getByRole('checkbox', {
        name: 'Select all visible rows',
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('checkbox', {
        name: 'Select row student-1',
      }),
    ).toBeTruthy();
  });

  it('selects an individual row', () => {
    const onSelectedRowIdsChange = vi.fn();

    renderDataTable({
      enableRowSelection: true,
      onSelectedRowIdsChange,
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select row student-1',
      }),
    );

    expect(onSelectedRowIdsChange).toHaveBeenCalledWith(['student-1']);
  });

  it('selects all visible rows', () => {
    const onSelectedRowIdsChange = vi.fn();

    renderDataTable({
      enableRowSelection: true,
      onSelectedRowIdsChange,
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select all visible rows',
      }),
    );

    expect(onSelectedRowIdsChange).toHaveBeenCalledWith([
      'student-1',
      'student-2',
      'student-3',
    ]);
  });

  it('does not select rows disabled by the selection predicate', () => {
    const onSelectedRowIdsChange = vi.fn();

    renderDataTable({
      enableRowSelection: true,
      isRowSelectionDisabled: (student) => student.id === 'student-2',
      onSelectedRowIdsChange,
    });

    expect(
      screen.getByRole<HTMLInputElement>('checkbox', {
        name: 'Select row student-2',
      }).disabled,
    ).toBe(true);

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select all visible rows',
      }),
    );

    expect(onSelectedRowIdsChange).toHaveBeenCalledWith([
      'student-1',
      'student-3',
    ]);
  });

  it('supports controlled row selection', () => {
    const onSelectedRowIdsChange = vi.fn();

    renderDataTable({
      enableRowSelection: true,
      selectedRowIds: ['student-1'],
      onSelectedRowIdsChange,
    });

    const selectedCheckbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Select row student-1',
    });

    expect(selectedCheckbox.checked).toBe(true);

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select row student-2',
      }),
    );

    expect(onSelectedRowIdsChange).toHaveBeenCalledWith([
      'student-1',
      'student-2',
    ]);
  });

  it('shows the selected row count', () => {
    renderDataTable({
      enableRowSelection: true,
      defaultSelectedRowIds: ['student-1', 'student-3'],
    });

    expect(screen.getByRole('status').textContent).toBe('2 selected');
  });

  it('preserves selected IDs when selecting visible rows', () => {
    const onSelectedRowIdsChange = vi.fn();

    renderDataTable({
      enableRowSelection: true,
      defaultSelectedRowIds: ['student-99'],
      onSelectedRowIdsChange,
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select all visible rows',
      }),
    );

    expect(onSelectedRowIdsChange).toHaveBeenCalledWith([
      'student-99',
      'student-1',
      'student-2',
      'student-3',
    ]);
  });

  it('supports custom row IDs', () => {
    renderDataTable({
      enableRowSelection: true,
      getRowId: (student) => `record-${student.id}`,
    });

    expect(
      screen.getByRole('checkbox', {
        name: 'Select row record-student-1',
      }),
    ).toBeTruthy();
  });

  it('does not render selection controls by default', () => {
    renderDataTable();

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  /* ---------------------------------------------------
     CUSTOMIZATION
     --------------------------------------------------- */

  it('preserves custom container classes and data attributes', () => {
    renderDataTable({
      className: 'custom-data-table',
      'data-testid': 'data-table',
    });

    expect(screen.getByTestId('data-table').className).toContain(
      'custom-data-table',
    );
  });
});
