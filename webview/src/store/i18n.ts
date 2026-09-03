import { defineStore } from 'pinia';

export type validLocale = 'en' | 'ja' | 'zh';
export type validTab = 'common' | 'flowTab' | 'translateTab' | 'searchTab' | 'toolsTab' | 'llmTab' | 'infoTab' | 'settingsTab';

interface tabStrings {
    [key: string]: Record<validLocale, string>;
}

export const useI18nStore = defineStore('i18n', {
    state: () => ({
        locale: 'ja' as validLocale,
        tabs: {
            common: {
                execute: { en: "EXECUTE", ja: "実行", zh: "执行" },
                cancel: { en: "CANCEL", ja: "キャンセル", zh: "取消" },
                save: { en: "SAVE", ja: "保存", zh: "保存" },
                clear: { en: "CLEAR", ja: "クリア", zh: "清除" },
                copy: { en: "COPY", ja: "コピー", zh: "复制" },
                loading: { en: "Processing...", ja: "処理中...", zh: "处理中..." },
                nodata: { en: "No Data", ja: "データがありません", zh: "暂无数据" },
            },
            flowTab: {
                title: { en: "Workflow", ja: "ワークフロー", zh: "流程" },
                typography: { en: "Project Workflow Processing", ja: "ワークフロー処理", zh: "流程流转" },
                btnText: { en: "EXECUTE", ja: "実行", zh: "执行" },
                initTitle: { en: 'INITIALIZE', ja: "初期化", zh: "初始化" },
                initDesc: { en: '🧵 Initialize Project, set some designated directories', ja: "🧵 プロジェクトの初期化とフォルダ構造生成", zh: "🧵 初始化项目，生成指定的目录结构" },
                openDesc: { en: "📂 Open the current directory in Explorer", ja: "📂 エクスプローラーで現在のフォルダを開く", zh: "📂 在资源管理器中打开当前目录" },
                openWorkflowDesc: { en: "⚠️ Open advanced settings (workflow.ini)", ja: "⚠️ 上級設定（workflow.ini）", zh: "⚠️ 打开高级设置（workflow.ini）" },
                prepareTitle: { en: 'PREPARATION', ja: "準備", zh: "准备" },
                prepareDesc: { en: '📨 Prepare Project, copy data to working directory', ja: "📨 作業フォルダへコピー＆XLIFF変換", zh: "📨 准备项目，将数据复制到工作目录" },
                useFprmFilter: { en: "Use fprm filter", ja: "fprmフィルタを使用", zh: "使用 fprm 过滤器" },
                useFprmFilterTooltip: { en: "Extract using custom filters created with tools like Rainbow", ja: "Rainbow などで作成したカスタムフィルタを用いて抽出します", zh: "使用像 Rainbow 等工具创建的自定义过滤器进行提取" },
                createDesc: { en: '🐑 Create project files', ja: "🐑 プロジェクトファイルの作成と解析", zh: "🐑 创建项目文件" },
                advanceWorkflowDesc: { en: "⏭️ Advance to next workflow step (Export & Shift to pre)", ja: "⏭️ 次のワークフローステップへ移行（現訳文エクスポート＆preへ移行）", zh: "⏭️ 进入下一个工作流步骤（导出当前译文并移至pre）" },
                advanceWorkflowConfirm: { en: "Are you sure you want to advance to the next workflow step?\n- Current target translations will be exported as Workflow-X.txt.\n- Target (tgt) will be shifted to previous (pre) and cleared.", ja: "次のワークフローステップに進みますか？\n・現在の訳文は Workflow-X.txt としてエクスポートされます\n・現在の訳文が pre（前工程訳）へ移行し、エディタの訳文欄（tgt）がクリアされます", zh: "确定要进入下一个工作流步骤吗？\n・当前译文将导出为 Workflow-X.txt\n・当前译文将移至 pre（前置译文），编辑器中的译文（tgt）将被清空" },
                advanceWorkflowBtn: { en: "Next Step", ja: "次のステップへ", zh: "下一步" },
                onWorkingTitle: { en: "On Working", ja: "作業中", zh: "进行中" },
                loadDesc: { en: "📟 load the existing data", ja: "📟 プロジェクトファイルを読み込み", zh: "📟 加载现有数据" },
                reanalyzeDesc: { en: "📈 reanalyze the exsigting data", ja: "📈 プロジェクトファイルの再分析と参考ファイルの追加", zh: "📈 重新分析现有数据" },
                addFilesDesc: { en: "🧶 Add newly placed source files in Working/02_SOURCE to the project", ja: "🧶 原文ファイルの追加", zh: "🧶 将 Working/02_SOURCE 中新放置的文件添加到项目中" },
                completeTitle: { en: 'COMPLETE', ja: "完了", zh: "完成" },
                completeDesc: { en: '🎉 Complete translation, and compile the translated file', ja: "🎉 翻訳完了", zh: "🎉 完成翻译，生成翻译完成的文件" },
                packageDesc: { en: '📦 Compile native files from translated XLIFF', ja: "📦 翻訳完了ファイルから元ファイルへ組み戻し", zh: "📦 从翻译完成的XLF生成本地文件（译文）" },
                archiveDesc: { en: '💼 Archive the current working folder', ja: "💼 アーカイブ化", zh: "💼 归档当前工作目录（Working）" },
                trialTitle: { en: 'TRIAL', ja: "体験", zh: "体验" },
                trialDesc: { en: '🔰 Generate a sample project from demo file', ja: "🔰 サンプルファイル（JSON）からサンプルプロジェクトを作成", zh: "🔰 从演示文件生成示例项目" },
            },
            translateTab: {
                title: { en: "Translate", ja: "翻訳", zh: "翻译" },
                titleCurrent: { en: 'CURRENT', ja: "現在", zh: "当前" },
                idRatio: { en: "ID / Ratio", ja: "ID / 類似度", zh: "ID / 匹配率" },
                source: { en: "Source", ja: "原文", zh: "原文" },
                target: { en: "Target", ja: "訳文", zh: "译文" },
                confirmed: { en: "Confirmed", ja: "確定済み", zh: "已确认" },
                draft: { en: "Draft", ja: "下書き", zh: "草稿" },
                unconfirmed: { en: "Unconfirmed", ja: "未確定", zh: "未确认" },
                applyTmTooltip: { en: "Press Ctrl+Shift+{num} to apply this TM", ja: "Ctrl+Shift+{num} を押してこの訳文を適用", zh: "按 Ctrl+Shift+{num} 应用此译文" }
            },
            searchTab: {
                title: { en: "Search", ja: "検索", zh: "检索" },
                typography: { en: "Search & Filter", ja: "検索＆フィルタ", zh: "检索与筛选" },
                placeholder: { en: "Enter search keyword...", ja: "検索キーワードを入力...", zh: "输入检索关键词..." },
                modeSource: { en: "Source", ja: "原文", zh: "原文" },
                modeTarget: { en: "Target", ja: "訳文", zh: "译文" },
                modeConcordance: { en: "Concordance", ja: "コンコーダンス", zh: "语境" },
                modeFilter: { en: "Filter", ja: "フィルタ", zh: "筛选" },
                modeAll: { en: "All", ja: "全体", zh: "全部" },
                searchBtn: { en: "Search", ja: "検索", zh: "检索" },
                tooltipShortcut: { en: "Shortcut: Ctrl+K (Source) / Ctrl+Shift+K (Target)", ja: "ショートカット: Ctrl+K (原文) / Ctrl+Shift+K (訳文)", zh: "快捷键: Ctrl+K (原文) / Ctrl+Shift+K (译文)" },
                srcFilterPlaceholder: { en: "Source Filter", ja: "原文フィルタ", zh: "原文筛选" },
                tgtFilterPlaceholder: { en: "Target Filter", ja: "訳文フィルタ", zh: "译文筛选" },
                filterBtn: { en: "Filter", ja: "抽出", zh: "筛选" },
                applyBtn: { en: "Apply ({count})", ja: "適用 ({count})", zh: "应用 ({count})" },
                foundSegments: { en: "Found {count} segments", ja: "{count} 件のセグメントが見つかりました", zh: "找到 {count} 个分句" },
                resetBtn: { en: "Reset", ja: "リセット", zh: "重置" },
                readOnlyTm: { en: "(Read-only TM)", ja: "(読み取り専用 TM)", zh: "(只读 TM)" },
                enterTranslation: { en: "Enter translation...", ja: "訳文を入力...", zh: "输入译文..." },
                noUnitsMatch: { en: "No units match \"{keyword}\"", ja: "「{keyword}」に一致するセグメントはありません", zh: "没有匹配“{keyword}”的分句" },
                enterKeywordsPrompt: { en: "Enter keywords to filter and bulk-edit segments", ja: "キーワードを入力してセグメントを抽出・一括編集できます", zh: "输入关键词以筛选和批量编辑分句" }
            },
            llmTab: {
                title: { en: "AI / LLM Assistant", ja: "AI / LLM 連携", zh: "AI 助手" },
                partialTabTitle: { en: "Partial Processing", ja: "部分処理", zh: "局部处理" },
                batchTabTitle: { en: "Batch Processing", ja: "一括処理", zh: "批量处理" },
                promptTabTitle: { en: "Prompt & Schema", ja: "プロンプトとスキーマ", zh: "提示词与 Schema" },
                bobbinTabTitle: { en: "Bobbin Config", ja: "Bobbin 設定", zh: "Bobbin 设置" },
                executionCard: { en: "Execution", ja: "実行", zh: "执行" },
                modeNormal: { en: "Normal", ja: "通常", zh: "普通" },
                modeAdvanced: { en: "Advanced (PE)", ja: "高度 (PE)", zh: "高级 (PE)" },
                cancelBatch: { en: "Cancel Batch", ja: "一括処理をキャンセル", zh: "取消批量" },
                runSelected: { en: "Run Selected Range", ja: "選択範囲を実行", zh: "运行选中范围" },
                batchRun: { en: "Run Full Document Batch", ja: "全文章の一括翻訳を実行", zh: "运行全文批量翻译" },
                batchRunTooltip: { en: "Automatically process unconfirmed segments with AI (Auto-backup is saved before run)", ja: "未確定の行をAIで一括翻訳します（実行前に自動で直前バックアップが作成されます）", zh: "使用 AI 自动批量翻译未确认行（运行前自动创建备份）" },
                rangeAlert: { en: "Selection too large. Keep under 4000 chars. (Current: {len} chars)", ja: "選択範囲が広すぎます。4000文字以下にしてください。（現在のサイズ: {len}文字）", zh: "选择范围过大。请保持在4000字以内。（当前大小: {len}字）" },
                selectedChunkCard: { en: "Selected Chunk Preview (JSONL)", ja: "選択範囲のプレビュー (JSONL)", zh: "选中块预览 (JSONL)" },
                noRangeSelected: { en: "No range selected. Select a range in .shwvt editor and press Ctrl+Q to load.", ja: "範囲が選択されていません。.shwvt エディタで選択し Ctrl+Q を押すと読み込まれます。", zh: "未选择范围。在 .shwvt 编辑器中选择并按 Ctrl+Q 加载。" },
                responseCard: { en: "Response & Results", ja: "AIからの応答・結果", zh: "AI响应与结果" },
                batchResponseCard: { en: "Batch Results", ja: "一括処理の結果", zh: "批量处理结果" },
                applyToProject: { en: "Apply to Project", ja: "プロジェクトへ適用", zh: "应用到项目" },
                applyPartialDirect: { en: "Apply to Selection", ja: "選択行へ直接適用", zh: "直接应用到选中行" },
                callingLlmTip: { en: "Calling LLM via SheepBobbin...", ja: "SheepBobbin 経由で LLM を呼び出しています...", zh: "正在通过 SheepBobbin 调用 LLM..." },
                noResponseYet: { en: "No response yet. Run selected range to view results here.", ja: "応答はまだありません。選択範囲を実行すると結果が表示されます。", zh: "尚无响应。运行选中范围以在此查看结果。" },
                noBatchResponseYet: { en: "No batch response yet. Run batch process to view results here.", ja: "一括処理の応答はまだありません。一括翻訳を実行すると結果が表示されます。", zh: "尚无批量响应。运行批量翻译以在此查看结果。" },
                outputKeysCard: { en: "Output Keys (JSONL Schema)", ja: "出力キー指定 (JSONL Schema)", zh: "输出键指定 (JSONL Schema)" },
                schemaIdxNote: { en: "Note: idx is always included.", ja: "※ idx は常に自動で含まれます。", zh: "注意：idx は常に自動で含まれます。", zh_CN: "注意：idx 总是包含在内。" },
                systemPromptCard: { en: "System Prompt", ja: "システムプロンプト", zh: "系统提示词" },
                useLocalPrompt: { en: "Use Local Prompt", ja: "ローカルプロンプトを使用", zh: "使用本地提示词" },
                useLocalPromptTooltip: { en: "Load system prompt from a local markdown file (applies to both Partial and Batch)", ja: "ローカルのマークダウンファイルからプロンプトを読み込みます（部分処理・一括処理の両方に適用）", zh: "从本地 Markdown 文件加载提示词（同时应用于局部和批量处理）" },
                chunkSizeLabel: { en: "Chunk Size (chars)", ja: "チャンクサイズ (文字数)", zh: "分块大小 (字符数)" },
                chunkSizeTooltip: { en: "Maximum character length per chunk for batch processing (Default: 3500)", ja: "一括処理で1回のリクエストに含める最大文字数（デフォルト: 3500）", zh: "批量处理时每个分块的最大字符长度（默认：3500）" },
                exportPrompt: { en: "Export prompt.md", ja: "prompt.md を書き出し", zh: "导出 prompt.md" },
                importPrompt: { en: "Import prompt.md", ja: "prompt.md を読み込み", zh: "导入 prompt.md" },
                resetPrompt: { en: "Reset", ja: "リセット", zh: "重置" },
                promptPlaceholder: { en: "Enter system prompt here...", ja: "システムプロンプトを入力してください...", zh: "在此输入系统提示词..." },
                bobbinConnectionCard: { en: "SheepBobbin Connection", ja: "SheepBobbin 接続設定", zh: "SheepBobbin 连接设置" },
                apiKeyLabel: { en: "API Key", ja: "API キー", zh: "API 密钥" },
                apiKeyPlaceholder: { en: "Enter SheepBobbin API Key", ja: "SheepBobbin API キーを入力してください", zh: "输入 SheepBobbin API 密钥" },
                autoReflectLabel: { en: "Reflect LLM output to refs.tm", ja: "refs.tm に LLM 結果を自動反映", zh: "自动将 LLM 结果反映至 refs.tm" },
                autoReflectHelp: { en: "Automatically record LLM translation output as TM candidates in refs.tm", ja: "LLM の出力結果を翻訳メモリ候補 (refs.tm) に自動登録します", zh: "自动将 LLM 翻译输出作为 TM 候选记录在 refs.tm 中" },
                chatCardTitle: { en: "AI Chat & Refinement", ja: "AIとの対話・追加指示", zh: "AI 对话与追加指令" },
                includeContextLabel: { en: "Include recent context (Source & Result)", ja: "直前の原文・訳文を文脈に含める", zh: "包含最近的原文与译文上下文" },
                quoteContextBtn: { en: "Quote Context", ja: "直前の結果を引用", zh: "引用上下文" },
                chatInputPlaceholder: { en: "Ask a question or provide refinement instructions... (e.g. Why did you translate idx 2 this way? / Change idx 3 tone to polite)", ja: "質問や追加指示を入力...（例: idx2の訳文の根拠は？ / idx3の口調を丁寧に修正して）", zh: "输入问题或追加指令...（例：idx2这样翻译的依据是？ / 将idx3语气修改为敬语）" },
                sendChatBtn: { en: "Send Question", ja: "質問を送信", zh: "发送提问" },
                chatResponseTitle: { en: "AI Answer / Explanation", ja: "AIからの回答・解説", zh: "AI 回答与解释" },
                copyChatResponseBtn: { en: "Copy Answer", ja: "回答をコピー", zh: "复制回答" },
                chatCopiedTip: { en: "Copied to clipboard!", ja: "クリップボードにコピーしました！", zh: "已复制到剪贴板！" },
                resetTabTitle: { en: "Reset LLM Results", ja: "LLM 結果のリセット", zh: "重置 LLM 结果" },
                resetCardTitle: { en: "Reset LLM Translation Memory", ja: "LLM 翻訳メモリの一括削除", zh: "批量删除 LLM 翻译记忆" },
                resetDescription: { en: "Bulk remove all LLM-originated translation memory entries (file: 'LLM') from project segments.", ja: "プロジェクト内の各文に保持されている LLM 起源の翻訳メモリ候補 (file: 'LLM') を一括で削除します。", zh: "批量删除项目分句中保留的所有源自 LLM 的翻译记忆候选（file: 'LLM'）。" },
                resetBtn: { en: "Clear LLM TMs", ja: "LLM 翻訳メモリを一括削除", zh: "一括删除 LLM 翻译记忆" },
                resetConfirmTitle: { en: "Are you sure you want to delete all LLM translation memories?", ja: "本当に LLM 翻訳メモリを一括削除しますか？", zh: "确定要批量删除所有 LLM 翻译记忆吗？" }
            },
            infoTab: {
                title: { en: "Project Info", ja: "プロジェクト情報", zh: "项目信息" },
                infoSubtab: { en: "Information", ja: "基本情報", zh: "基本信息" },
                statsSubtab: { en: "Statistics", ja: "統計情報", zh: "统计信息" },
                exportSubtab: { en: "Export & Backup", ja: "出力・バックアップ", zh: "导出与备份" },
                shuttleSubtab: { en: "Shuttle Tools", ja: "Shuttle ツール", zh: "Shuttle 工具" },
                debugSubtab: { en: "Debug", ja: "デバッグ", zh: "调试" },
                aboutCard: { en: "About SheepWeave", ja: "SheepWeave について", zh: "关于 SheepWeave" },
                version: { en: "Version", ja: "バージョン", zh: "版本" },
                developer: { en: "Developer", ja: "開発元", zh: "开发者" },
                developerValue: { en: "開発：合同会社ランベージ＆ひつじの翻訳室", ja: "開発：合同会社ランベージ＆ひつじの翻訳室", zh: "开发：合同会社ランベージ＆ひつじの翻訳室" },
                metaCard: { en: "Project Metadata", ja: "プロジェクト メタデータ", zh: "项目元数据" },
                projectName: { en: "Project Name", ja: "プロジェクト名", zh: "项目名称" },
                sourceLang: { en: "Source Language", ja: "原言語", zh: "源语言" },
                targetLang: { en: "Target Language", ja: "標的言語", zh: "目标语言" },
                sourceFilesCard: { en: "Source Files", ja: "原文ファイル一覧", zh: "源文件列表" },
                tmFilesCard: { en: "TM Files", ja: "TMファイル一覧", zh: "TM文件列表" },
                tbFilesCard: { en: "TB Files", ja: "TBファイル一覧", zh: "TB文件列表" },
                copyStoreBtn: { en: "Copy Store State", ja: "ストア状態をコピー", zh: "复制 Store 状态" },
                backupCard: { en: "Project Backup & Restore", ja: "プロジェクトのバックアップと復元", zh: "项目备份与还原" },
                backupHelp: { en: "Snapshots of Target.txt, Source.txt, and project.json are saved into Working/04_SHWV/Backup/.", ja: "Working/04_SHWV/Backup/ フォルダ内に Target.txt と project.json をペアで安全に保存・復元します。", zh: "将 Target.txt、Source.txt 和 project.json 作为快照保存至 Working/04_SHWV/Backup/ 中。" },
                createBackupBtn: { en: "Create Backup Now", ja: "今すぐバックアップを作成", zh: "立即创建备份" },
                openBackupFolderBtn: { en: "Open Backup Folder", ja: "バックアップフォルダを開く", zh: "打开备份文件夹" },
                backupListTitle: { en: "Backup History", ja: "バックアップ履歴", zh: "备份历史记录" },
                noBackups: { en: "No backups created yet.", ja: "バックアップはまだありません。", zh: "暂无备份。" },
                colBackupName: { en: "Backup Name / Timestamp", ja: "バックアップ名 / 作成日時", zh: "备份名称 / 时间戳" },
                colBackupContents: { en: "Contents", ja: "含まれるファイル", zh: "包含文件" },
                colAction: { en: "Action", ja: "操作", zh: "操作" },
                restoreBtn: { en: "Restore", ja: "復元", zh: "还原" },
                restoreConfirmTitle: { en: "Restore this backup?", ja: "このバックアップから復元しますか？", zh: "确定从此备份还原吗？" },
                restoreConfirmContent: { en: "Current Target.shwvt and project.json will be overwritten with this snapshot.", ja: "現在の Target.shwvt と project.json がこのスナップショットの内容で上書きされます。", zh: "当前的 Target.shwvt 和 project.json 将被此快照的内容覆盖。" },
                backupCreatedSuccess: { en: "Backup created successfully!", ja: "バックアップを作成しました！", zh: "备份创建成功！" },
                backupRestoredSuccess: { en: "Project restored successfully from backup!", ja: "バックアップからプロジェクトを復元しました！", zh: "项目已成功从备份还原！" }
            },
            toolsTab: {
                title: { en: "Tools", ja: "ツール", zh: "工具" },
                diffSubtab: { en: "Diff", ja: "差分", zh: "差异" },
                qaSubtab: { en: "QA", ja: "QA", zh: "QA" },
                subeditorSubtab: { en: "Sub-editor", ja: "サブエディタ", zh: "副编辑器" },
                underConstruction: { en: "Under Construction", ja: "作成中", zh: "建设中" }
            },
            settingsTab: {
                title: { en: "Settings", ja: "設定", zh: "设置" },
                editorSubtab: { en: "Panel Display", ja: "パネル表示", zh: "面板显示" },
                autocompleteSubtab: { en: "Auto-Completion", ja: "自動補完", zh: "自动补全" },
                aboutSubtab: { en: "About", ja: "このソフトについて", zh: "关于本软件" },
                versionLogsCard: { en: "Version Logs", ja: "バージョン履歴", zh: "版本日志" },
                noVersionLogs: { en: "No version logs available.", ja: "バージョン履歴がありません。", zh: "暂无版本日志。" },
                editorHelp: {
                    en: "Customize your experience in SheepWeave Panel.",
                    ja: "SheepWeave パネルの表示をカスタマイズします。",
                    zh: "自定义 SheepWeave 面板的显示。"
                },
                displayCard: { en: "Translation Display", ja: "翻訳関連表示", zh: "翻译相关显示" },
                fontSize: { en: "Font Size", ja: "フォントサイズ", zh: "字体大小" },
                fontSizeTooltip: { en: "Adjust font size in Translate tab", ja: "翻訳タブの表示文字サイズを調整します", zh: "调整翻译标签页的字号" },
                language: { en: "Language", ja: "言語", zh: "语言" },
                languageTooltip: { en: "Switch UI language (Japanese / English / Chinese)", ja: "パネルの表示言語を切り替えます", zh: "切换面板语言" },
                phrasesCard: { en: "IntelliSense Phrases (phrase.json)", ja: "補完用フレーズ (phrase.json)", zh: "补全短语 (phrase.json)" },
                savePhrasesBtn: { en: "Save to phrase.json", ja: "phrase.json に保存", zh: "保存到 phrase.json" },
                phrasesHelp: { en: "Define shortcuts to quickly insert common phrases in the editor.", ja: "エディタでよく使うフレーズをすばやく入力するためのショートカットを定義します。", zh: "定义快捷方式以在编辑器中快速插入常用短语。" },
                colInput: { en: "Input (Shortcut)", ja: "入力 (ショートカット)", zh: "输入 (快捷键)" },
                colPhrase: { en: "Phrase (Expansion)", ja: "展開フレーズ", zh: "展开短语" },
                colAction: { en: "Action", ja: "操作", zh: "操作" },
                addPhraseBtn: { en: "Add New Phrase", ja: "新規フレーズを追加", zh: "添加新短语" },
                samplesCard: { en: "Sample Resources", ja: "サンプルデータ", zh: "示例资源" },
                samplesHelp: { en: "Download official sample filter definitions (.fprm) and prompts (.md) into your project (filters/ and prompts/). Existing files will not be overwritten.", ja: "公式のフィルター定義 (.fprm) およびサンプルプロンプト (.md) をダウンロードしてプロジェクト（filters / prompts）に配置します。（既存ファイルはスキップされます）", zh: "下载官方示例过滤器定义 (.fprm) 与提示词 (.md) 至项目中（filters 与 prompts 目录）。（不会覆盖已有文件）" },
                fetchSamplesBtn: { en: "Download Sample Prompts & Filters", ja: "サンプルプロンプトとフィルターを取得", zh: "获取示例提示词与过滤器" },
                fetchSamplesSuccess: { en: "Sample prompts and filters downloaded successfully!", ja: "サンプルプロンプトとフィルターを取得しました！", zh: "已成功获取示例提示词与过滤器！" }
            }
        }
    }),
    getters: {
        getText: (state) => {
            return (tab: validTab, key: string, params?: Record<string, string | number>): string => {
                const tabData = state.tabs[tab] as Record<string, Record<validLocale, string>> | undefined;
                if (!tabData || !tabData[key]) return '';
                let text = tabData[key][state.locale as validLocale] || '';
                if (params) {
                    Object.keys(params).forEach(k => {
                        text = text.replace(`{${k}}`, String(params[k]));
                    });
                }
                return text;
            };
        }
    },
    actions: {
        setLocale(locale: validLocale) {
            this.locale = locale;
        }
    }
});