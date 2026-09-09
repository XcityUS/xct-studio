import { ScriptFileError, validateScriptFile } from '@/features/script/schema';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import 'server-only';
import WordExtractor from 'word-extractor';

function normalizeExtractedText(value: string): string {
    return value
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
        return (await parser.getText()).text;
    } finally {
        await parser.destroy();
    }
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
        throw new ScriptFileError(
            'Could not extract text from this file. Check that it is not encrypted or damaged.',
            'EXTRACTION_FAILED'
        );
    }
}
