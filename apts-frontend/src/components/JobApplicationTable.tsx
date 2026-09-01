// src/components/JobApplicationTable.tsx
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  flexRender,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react"; // ⬅️ for the Copy icon

export interface JobApplication {
  id: string;
  title: string;
  company_name: string;
  job_description: string;
  job_description_url: string;
  resume_url: string;
  status: string;
  created_at: string;
  bidder_name?: string;
  submitted_by?: string; // bidder_id - used for deduplication
  metadata?: {
    note?: string;
    salary_range?: {
      min?: number;
      max?: number;
    };
  };
  qualification?: string;
}

interface Props {
  refresh?: boolean;
  endpoint?: string; // Optional custom endpoint (e.g., "/developer/other-developers-jobs")
}

export default function JobApplicationTable({ refresh, endpoint }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    bidder_id: user?.role !== "bidder",
    developer_id: user?.role !== "bidder",
    metadata_salary_range: false,
    metadata_note: false,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] =
    useState<JobApplication | null>(null);

  // ⬇️ added getValues so we can read the textarea value for copying
  const { register, handleSubmit, reset, setValue, watch, getValues } =
    useForm<JobApplication>();

  const [bidders, setBidders] = useState<{ id: string; username: string }[]>(
    []
  );

  const [pageSize, setPageSize] = useState(20);

  const debouncedFilters = useDebounce(columnFilters, 400);

  const selectedStatus = watch("status");
  const selectedQualification = watch("qualification");

  // ⬇️ state + handler for clipboard copy
  const [copied, setCopied] = useState(false);
  const handleCopyJobDescription = async () => {
    try {
      const text = getValues("job_description") || "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // optional: add toast or fallback
      console.error("Copy failed", e);
    }
  };

  const handleEdit = (application: JobApplication) => {
    setEditingApplication(application);
    reset(application); // Populate the form with the current application data
    setEditModalOpen(true);
  };

  const handleSaveChanges = async (data: JobApplication) => {
    console.log(data);
    try {
      await api.put(`/applications/${data.id}`, data);
      setEditModalOpen(false);
      await fetchData(); // Refresh the table data
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const handleBulkQualificationUpdate = async (newQualification: string) => {
    const selectedRows = table.getSelectedRowModel().rows;
    const updates = selectedRows.map((row) => ({
      id: row.original.id,
      qualification: newQualification,
    }));

    try {
      await api.put("/applications/bulk", { updates });
      table.resetRowSelection();
      await fetchData();
    } catch (err) {
      console.error("Bulk qualification update failed", err);
    }
  };

  // Deduplication helper: Remove duplicates based on (title, company, submitted_by)
  // Duplicates are only considered when title, company, AND bidder (submitted_by) match
  // Keeps only the earliest created record for each (title + company + submitted_by) combination
  // Note: Backend already handles filtering and deduplication, this is a safety measure
  const deduplicateApplications = (applications: JobApplication[]): JobApplication[] => {
    const seen = new Map<string, JobApplication>();
    
    for (const app of applications) {
      // Include submitted_by (bidder_id) in the deduplication key
      // If submitted_by is not available, fall back to bidder_name or empty string
      const bidderId = app.submitted_by || app.bidder_name || '';
      const key = `${app.title.toLowerCase()}|${app.company_name.toLowerCase()}|${bidderId}`;
      const existing = seen.get(key);
      
      if (!existing || new Date(app.created_at) < new Date(existing.created_at)) {
        seen.set(key, app);
      }
    }
    
    return Array.from(seen.values());
  };

  
  // Backend-driven fetch
  const fetchData = async () => {
    setLoading(true);
    const params: Record<string, any> = {
      page,
      limit: pageSize,
    };
    columnFilters.forEach((filter) => {
      if (filter.value) {
        params[filter.id] = filter.value;
      }
    });

    // If custom endpoint is provided, use it (for other developers' jobs)
    if (endpoint) {
      const res = await api.get(endpoint, { params });
      // Apply frontend deduplication (by title+company+submitted_by)
      const deduplicated = deduplicateApplications(res.data.data);
      setData(deduplicated);
      setTotalRows(res.data.total);
      setLoading(false);
      return;
    }

    if (user?.role === "manager") {
      const res = await api.get("/manager/applications", { params });
      const deduplicated = deduplicateApplications(res.data.data);
      setData(deduplicated);
      setTotalRows(res.data.total);
      setLoading(false);
      return;
    }

    if (user?.role === "bidder") {
      const res = await api.get("/applications", { params });
      // Apply frontend deduplication as a safety measure
      const deduplicated = deduplicateApplications(res.data.data);
      setData(deduplicated);
      setTotalRows(res.data.total);
      setLoading(false);
    }

    if (user?.role === "developer") {
      const res = await api.get("/developer/applications", { params });
      // Apply frontend deduplication as a safety measure
      const deduplicated = deduplicateApplications(res.data.data);
      setData(deduplicated);
      setTotalRows(res.data.total);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedFilters, refresh]);

  useEffect(() => {
    if (user?.role === "developer") {
      if (endpoint === "/developer/other-developers-jobs") {
        api.get("/developer/other-developers").then((res) => {
          setBidders(res.data);
        });
      } else {
        api.get("/developer/bidders").then((res) => {
          setBidders(res.data);
        });
      }
    }
    if (user?.role === "manager") {
      api.get("/manager/bidders").then((res) => {
        setBidders(res.data);
      });
    }
  }, [user, endpoint]);

  const columns = useMemo<ColumnDef<JobApplication>[]>(
    () => {
      const baseColumns: ColumnDef<JobApplication>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "title",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</span>
        ),
        cell: ({ row }) => (
          <div className="font-semibold text-foreground">{row.original.title}</div>
        ),
      },
      {
        accessorKey: "company_name",
        header: ({ column }) => {
          const rawValue = column.getFilterValue();
          const [inputValue, setInputValue] = useState<string>(rawValue ? String(rawValue) : "");

          const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              column.setFilterValue(inputValue.trim() || undefined);
            }
          };

          return (
            <div className="flex flex-col gap-2.5 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Company</span>
              <Input
                className="h-9 text-sm w-full"
                placeholder="Filter company..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <div className="flex flex-col gap-2.5 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Status</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-sm font-medium w-full justify-start">
                  {(column.getFilterValue() as string) || "All"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[140px]">
                {["submitted", "interviewing", "offer", "rejected"].map(
                  (status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={column.getFilterValue() === status}
                      onCheckedChange={() =>
                        column.setFilterValue(
                          column.getFilterValue() === status
                            ? undefined
                            : status
                        )
                      }
                      className="text-sm"
                    >
                      {status}
                    </DropdownMenuCheckboxItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-medium text-xs px-2 py-0.5">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "metadata.salary_range",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary</span>
        ),
        cell: ({ row }) => {
          const salary = row.original.metadata?.salary_range;
          return salary ? `$${salary.min}–${salary.max}` : "—";
        },
      },
      {
        accessorKey: "metadata.note",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</span>
        ),
        cell: ({ row }) => (
          <span className="text-xs italic text-muted-foreground max-w-[200px] truncate block">
            {row.original.metadata?.note || "—"}
          </span>
        ),
      },
      {
        id: "links",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</span>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col sm:flex-row gap-2 text-sm">
            <a
              href={row.original.job_description_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline underline-offset-2 transition-colors"
            >
              Job
            </a>
            <a
              href={row.original.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium underline underline-offset-2 transition-colors"
            >
              Resume
            </a>
          </div>
        ),
      },
      {
        accessorKey: endpoint === "/developer/other-developers-jobs" ? "developer_id" : "bidder_id",
        id: endpoint === "/developer/other-developers-jobs" ? "developer_id" : "bidder_id",
        header: ({ column }) => {
          const isOtherDevelopersJobs = endpoint === "/developer/other-developers-jobs";
          return (
            <div className="flex flex-col gap-2.5 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                {isOtherDevelopersJobs ? "Developer" : "Bidder"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-sm font-medium w-full justify-start">
                    {bidders.find((b) => b.id === column.getFilterValue())
                      ?.username || "All"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[140px]">
                  <DropdownMenuCheckboxItem
                    checked={!column.getFilterValue()}
                    onCheckedChange={() => column.setFilterValue(undefined)}
                    className="text-sm"
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  {bidders.map((b) => (
                    <DropdownMenuCheckboxItem
                      key={b.id}
                      checked={column.getFilterValue() === b.id}
                      onCheckedChange={() =>
                        column.setFilterValue(
                          column.getFilterValue() === b.id ? undefined : b.id
                        )
                      }
                      className="text-sm"
                    >
                      {b.username}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        cell: ({ row }) => <div className="font-medium">{row.original.bidder_name || "—"}</div>,
      },
      {
        accessorKey: "created_at",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</span>
        ),
        cell: ({ row }) =>
          new Date(row.original.created_at).toLocaleDateString(),
      },
    ];

      // Only add actions column if not viewing other developers' jobs
      if (endpoint !== "/developer/other-developers-jobs") {
        baseColumns.push({
          id: "actions",
          header: () => (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</span>
          ),
          cell: ({ row }) => {
            const application = row.original;

            return (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(application)}
                  // disabled={user?.role === 'bidder'}
                  className="h-8 px-3 text-xs font-medium"
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(application.id)}
                  className="h-8 px-3 text-xs font-medium"
                >
                  Delete
                </Button>
              </div>
            );
          },
          enableSorting: false,
        });
      }

      return baseColumns;
    },
    [bidders, endpoint, user?.role]
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / pageSize),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
  });

  const exportToExcel = () => {
    const exportData = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
    XLSX.writeFile(workbook, "job_applications.xlsx");
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this application?"
    );
    if (!confirmed) return;

    try {
      await api.delete(`/applications/${id}`);
      await fetchData(); // refresh table
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = window.confirm("Delete selected applications?");
    if (!confirmed) return;

    const ids = table.getSelectedRowModel().rows.map((row) => row.original.id);

    await Promise.all(ids.map((id) => api.delete(`/applications/${id}`)));
    table.resetRowSelection();
    await fetchData();
  };

  return (
    <div className="space-y-6 mt-6 w-full">
      {/* Toolbar Section */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-medium">
                Toggle Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={() => col.toggleVisibility()}
                    className="text-sm"
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Rows:
            </label>
            <select
              id="pageSize"
              className="h-9 border rounded-md px-3 text-sm font-medium bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full sm:w-auto">
          {Object.keys(rowSelection).length > 0 && (
            <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9 px-4 text-sm font-medium">
              Export Selected
            </Button>
          )}

          {table.getSelectedRowModel().rows.length > 0 && endpoint !== "/developer/other-developers-jobs" && (
            <>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-9 px-4 text-sm font-medium">
                Delete Selected
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-medium">
                    Bulk Edit
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  <DropdownMenuCheckboxItem
                    onCheckedChange={() => handleBulkQualificationUpdate("")}
                    className="text-sm"
                  >
                    — None —
                  </DropdownMenuCheckboxItem>
                  {[
                    "good",
                    "not remote",
                    "no confirmation email",
                    "no recent job",
                    "no software job",
                  ].map((qual) => (
                    <DropdownMenuCheckboxItem
                      key={qual}
                      onCheckedChange={() => handleBulkQualificationUpdate(qual)}
                      className="text-sm"
                    >
                      {qual}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>


      {/* Filter badges */}
      {table.getState().columnFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 sm:px-6 lg:px-8">
          {table.getState().columnFilters.map((filter) => {
            const label = filter.id === "developer_id" ? "Developer" : filter.id === "bidder_id" ? "Bidder" : filter.id;
            const displayValue = (filter.id === "developer_id" || filter.id === "bidder_id")
              ? (bidders.find((b) => b.id === filter.value)?.username ?? String(filter.value))
              : String(filter.value);
            return (
            <div
              key={filter.id}
              className="flex items-center gap-2 text-sm border rounded-full px-3 py-1.5 bg-muted/50 text-foreground shadow-sm"
            >
              <span className="font-medium text-xs uppercase tracking-wide">{label}:</span>
              <span className="font-medium">{displayValue}</span>
              <button
                onClick={() =>
                  table.getColumn(filter.id)?.setFilterValue(undefined)
                }
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors text-base leading-none"
                aria-label="Remove filter"
              >
                ×
              </button>
            </div>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 mt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden shadow-sm bg-card w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id} className="bg-muted/30 hover:bg-muted/30 border-b">
                      {group.headers.map((header) => (
                        <TableHead key={header.id} className="h-auto min-h-[4rem] px-4 py-3 align-top">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-sm font-medium">No applications found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => {
                      const qual = row.original.qualification;
                      const status = row.original.status;

                      // Background color based on qualification OR status
                      let highlight = "";

                      // Qualification-based highlight
                      if (qual === "good") highlight = "bg-green-50 dark:bg-green-950/20";
                      else if (qual === "no confirmation email") highlight = "bg-yellow-50 dark:bg-yellow-950/20";
                      else if (qual === "not remote") highlight = "bg-red-50 dark:bg-red-950/20";
                      else if (qual === "no recent job") highlight = "bg-orange-50 dark:bg-orange-950/20";
                      else if (qual === "no software job")
                        highlight = "bg-violet-50 dark:bg-violet-950/20";

                      // Status-based override
                      if (status === "interviewing") highlight = "bg-blue-50 dark:bg-blue-950/20";
                      else if (status === "offer") highlight = "bg-green-100 dark:bg-green-950/30";
                      else if (status === "rejected") highlight = "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";

                      return (
                        <TableRow 
                          key={row.id} 
                          className={`${highlight} transition-colors hover:bg-muted/50 border-b`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="px-4 py-3 text-sm">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 pb-2 px-4 sm:px-6 lg:px-8">
            <div className="text-sm font-medium text-muted-foreground">
              <span className="text-foreground">Page {page}</span> of {Math.ceil(totalRows / pageSize)}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-9 px-4 text-sm font-medium"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(totalRows / pageSize)}
                className="h-9 px-4 text-sm font-medium"
              >
                Next
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground pb-4 px-4 sm:px-6 lg:px-8">
            Showing <span className="font-medium text-foreground">{data.length}</span> of <span className="font-medium text-foreground">{totalRows}</span> results
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingApplication && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="p-0 w-[95vw] sm:max-w-[800px] lg:max-w-[900px]">
            <div className="max-h-[90vh] flex flex-col bg-background rounded-lg">

              {/* Sticky header */}
              <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b sticky top-0 bg-background z-10 shadow-sm">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Edit Application</DialogTitle>
                </DialogHeader>
              </div>

              {/* Scrollable form body */}
              <form
                onSubmit={handleSubmit(handleSaveChanges)}
                className="flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8 py-6"
              >
                <div className="space-y-5 sm:space-y-6">
                  {/* Job fields */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold">Job Title</Label>
                    <Input
                      id="title"
                      {...register("title")}
                      defaultValue={editingApplication.title}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_name" className="text-sm font-semibold">Company Name</Label>
                    <Input
                      id="company_name"
                      {...register("company_name")}
                      defaultValue={editingApplication.company_name}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_description_url" className="text-sm font-semibold">Job Description URL</Label>
                    <Input
                      id="job_description_url"
                      {...register("job_description_url")}
                      defaultValue={editingApplication.job_description_url}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resume_url" className="text-sm font-semibold">Resume URL</Label>
                    <Input
                      id="resume_url"
                      {...register("resume_url")}
                      defaultValue={editingApplication.resume_url}
                      className="h-10 text-sm"
                    />
                  </div>

                  {/* Job Description with Copy button */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="job_description" className="text-sm font-semibold">Job Description</Label>
                      <div className="flex items-center gap-2">
                        {copied && (
                          <span
                            className="text-xs text-muted-foreground font-medium"
                            aria-live="polite"
                          >
                            Copied!
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer"
                          aria-label="Copy job description"
                          onClick={handleCopyJobDescription}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id="job_description"
                      {...register("job_description")}
                      defaultValue={editingApplication.job_description}
                      className="min-h-32 max-h-[40vh] resize-y text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note" className="text-sm font-semibold">Note</Label>
                    <Textarea
                      id="note"
                      {...register("metadata.note")}
                      defaultValue={editingApplication.metadata?.note || ""}
                      className="min-h-24 max-h-[30vh] resize-y text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Salary Range</Label>
                    <div className="flex gap-3">
                      <Input
                        type="number"
                        placeholder="Min"
                        {...register("metadata.salary_range.min")}
                        defaultValue={editingApplication.metadata?.salary_range?.min}
                        className="h-10 text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        {...register("metadata.salary_range.max")}
                        defaultValue={editingApplication.metadata?.salary_range?.max}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Full-width Status dropdown */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Status</Label>
                    <div className="w-full">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between h-10 text-sm font-medium"
                          >
                            {selectedStatus || "Select Status"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-full"
                        >
                          {["submitted", "interviewing", "offer", "rejected"].map(
                            (status) => (
                              <DropdownMenuCheckboxItem
                                key={status}
                                checked={selectedStatus === status}
                                onCheckedChange={() => setValue("status", status)}
                                className="text-sm"
                              >
                                {status}
                              </DropdownMenuCheckboxItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Full-width Qualification dropdown */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Qualification</Label>
                    <div className="w-full">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between h-10 text-sm font-medium"
                          >
                            {selectedQualification || "Select Qualification"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-full"
                        >
                          {[
                            "good",
                            "not remote",
                            "no confirmation email",
                            "no recent job",
                            "no software job",
                          ].map((qual) => (
                            <DropdownMenuCheckboxItem
                              key={qual}
                              checked={selectedQualification === qual}
                              onCheckedChange={() =>
                                setValue(
                                  "qualification",
                                  selectedQualification === qual ? "" : qual
                                )
                              }
                              className="text-sm"
                            >
                              {qual}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="mt-6 sticky bottom-0 bg-background pt-4 pb-4 -mx-6 sm:-mx-8 px-6 sm:px-8 border-t z-10 shadow-sm">
                  <DialogFooter className="gap-3">
                    <Button 
                      type="submit" 
                      className="h-10 px-6 text-sm font-semibold"
                    >
                      Save Changes
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setEditModalOpen(false)}
                      className="h-10 px-6 text-sm font-medium"
                    >
                      Cancel
                    </Button>
                  </DialogFooter>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>


      )}
    </div>
  );
}
