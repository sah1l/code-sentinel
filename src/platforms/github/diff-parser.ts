/**
 * Utility to parse GitHub diff patches and extract valid line ranges
 * that can be used for inline comments.
 */

export interface DiffLine {
    /** Line number in the new file (right side) */
    newLine: number;
    /** Line number in the old file (left side), null for added lines */
    oldLine: number | null;
    /** Whether this line was added, removed, or unchanged */
    type: 'add' | 'remove' | 'context';
}

export interface DiffHunk {
    /** Lines in this hunk that are valid for commenting */
    lines: DiffLine[];
    /** Starting line in new file */
    newStart: number;
    /** Number of lines in new file */
    newCount: number;
}

export interface ParsedDiff {
    /** All valid line numbers in the new file (RIGHT side) */
    validNewLines: Set<number>;
    /** All valid line numbers in the old file (LEFT side) */
    validOldLines: Set<number>;
    /** Hunks from the diff */
    hunks: DiffHunk[];
}

/**
 * Parse a GitHub patch string to extract valid line numbers for comments.
 * 
 * GitHub's PR review API only accepts line numbers that are part of the diff.
 * This function parses the unified diff format to extract those lines.
 * 
 * @param patch - The patch string from GitHub's API (file.patch)
 * @returns ParsedDiff object with valid line numbers
 */
export function parsePatch(patch: string | undefined): ParsedDiff {
    const result: ParsedDiff = {
        validNewLines: new Set(),
        validOldLines: new Set(),
        hunks: [],
    };

    if (!patch) {
        return result;
    }

    const lines = patch.split('\n');
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);

        if (hunkMatch) {
            // Save previous hunk
            if (currentHunk) {
                result.hunks.push(currentHunk);
            }

            oldLineNum = Number.parseInt(hunkMatch[1], 10);
            newLineNum = Number.parseInt(hunkMatch[3], 10);
            const newCount = hunkMatch[4] ? Number.parseInt(hunkMatch[4], 10) : 1;

            currentHunk = {
                lines: [],
                newStart: newLineNum,
                newCount,
            };
            continue;
        }

        if (!currentHunk) {
            continue;
        }

        // Parse diff lines
        if (line.startsWith('+') && !line.startsWith('+++')) {
            // Added line - only in new file
            result.validNewLines.add(newLineNum);
            currentHunk.lines.push({
                newLine: newLineNum,
                oldLine: null,
                type: 'add',
            });
            newLineNum++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            // Removed line - only in old file
            result.validOldLines.add(oldLineNum);
            currentHunk.lines.push({
                newLine: newLineNum, // Context uses current new line
                oldLine: oldLineNum,
                type: 'remove',
            });
            oldLineNum++;
        } else if (line.startsWith(' ') || line === '') {
            // Context line - in both files
            result.validNewLines.add(newLineNum);
            result.validOldLines.add(oldLineNum);
            currentHunk.lines.push({
                newLine: newLineNum,
                oldLine: oldLineNum,
                type: 'context',
            });
            oldLineNum++;
            newLineNum++;
        }
    }

    // Save last hunk
    if (currentHunk) {
        result.hunks.push(currentHunk);
    }

    return result;
}

/**
 * Check if a line number is valid for posting a comment on the RIGHT (new) side.
 */
export function isValidCommentLine(
    line: number,
    parsedDiff: ParsedDiff
): boolean {
    return parsedDiff.validNewLines.has(line);
}

/**
 * Find the nearest valid line number in the diff for commenting.
 * Returns undefined if no valid line is close enough.
 * 
 * @param targetLine - The line number we want to comment on
 * @param parsedDiff - Parsed diff information
 * @param maxDistance - Maximum distance to search (default 3 lines)
 */
export function findNearestValidLine(
    targetLine: number,
    parsedDiff: ParsedDiff,
    maxDistance = 3
): number | undefined {
    // First check if exact line is valid
    if (parsedDiff.validNewLines.has(targetLine)) {
        return targetLine;
    }

    // Search nearby lines
    for (let offset = 1; offset <= maxDistance; offset++) {
        // Check line above
        if (parsedDiff.validNewLines.has(targetLine - offset)) {
            return targetLine - offset;
        }
        // Check line below
        if (parsedDiff.validNewLines.has(targetLine + offset)) {
            return targetLine + offset;
        }
    }

    return undefined;
}
