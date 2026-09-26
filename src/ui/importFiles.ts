import type { ImportObservation } from "../shared/model";

export interface SelectedFile {
  file: File;
  relativePath: string;
}
interface Entry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file(
    success: (file: File) => void,
    failure: (error: DOMException) => void,
  ): void;
  createReader(): {
    readEntries(
      success: (entries: Entry[]) => void,
      failure: (error: DOMException) => void,
    ): void;
  };
}
export interface FileSelection {
  files: SelectedFile[];
  errors: string[];
}

export function fromInput(files: FileList | File[]): FileSelection {
  return {
    files: Array.from(files).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    })),
    errors: [],
  };
}

export async function fromDrop(
  transfer: DataTransfer,
  signal?: AbortSignal,
): Promise<FileSelection> {
  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .map((item) =>
      (
        item as unknown as { webkitGetAsEntry?: () => Entry | null }
      ).webkitGetAsEntry?.(),
    );
  const fallback = fromInput(transfer.files);
  if (!entries.some(Boolean)) return fallback;
  const result: FileSelection = { files: [], errors: [] };
  const visit = async (entry: Entry, prefix: string): Promise<void> => {
    if (signal?.aborted) throw new DOMException("已取消目录扫描", "AbortError");
    const relativePath = `${prefix}${entry.name}`;
    try {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          entry.file(resolve, reject),
        );
        result.files.push({ file, relativePath });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        while (true) {
          if (signal?.aborted)
            throw new DOMException("已取消目录扫描", "AbortError");
          const batch = await new Promise<Entry[]>((resolve, reject) =>
            reader.readEntries(resolve, reject),
          );
          if (!batch.length) break;
          for (const child of batch) await visit(child, `${relativePath}/`);
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      result.errors.push(
        `${relativePath}：${error instanceof Error ? error.message : "无法读取"}`,
      );
    }
  };
  for (const entry of entries) if (entry) await visit(entry, "");
  return result;
}

export const observations = (files: SelectedFile[]): ImportObservation[] =>
  files.map(({ file, relativePath }) => ({
    relativePath,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  }));
export const isDocumentImage = ({ file, relativePath }: SelectedFile) =>
  /\.(jpe?g|png)$/i.test(relativePath) ||
  ["image/jpeg", "image/png"].includes(file.type);
export const bytes = (count: number) =>
  count < 1024
    ? `${count} B`
    : count < 1024 ** 2
      ? `${(count / 1024).toFixed(1)} KB`
      : `${(count / 1024 ** 2).toFixed(1)} MB`;
