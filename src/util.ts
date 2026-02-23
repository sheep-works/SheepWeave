export function getExtention(filepath: string): string {
    return filepath.split('.').pop() || '';
}