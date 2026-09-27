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

function readEntry<T>(
  start: (success: (value: T) => void, failure: (error: DOMException) => void) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => finish(() => reject(new DOMException("已取消目录扫描", "AbortError")));
    const finish = (settle: () => void) => {
      signal?.removeEventListener("abort", aborted);
      settle();
    };
    if (signal?.aborted) { aborted(); return; }
    signal?.addEventListener("abort", aborted, { once: true });
    try {
      start(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    } catch (error) {
      finish(() => reject(error));
    }
  });
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
  if (signal?.aborted) throw new DOMException("已取消目录扫描", "AbortError");
  // Capture File objects synchronously: the browser clears DataTransfer after drop.
  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => {
      try {
        return {
          entry: (item as unknown as { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.(),
          file: item.getAsFile(),
        };
      } catch {
        return { entry: null, file: item.getAsFile() };
      }
    });
  const fallback = fromInput(transfer.files);
  if (!entries.length) return fallback;
  const result: FileSelection = { files: [], errors: [] };
  const visit = async (entry: Entry, prefix: string): Promise<void> => {
    if (signal?.aborted) throw new DOMException("已取消目录扫描", "AbortError");
    const relativePath = `${prefix}${entry.name}`;
    try {
      if (entry.isFile) {
        const file = await readEntry<File>((resolve, reject) => entry.file(resolve, reject), signal);
        if (signal?.aborted) throw new DOMException("已取消目录扫描", "AbortError");
        result.files.push({ file, relativePath });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        while (true) {
          if (signal?.aborted)
            throw new DOMException("已取消目录扫描", "AbortError");
          const batch = await readEntry<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject), signal);
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
  for (const { entry, file } of entries) {
    if (signal?.aborted) throw new DOMException("已取消目录扫描", "AbortError");
    if (entry) await visit(entry, "");
    else if (file) result.files.push({ file, relativePath: file.webkitRelativePath || file.name });
    else result.errors.push("有一项拖入内容无法读取，请使用“选择项目文件夹”重试。");
  }
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
