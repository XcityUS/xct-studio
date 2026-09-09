export function appendCharacterPromptLine(prompt: string, imageIndex: number, name: string): string {
    const line = `[Image ${imageIndex}] is ${name}.`;
    const trimmed = prompt.trimEnd();
    return trimmed ? `${trimmed}\n${line}` : line;
}
