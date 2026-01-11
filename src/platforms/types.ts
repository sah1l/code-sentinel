

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'changed';

export interface ChangedFile {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
  previousFilename?: string;
}

export interface PullRequest {
  id: number;
  title: string;
  body: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  baseRef: string;
  headRef: string;
  files: ChangedFile[];
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  side: 'LEFT' | 'RIGHT';
}

export interface FileContent {
  path: string;
  content: string;
}

export interface PlatformAdapter {
  readonly name: string;

  getPullRequest(): Promise<PullRequest>;

  getFileContent(path: string, ref?: string): Promise<string | null>;

  getFilesInDirectory(directory: string, extension?: string): Promise<string[]>;

  postReviewSummary(summary: string): Promise<void>;

  postInlineComments(comments: ReviewComment[]): Promise<void>;

  addLabels?(labels: string[]): Promise<void>;
}
