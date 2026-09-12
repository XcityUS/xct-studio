import { ScriptFileError, validateScriptFile } from '@/features/script/schema';
import mammoth from 'mammoth';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFParse, type ParseParameters } from 'pdf-parse';
import {
    getDocument,
    GlobalWorkerOptions,
    type TextItem,
    VerbosityLevel
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'server-only';
import WordExtractor from 'word-extractor';

class PdfExtractionFailure extends Error {
    constructor(readonly diagnostics: string[]) {
        super('PDF text extraction failed.');
        this.name = 'PdfExtractionFailure';
    }
}

function describeExtractionError(error: unknown): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }

    return String(error);
}

function logPdfExtractionFallback(label: string, error: unknown): void {
    if (process.env.NODE_ENV !== 'development') return;
    console.warn(`[script-extract] ${label} failed: ${describeExtractionError(error)}`);
}

function pdfjsAssetUrl(directory: 'cmaps' | 'standard_fonts' | 'wasm'): string {
    return `${pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist', directory)).href}/`;
}

function configurePdfWorker(): void {
    const workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
    GlobalWorkerOptions.workerSrc = workerSrc;
    PDFParse.setWorker(workerSrc);
}

configurePdfWorker();

function normalizeExtractedText(value: string): string {
    return value
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

async function extractPdfWithParams(buffer: Buffer, params: ParseParameters = {}): Promise<string> {
    configurePdfWorker();
    const parser = new PDFParse({ data: buffer });

    try {
        return (await parser.getText(params)).text;
    } finally {
        await parser.destroy();
    }
}

async function extractPdfByPage(buffer: Buffer, params: ParseParameters): Promise<string> {
    configurePdfWorker();
    const parser = new PDFParse({ data: buffer });

    try {
        const info = await parser.getInfo();
        const chunks: string[] = [];

        for (let page = 1; page <= info.total; page += 1) {
            try {
                const result = await parser.getText({
                    ...params,
                    pageJoiner: '',
                    partial: [page],
                });
                const text = normalizeExtractedText(result.text);

                if (text) {
                    chunks.push(text);
                }
            } catch {
                // A selectable PDF can still contain a broken page/font map.
                // Keep readable pages instead of failing the whole import.
            }
        }

        return chunks.join('\n\n');
    } finally {
        await parser.destroy();
    }
}

async function extractPdfWithPdfjs(
    buffer: Buffer,
    textOptions: { disableNormalization?: boolean; includeMarkedContent?: boolean } = {},
    diagnostics: string[] = []
): Promise<string> {
    configurePdfWorker();
    const document = await getDocument({
        cMapPacked: true,
        cMapUrl: pdfjsAssetUrl('cmaps'),
        data: new Uint8Array(buffer),
        disableFontFace: false,
        enableXfa: true,
        isEvalSupported: false,
        stopAtErrors: false,
        standardFontDataUrl: pdfjsAssetUrl('standard_fonts'),
        useSystemFonts: true,
        useWasm: true,
        useWorkerFetch: false,
        verbosity: VerbosityLevel.ERRORS,
        wasmUrl: pdfjsAssetUrl('wasm'),
    }).promise;
    const chunks: string[] = [];

    try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            try {
                const page = await document.getPage(pageNumber);
                const content = await page.getTextContent(textOptions);
                const text = content.items
                    .filter((item): item is TextItem => 'str' in item)
                    .map((item) => item.str)
                    .join(' ');
                const normalized = normalizeExtractedText(text);

                if (normalized) {
                    chunks.push(normalized);
                }
                page.cleanup();
            } catch (error) {
                diagnostics.push(`pdfjs page ${pageNumber}: ${describeExtractionError(error)}`);
                logPdfExtractionFallback(`pdfjs page ${pageNumber}`, error);
                // Continue with the next page; the importer can still use partial readable text.
            }
        }

        return chunks.join('\n\n');
    } finally {
        await document.destroy();
    }
}

async function extractPdf(buffer: Buffer): Promise<string> {
    const fallbackParams: ParseParameters = {
        cellSeparator: ' ',
        disableNormalization: true,
        includeMarkedContent: true,
        itemJoiner: ' ',
        lineEnforce: false,
        pageJoiner: '\n\n',
    };
    const diagnostics: string[] = [];
    const attempts: Array<() => Promise<string>> = [
        () => extractPdfWithParams(buffer),
        () => extractPdfWithParams(buffer, fallbackParams),
        () => extractPdfByPage(buffer, fallbackParams),
        () => extractPdfWithPdfjs(buffer, {}, diagnostics),
        () =>
            extractPdfWithPdfjs(
                buffer,
                {
                    disableNormalization: true,
                    includeMarkedContent: true,
                },
                diagnostics
            ),
    ];
    let lastError: unknown;

    for (const [index, attempt] of attempts.entries()) {
        try {
            const text = await attempt();

            if (normalizeExtractedText(text)) {
                return text;
            }
            diagnostics.push(`attempt ${index + 1}: empty text`);
        } catch (error) {
            lastError = error;
            diagnostics.push(`attempt ${index + 1}: ${describeExtractionError(error)}`);
            logPdfExtractionFallback(`attempt ${index + 1}`, error);
        }
    }

    if (lastError && diagnostics.length === 0) {
        diagnostics.push(describeExtractionError(lastError));
    }

    throw new PdfExtractionFailure(diagnostics);
}

export async function extractScriptText(filename: string, buffer: Buffer): Promise<string> {
    const extension = validateScriptFile(filename, buffer.byteLength);

    try {
        let text = '';
        if (extension === 'txt' || extension === 'md') {
            text = new TextDecoder('utf-8').decode(buffer);
        } else if (extension === 'docx') {
            text = (await mammoth.extractRawText({ buffer })).value;
        } else if (extension === 'doc') {
            const document = await new WordExtractor().extract(buffer);
            text = document.getBody();
        } else {
            text = await extractPdf(buffer);
        }

        const normalized = normalizeExtractedText(text);
        if (!normalized) {
            throw new ScriptFileError('The script file did not contain readable text.', 'EMPTY_FILE');
        }
        return normalized;
    } catch (error) {
        if (error instanceof ScriptFileError) throw error;
        const debug =
            error instanceof PdfExtractionFailure && process.env.NODE_ENV === 'development'
                ? ` Debug: ${error.diagnostics.join(' | ')}`
                : '';
        throw new ScriptFileError(
            `Could not extract text from this file. It may be scanned, image-only, encrypted, damaged, or unreadable.${debug}`,
            'EXTRACTION_FAILED'
        );
    }
}
