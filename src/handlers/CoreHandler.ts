import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShWvData } from '../services/core/ShWvData';
import { ProjectManager } from '../services/core/ProjectManager';
import { initDirs, prepareWorking, preprocessor, postprocessor, runTikalExtraction, runPackage } from '../services/fileOps';

export class CoreHandler {
    public static async handle(message: any, globalShWvData: ShWvData, rootPath: string, panel: vscode.WebviewPanel) {
        switch (message.type) {
            case 'open-current':
                vscode.env.openExternal(vscode.Uri.file(rootPath));
                break;
            case 'init':
                await initDirs(rootPath);
                vscode.window.showInformationMessage('Project Initialized');
                break;
            case 'prepare':
                const payload = message.payload || {};
                await prepareWorking(rootPath);
                
                let sourceFiles: string[] = [];
                const sourceDir = path.join(rootPath, 'Working', '02_SOURCE');
                if (fs.existsSync(sourceDir)) {
                    sourceFiles = fs.readdirSync(sourceDir).filter((f: string) => fs.statSync(path.join(sourceDir, f)).isFile());
                }

                const projectManager = new ProjectManager(rootPath);
                projectManager.initialize(
                    payload.projectName || 'SheepWeaveProject',
                    payload.sourceLang || 'en-US',
                    payload.targetLang || 'ja-JP',
                    sourceFiles
                );
                projectManager.save();

                await runTikalExtraction(rootPath, projectManager.data.sourceLanguage, projectManager.data.targetLanguage);
                vscode.window.showInformationMessage('Project Prepared, project.json created, and Tikal Extraction completed');
                break;
            case 'create':
                const shwvData = await preprocessor(rootPath);
                if (shwvData) {
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: shwvData.meta, units: shwvData.body.units } });
                }
                vscode.window.showInformationMessage('Preprocessing Started (Data loaded to Webview)');
                break;
            case 'load':
                globalShWvData.load(rootPath);
                if (globalShWvData.meta && globalShWvData.body?.units?.length > 0) {
                    panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units } });
                    vscode.window.showInformationMessage('Data Loaded and Synchronized');
                }
                break;
            case 'reanalyze':
                await globalShWvData.analyze(rootPath);
                globalShWvData.save(rootPath);
                panel.webview.postMessage({ type: 'SHWV_DATA_LOADED', data: { meta: globalShWvData.meta, units: globalShWvData.body.units } });
                vscode.window.showInformationMessage('Re-analysis completed and data updated');
                break;
            case 'complete':
                await postprocessor(rootPath);
                vscode.window.showInformationMessage('Postprocessing Finished');
                break;
            case 'package':
                await runPackage(rootPath);
                vscode.window.showInformationMessage('Native Files Packaged');
                break;
            case 'alert':
                vscode.window.showErrorMessage(message.text);
                break;
            case 'READY':
                const config = vscode.workspace.getConfiguration('sheepWeave');
                panel.webview.postMessage({
                    type: 'CONFIG_LOADED',
                    data: {
                        sourceLang: config.get<string>('sourceLang') || 'en-US',
                        targetLang: config.get<string>('targetLang') || 'ja-JP',
                        fontSize: config.get<number>('translateTab.fontSize') || 14
                    }
                });

                if (globalShWvData.meta && globalShWvData.body.units.length > 0) {
                    panel.webview.postMessage({
                        type: 'SHWV_DATA_LOADED',
                        data: { meta: globalShWvData.meta, units: globalShWvData.body.units }
                    });
                }
                break;
            default:
                break;
        }
    }
}
