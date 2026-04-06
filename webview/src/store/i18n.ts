import { defineStore } from 'pinia';

type validLocale = 'en' | 'ja';
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
                },
                initTitle: {
                    en: 'INITIALIZE & PREPARATION',
                    ja: "初期化 ～ 準備"
                },
                openDesc: {
                    en: "Open the current directory in Explorer",
                    ja: "現在のディレクトリをエクスプローラーで開きます"
                },
                initDesc: {
                    en: 'Initialize Project, set some designated directories',
                    ja: "プロジェクトを初期化し、指定されたディレクトリ構造を生成します"
                },
                prepareDesc: {
                    en: 'Prepare Project, copy data to working directory',
                    ja: "データを作業ディレクトリにコピーの準備をします"
                },
                createDesc: {
                    en: 'Start Translation',
                    ja: "Dataフォルダにあるファイルを用いて、作業用のファイルを作成します。同時に分析も行います。"
                },
                onWorkingTitle: {
                    en: "On Working",
                    ja: "作業中"
                },
                loadDesc: {
                    en: "load the existing data",
                    ja: "既存のデータを読み込みます"
                },
                reanalyzeDesc: {
                    en: "reanalyze the exsigting data",
                    ja: "既存データの再分析を行います"
                },
                completeTitle: {
                    en: 'COMPLETE',
                    ja: "完了"
                },
                completeDesc: {
                    en: 'Complete translation, and compile the translated file',
                    ja: "翻訳を完了し、翻訳完了ファイルを生成します"
                },
                packageDesc: {
                    en: 'Compile native files from translated XLIFF',
                    ja: "翻訳完了XLFからネイティブファイル（訳文）を生成します"
                },
            },
            translateTab: {
                titleCurent: {
                    en: 'CURRENT',
                    ja: "現在の行"
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