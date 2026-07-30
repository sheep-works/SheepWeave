const globalVsCode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

export function getVsCodeApi() {
    return globalVsCode;
}
