import type { FileParseResult } from "../types";

/**
 * 文件读取进度元信息。
 */
export interface FileChunkMeta {
  /** 当前已处理的字节数 */
  processedBytes: number;
  /** 文件总字节数 */
  totalBytes: number;
  /** 完成进度 0~1 */
  progress: number;
}

/**
 * 通用文件读取选项。
 */
export interface FileReadOptions {
  /** 分块尺寸，默认 256KB */
  chunkSize?: number;
  /** 文本编码，默认 utf-8 */
  encoding?: string;
  /** 每次分块解析后的回调 */
  onChunk?: (lines: string[], meta: FileChunkMeta) => void;
}

/**
 * 读取文本文件并按行输出，支持大文件分块处理。
 * @param file 浏览器 File 对象
 * @param options 读取配置
 */
export async function readFileAsLines(file: File, options: FileReadOptions = {}): Promise<FileParseResult> {
  const { chunkSize = 256 * 1024, encoding = "utf-8", onChunk } = options;

  if (file.size === 0) {
    return {
      entries: [],
      totalLines: 0,
      fileSize: 0
    } satisfies FileParseResult;
  }

  return await new Promise<FileParseResult>((resolve, reject) => {
    const reader = new FileReader();
    let offset = 0;
    let remainder = "";
    const entries: string[] = [];

    reader.onerror = () => {
      reject(reader.error ?? new Error("file-read-error"));
    };

    reader.onload = () => {
      const textChunk = typeof reader.result === "string" ? reader.result : String(reader.result ?? "");
      const combined = remainder + textChunk;
      const lines = combined.split(/\r?\n/g);
      remainder = lines.pop() ?? "";

      if (lines.length > 0) {
        entries.push(...lines);
        onChunk?.(lines, buildMeta(offset, file.size));
      }

      if (offset >= file.size) {
        if (remainder.length > 0) {
          entries.push(remainder);
          onChunk?.([remainder], buildMeta(file.size, file.size));
        }

        resolve({
          entries,
          totalLines: entries.length,
          fileSize: file.size
        });
        return;
      }

      readNext();
    };

    const readNext = () => {
      const end = Math.min(offset + chunkSize, file.size);
      const slice = file.slice(offset, end);
      offset = end;
      reader.readAsText(slice, encoding);
    };

    readNext();
  });
}

/**
 * CSV 读取选项，继承通用文件选项并增加分隔符配置。
 */
export interface CsvReadOptions extends FileReadOptions {
  /** 使用的列分隔符，auto 时自动推断 */
  delimiter?: "," | ";" | "\t" | "auto";
  /** 解析批大小，控制让出主线程的频率 */
  batchSize?: number;
}

/**
 * 读取 CSV 文件并输出结构化数据。
 * @param file 浏览器 File 对象
 * @param options 读取配置
 */
export async function readCsvFile(file: File, options: CsvReadOptions = {}): Promise<FileParseResult> {
  const { delimiter: delimiterOption = "auto", batchSize = 2000, ...readOptions } = options;
  const base = await readFileAsLines(file, readOptions);

  const sampleLine = base.entries.find((line) => line.trim().length > 0) ?? "";
  const resolvedDelimiter =
    delimiterOption === "auto" ? detectCsvDelimiter(sampleLine) : (delimiterOption ?? ",");

  const rows: string[][] = [];
  for (let index = 0; index < base.entries.length; index += 1) {
    const parsedRow = parseCsvLine(base.entries[index], resolvedDelimiter);
    rows.push(parsedRow);

    // 大文件时定期让出事件循环，避免阻塞 UI
    if (batchSize > 0 && index > 0 && index % batchSize === 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  const headers = rows.length > 0 ? buildHeaders(rows[0]) : [];

  return {
    ...base,
    rows,
    headers,
    delimiter: resolvedDelimiter
  } satisfies FileParseResult;
}

/**
 * 自动推断 CSV 分隔符。
 */
export function detectCsvDelimiter(sample: string): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;
  let bestDelimiter: "," | ";" | "\t" = ",";
  let bestScore = -1;

  for (const delimiter of candidates) {
    const score = sample.split(delimiter).length;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * 解析单行 CSV 文本，支持引号转义。
 */
export function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

/**
 * 触发浏览器下载 JSON 文件。
 * @param filename 下载文件名
 * @param data 任意可序列化对象
 */
export function downloadJson(filename: string, data: unknown): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * 根据首行生成默认表头标签。
 */
function buildHeaders(firstRow: string[]): string[] {
  return firstRow.map((cell, index) => (cell ? cell.trim() : `Column ${index + 1}`));
}

/**
 * 构造文件读取进度对象。
 */
function buildMeta(processed: number, total: number): FileChunkMeta {
  const safeTotal = total || 1;
  return {
    processedBytes: processed,
    totalBytes: total,
    progress: Math.min(processed / safeTotal, 1)
  } satisfies FileChunkMeta;
}
