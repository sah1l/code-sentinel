import { describe, it, expect } from 'vitest';
import { parsePatch, isValidCommentLine, findNearestValidLine } from './diff-parser';

describe('parsePatch', () => {
    it('should parse a simple patch with additions', () => {
        const patch = `@@ -1,3 +1,5 @@
 line1
+added1
+added2
 line2
 line3`;

        const result = parsePatch(patch);

        // Added lines at 2 and 3, context lines at 1, 4, 5
        expect(result.validNewLines).toContain(1);
        expect(result.validNewLines).toContain(2);
        expect(result.validNewLines).toContain(3);
        expect(result.validNewLines).toContain(4);
        expect(result.validNewLines).toContain(5);
    });

    it('should parse a patch with deletions', () => {
        const patch = `@@ -1,5 +1,3 @@
 line1
-deleted1
-deleted2
 line2
 line3`;

        const result = parsePatch(patch);

        // Context lines 1, 2, 3 are valid for new file
        expect(result.validNewLines).toContain(1);
        expect(result.validNewLines).toContain(2);
        expect(result.validNewLines).toContain(3);
        // Old lines should include deleted lines
        expect(result.validOldLines).toContain(2);
        expect(result.validOldLines).toContain(3);
    });

    it('should return empty sets for undefined patch', () => {
        const result = parsePatch(undefined);
        expect(result.validNewLines.size).toBe(0);
        expect(result.validOldLines.size).toBe(0);
        expect(result.hunks.length).toBe(0);
    });

    it('should handle multiple hunks', () => {
        const patch = `@@ -1,2 +1,2 @@
 line1
+added1
@@ -10,2 +10,3 @@
 line10
+added10
 line11`;

        const result = parsePatch(patch);

        expect(result.validNewLines).toContain(1);
        expect(result.validNewLines).toContain(2);
        expect(result.validNewLines).toContain(10);
        expect(result.validNewLines).toContain(11);
        expect(result.validNewLines).toContain(12);
    });
});

describe('isValidCommentLine', () => {
    it('should return true for valid lines', () => {
        const patch = `@@ -1,2 +1,3 @@
 line1
+added
 line2`;
        const parsed = parsePatch(patch);

        expect(isValidCommentLine(1, parsed)).toBe(true);
        expect(isValidCommentLine(2, parsed)).toBe(true);
        expect(isValidCommentLine(3, parsed)).toBe(true);
    });

    it('should return false for lines outside diff', () => {
        const patch = `@@ -10,2 +10,2 @@
 line10
 line11`;
        const parsed = parsePatch(patch);

        expect(isValidCommentLine(1, parsed)).toBe(false);
        expect(isValidCommentLine(5, parsed)).toBe(false);
        expect(isValidCommentLine(20, parsed)).toBe(false);
    });
});

describe('findNearestValidLine', () => {
    it('should return exact line if valid', () => {
        const patch = `@@ -1,3 +1,3 @@
 line1
 line2
 line3`;
        const parsed = parsePatch(patch);

        expect(findNearestValidLine(2, parsed)).toBe(2);
    });

    it('should find nearest line within max distance', () => {
        const patch = `@@ -5,2 +5,2 @@
 line5
 line6`;
        const parsed = parsePatch(patch);

        // Line 4 is not in diff, but line 5 is within distance 1
        expect(findNearestValidLine(4, parsed, 3)).toBe(5);
        // Line 8 is too far from 5-6
        expect(findNearestValidLine(8, parsed, 1)).toBeUndefined();
    });

    it('should return undefined if no valid line nearby', () => {
        const patch = `@@ -50,2 +50,2 @@
 line50
 line51`;
        const parsed = parsePatch(patch);

        expect(findNearestValidLine(10, parsed, 3)).toBeUndefined();
    });
});
