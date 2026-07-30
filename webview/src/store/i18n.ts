import { defineStore } from 'pinia';

type validLocale = 'en' | 'ja' | 'zh';
type validTab = 'flowTab' | 'translateTab';
interface tabStrings {
    [key: string]: Record<validLocale, string>;
}
interface tabs {
    flowTab: tabStrings;
    translateTab: tabStrings;
}

export const useI18nStore = defineStore('i18n', {
    state: () => ({
        locale: 'ja',
        tabs: {
            flowTab: {
                btnText: {
                    en: "EXECUTE",
                    ja: "実行",
                    zh: "执行"
                },
                initTitle: {
                    en: 'INITIALIZE',
                    ja: "初期化",
                    zh: "初始化"
                },
                prepareTitle: {
                    en: 'PREPARATION',
                    ja: "準備",
                    zh: "准备"
                },
                openDesc: {
                    en: "Open the current directory in Explorer",
                    ja: "現在のディレクトリをエクスプローラーで開きます",
                    zh: "在资源管理器中打开当前目录"
                },
                openWorkflowDesc: {
                    en: "Open advanced settings (workflow.ini)",
                    ja: "詳細設定（workflow.ini）をエディタで開きます",
                    zh: "在编辑器中打开高级设置（workflow.ini）"
                },
                initDesc: {
                    en: 'Initialize Project, set some designated directories',
                    ja: "プロジェクトを初期化し、指定されたディレクトリ構造を生成します",
                    zh: "初始化项目，生成指定的目录结构"
                },
                prepareDesc: {
                    en: 'Prepare Project, copy data to working directory',
                    ja: "データを作業ディレクトリにコピーの準備をします",
                    zh: "准备项目，将数据复制到工作目录"
                },
                createDesc: {
                    en: 'Start Translation',
                    ja: "Dataフォルダにあるファイルを用いて、作業用のファイルを作成します。同時に分析も行います。",
                    zh: "使用Data文件夹中的文件创建工作文件，并同时进行分析。"
                },
                onWorkingTitle: {
                    en: "On Working",
                    ja: "作業中",
                    zh: "进行中"
                },
                loadDesc: {
                    en: "load the existing data",
                    ja: "既存のデータを読み込みます",
                    zh: "加载现有数据"
                },
                reanalyzeDesc: {
                    en: "reanalyze the exsigting data",
                    ja: "既存データの再分析を行います",
                    zh: "重新分析现有数据"
                },
                addFilesDesc: {
                    en: "Add newly placed source files in Working/02_SOURCE to the project",
                    ja: "Working/02_SOURCE に追加配置されたファイルをプロジェクトに取り込みます",
                    zh: "将 Working/02_SOURCE 中新放置的文件添加到项目中"
                },
                completeTitle: {
                    en: 'COMPLETE',
                    ja: "完了",
                    zh: "完成"
                },
                completeDesc: {
                    en: 'Complete translation, and compile the translated file',
                    ja: "翻訳を完了し、翻訳完了ファイルを生成します",
                    zh: "完成翻译，生成翻译完成的文件"
                },
                packageDesc: {
                    en: 'Compile native files from translated XLIFF',
                    ja: "翻訳完了XLFからネイティブファイル（訳文）を生成します",
                    zh: "从翻译完成的XLF生成本地文件（译文）"
                },
                archiveDesc: {
                    en: 'Archive the current working folder',
                    ja: "現在の作業ディレクトリ（Working）をアーカイブ化します",
                    zh: "归档当前工作目录（Working）"
                },
            },
            translateTab: {
                titleCurent: {
                    en: 'CURRENT',
                    ja: "現在の行",
                    zh: "当前行"
                }
            }
        },
    }),
    getters: {
        getText: (state) => {
            return (tab: validTab, key: string): string => {
                const tabData = state.tabs[tab] as Record<string, Record<validLocale, string>> | undefined;
                if (!tabData || !tabData[key]) return '';
                return tabData[key][state.locale as validLocale] || '';
            };
        }
    },
    actions: {
        setLocale(locale: validLocale) {
            this.locale = locale;
        }
    }
});