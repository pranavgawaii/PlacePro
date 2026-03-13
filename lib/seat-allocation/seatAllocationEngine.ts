import type { Lab, SeatSummaryItem } from "@/lib/seat-allocation/types";

interface SeatToken {
  prefix: string;
  number: number;
  raw: string;
}

export interface AllocatableStudent {
  student_id: string;
  prn: string;
  name: string;
}

const splitSeatToken = (value: string): SeatToken => {
  const token = String(value ?? "").trim();
  const match = token.match(/^([A-Za-z]+)?(\d+)$/);

  if (!match) {
    return { prefix: "", number: Number.NaN, raw: token };
  }

  return {
    prefix: (match[1] ?? "").toUpperCase(),
    number: Number(match[2]),
    raw: token
  };
};

export const compareSeatNumbers = (left: string, right: string): number => {
  const a = splitSeatToken(left);
  const b = splitSeatToken(right);

  const aIsNumeric = a.prefix === "" && Number.isFinite(a.number);
  const bIsNumeric = b.prefix === "" && Number.isFinite(b.number);

  if (aIsNumeric && bIsNumeric) {
    return a.number - b.number;
  }

  const aStructured = Number.isFinite(a.number);
  const bStructured = Number.isFinite(b.number);

  if (aStructured && bStructured) {
    const prefixCompare = a.prefix.localeCompare(b.prefix, undefined, { sensitivity: "base" });
    if (prefixCompare !== 0) {
      return prefixCompare;
    }
    return a.number - b.number;
  }

  return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: "base" });
};

const rowLabel = (index: number): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let remaining = index;
  let label = "";

  do {
    label = alphabet[remaining % 26] + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);

  return label;
};

export const buildSeatNumbersForLab = (lab: Pick<Lab, "total_seats" | "rows" | "columns">): string[] => {
  const total = Math.max(0, lab.total_seats || 0);
  if (total === 0) {
    return [];
  }

  const rowCount = lab.rows ?? 0;
  const colCount = lab.columns ?? 0;

  if (rowCount > 0 && colCount > 0) {
    const labels: string[] = [];
    let rowIndex = 0;

    while (labels.length < total) {
      for (let column = 1; column <= colCount && labels.length < total; column += 1) {
        labels.push(`${rowLabel(rowIndex)}${column}`);
      }

      rowIndex += 1;

      if (rowIndex >= rowCount && labels.length >= rowCount * colCount) {
        break;
      }
    }

    if (labels.length < total) {
      for (let index = labels.length + 1; index <= total; index += 1) {
        labels.push(String(index));
      }
    }

    return labels;
  }

  return Array.from({ length: total }, (_, index) => String(index + 1));
};

export const sortAllocatableStudents = <T extends AllocatableStudent>(students: T[]): T[] => {
  return [...students].sort((left, right) => {
    const prnCompare = (left.prn || "").localeCompare(right.prn || "", undefined, {
      numeric: true,
      sensitivity: "base"
    });

    if (prnCompare !== 0) {
      return prnCompare;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
};

export const autoAllocateSeats = <T extends AllocatableStudent>(params: {
  labs: Array<Pick<Lab, "id" | "lab_name" | "total_seats" | "rows" | "columns">>;
  students: T[];
}) => {
  const orderedStudents = sortAllocatableStudents(params.students);

  const assignments: Array<{
    student_id: string;
    lab_id: string;
    seat_number: string;
  }> = [];

  const seatSummary: SeatSummaryItem[] = params.labs.map((lab) => ({
    lab_id: lab.id,
    lab_name: lab.lab_name,
    allocated_count: 0,
    total_seats: lab.total_seats
  }));

  let studentIndex = 0;

  for (const lab of params.labs) {
    const seatNumbers = buildSeatNumbersForLab(lab).sort(compareSeatNumbers);

    for (const seatNumber of seatNumbers) {
      const student = orderedStudents[studentIndex];
      if (!student) {
        break;
      }

      assignments.push({
        student_id: student.student_id,
        lab_id: lab.id,
        seat_number: seatNumber
      });

      const summaryRow = seatSummary.find((row) => row.lab_id === lab.id);
      if (summaryRow) {
        summaryRow.allocated_count += 1;
      }

      studentIndex += 1;
    }

    if (studentIndex >= orderedStudents.length) {
      break;
    }
  }

  return {
    assignments,
    seat_summary: seatSummary,
    overflow_student_ids: orderedStudents.slice(studentIndex).map((student) => student.student_id)
  };
};
