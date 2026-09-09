import { ScriptFileError, validateScriptFile } from '@/features/script/schema';
import { extractScriptText } from '@/server/script/extract';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
            return Response.json(
                { error: { code: 'VALIDATION_FAILED', message: 'Choose a script file to import.' } },
                { status: 400 }
            );
        }

        validateScriptFile(file.name, file.size);
        const text = await extractScriptText(file.name, Buffer.from(await file.arrayBuffer()));
        return Response.json({ filename: file.name, text }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof ScriptFileError) {
            const status = error.code === 'FILE_TOO_LARGE' ? 413 : 422;
            return Response.json({ error: { code: error.code, message: error.message } }, { status });
        }
        return Response.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Could not import the script file.' } },
            { status: 500 }
        );
    }
}
