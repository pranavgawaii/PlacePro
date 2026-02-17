const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SPECIAL = "!@#$%&*?";
const ALL_CHARS = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SPECIAL}`;

const BRANCH_PREFIX_MAP: Record<string, string> = {
  CSE: "Cse",
  ECE: "Ece",
  ENTC: "Entc",
  CIVIL: "Civil",
  MECH: "Mech",
  AERO: "Aero"
};

function secureRandomIndex(max: number) {
  if (max <= 0) {
    return 0;
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function shuffle(value: string) {
  const chars = value.split("");

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    const temp = chars[index];
    chars[index] = chars[swapIndex];
    chars[swapIndex] = temp;
  }

  return chars.join("");
}

export function generateRandomPassword(length: number = 8): string {
  const safeLength = Math.max(8, length);
  const required = [
    UPPERCASE[secureRandomIndex(UPPERCASE.length)],
    LOWERCASE[secureRandomIndex(LOWERCASE.length)],
    NUMBERS[secureRandomIndex(NUMBERS.length)],
    SPECIAL[secureRandomIndex(SPECIAL.length)]
  ];

  const extraLength = Math.max(0, safeLength - required.length);
  let extra = "";

  for (let index = 0; index < extraLength; index += 1) {
    extra += ALL_CHARS[secureRandomIndex(ALL_CHARS.length)];
  }

  return shuffle(`${required.join("")}${extra}`);
}

export function generatePatternPassword(branch: string, enrollmentNo: string, mobile: string): string {
  const normalizedBranch = branch.trim().toUpperCase();
  const enrollmentLast4 = enrollmentNo.trim().slice(-4);
  const mobileLast4 = mobile.trim().slice(-4);
  const branchPrefix = BRANCH_PREFIX_MAP[normalizedBranch] ?? `${normalizedBranch.charAt(0)}${normalizedBranch.slice(1).toLowerCase()}`;

  return `${branchPrefix}${enrollmentLast4}&${mobileLast4}`;
}
