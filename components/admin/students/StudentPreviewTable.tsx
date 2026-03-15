"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type StudentPreviewRow = {
  rowNumber: number;
  name: string;
  email: string;
  enrollment_no: string;
  mobile: string;
  branch: string;
  batch_year: string;
  valid: boolean;
  errors: string[];
};

type StudentPreviewTableProps = {
  rows: StudentPreviewRow[];
};

export function StudentPreviewTable({ rows }: StudentPreviewTableProps) {
  return (
    <div className="max-h-80 overflow-auto rounded-md border border-neutral-200">
      <Table>
        <TableHeader className="sticky top-0 bg-white">
          <TableRow>
            <TableHead className="w-[80px]">Row</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Enrollment</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-sm text-neutral-500">
                Upload a CSV file to preview rows.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={`${row.rowNumber}-${row.email}-${row.enrollment_no}`} className={row.valid ? "" : "bg-red-50/60"}>
                <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                <TableCell className="text-sm">{row.name}</TableCell>
                <TableCell className="text-sm">{row.email}</TableCell>
                <TableCell className="font-mono text-sm">{row.enrollment_no}</TableCell>
                <TableCell className="font-mono text-sm">{row.mobile}</TableCell>
                <TableCell className="text-sm">{row.branch}</TableCell>
                <TableCell className="text-sm">{row.batch_year}</TableCell>
                <TableCell>
                  {row.valid ? (
                    <Badge variant="success" className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Valid
                    </Badge>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="destructive" className="inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Error
                      </Badge>
                      <div className="text-xs text-red-700">{row.errors.join(" | ")}</div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
