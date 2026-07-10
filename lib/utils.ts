import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// * Helper function that extracts any inputs (interpolation variables) from a list of strings
// https://docs.crewai.com/quickstart#build-your-first-crewai-agent
export function extractInterpolationVariables(texts: string[]): string[] {
  const matches = texts.map(
    (text) => text.match(/\{([^}]+)\}/g)?.map((match) => match.slice(1, -1)) || []
  );

  // Use Set to remove duplicates and convert back to array
  return [...new Set(matches.flat())];
}

export function toBoolean(str: string): boolean {
  /**
   * Converts a string to a boolean.
   * @param str - The string to convert.
   * @returns {boolean} - The converted boolean value.
   */
  const trueValues = ['true', '1', 'yes', 'y', 'on'];
  const falseValues = ['false', '0', 'no', 'n', 'off'];

  if (trueValues.includes(str.toLowerCase())) {
    return true;
  } else if (falseValues.includes(str.toLowerCase())) {
    return false;
  } else {
    throw new Error(`Cannot convert string to boolean: invalid value '${str}'`);
  }
}
