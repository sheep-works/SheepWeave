import * as fs from 'fs';
import * as path from 'path';
import { ShWvData } from './core/ShWvData';
import type { ShWvUnit } from '../types/datatype';

function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

interface TermHighlightItem {
    src: string;
    tgts: string[];
}

/**
 * 訳文テキスト内の用語を検出し、色付け用の <mark class="term-highlight"> でラップします（用語ツールチップは付けず色のみ）。
 */
function highlightTermsInTarget(text: string, terms: TermHighlightItem[]): { html: string; matchCount: number } {
    if (!text || terms.length === 0) {
        return { html: escapeHtml(text), matchCount: 0 };
    }

    const searchWords = new Set<string>();
    for (const t of terms) {
        for (const tgt of t.tgts) {
            if (tgt && tgt.trim()) searchWords.add(tgt);
        }
        if (t.src && t.src.trim()) {
            searchWords.add(t.src);
        }
    }

    const candidates = Array.from(searchWords).sort((a, b) => b.length - a.length);
    if (candidates.length === 0) {
        return { html: escapeHtml(text), matchCount: 0 };
    }

    interface MatchRange {
        start: number;
        end: number;
    }
    const matchRanges: MatchRange[] = [];

    for (const word of candidates) {
        let pos = 0;
        while ((pos = text.indexOf(word, pos)) !== -1) {
            const start = pos;
            const end = pos + word.length;
            pos += word.length;

            const overlaps = matchRanges.some(r => !(end <= r.start || start >= r.end));
            if (!overlaps) {
                matchRanges.push({ start, end });
            }
        }
    }

    if (matchRanges.length === 0) {
        return { html: escapeHtml(text), matchCount: 0 };
    }

    matchRanges.sort((a, b) => a.start - b.start);

    let resultHtml = '';
    let lastIdx = 0;

    for (const range of matchRanges) {
        if (range.start > lastIdx) {
            resultHtml += escapeHtml(text.substring(lastIdx, range.start));
        }
        const matchedText = text.substring(range.start, range.end);
        resultHtml += `<mark class="term-highlight">${escapeHtml(matchedText)}</mark>`;
        lastIdx = range.end;
    }

    if (lastIdx < text.length) {
        resultHtml += escapeHtml(text.substring(lastIdx));
    }

    return { html: resultHtml, matchCount: matchRanges.length };
}

/**
 * プレースホルダーの元データを検証し、安全なHTMLタグ (br, b, i, u, color, span, img, ruby 等) のみを復元・変換します。
 * XLIFFや各CATツールの独自メタタグ (<rpr>, <ph>, <g>, <bpt> 等) は非表示 (空文字) にします。
 */
function processPlaceholderTag(rawTag: string): string {
    if (!rawTag) return '';
    let decoded = rawTag.trim();
    if (decoded.startsWith('&lt;') && decoded.endsWith('&gt;')) {
        decoded = decoded.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    }

    // 1. 改行タグ
    if (/^<br\s*\/?>$/i.test(decoded) || decoded === '\\n') {
        return '<br>';
    }

    // 2. 太字 (Bold)
    if (/^<\/?(b|strong)>$/i.test(decoded)) {
        return decoded.toLowerCase();
    }

    // 3. 斜体 (Italic)
    if (/^<\/?(i|em)>$/i.test(decoded)) {
        return decoded.toLowerCase();
    }

    // 4. 下線 / 取り消し線 (Underline / Strike)
    if (/^<\/?(u|s|del|strike)>$/i.test(decoded)) {
        return decoded.toLowerCase();
    }

    // 5. カラータグ (Unity rich text <color=#ff0000> / <color="red"> / </color> または HTML <font color="...">)
    const openColorMatch = decoded.match(/^<color=(?:["']?)([^"'>]+)(?:["']?)>$/i);
    if (openColorMatch) {
        const colorVal = escapeHtml(openColorMatch[1]);
        return `<span style="color: ${colorVal};">`;
    }
    if (/^<\/color>$/i.test(decoded) || /^<\/font>$/i.test(decoded)) {
        return '</span>';
    }
    const fontColorMatch = decoded.match(/^<font\s+color=(?:["']?)([^"'>]+)(?:["']?)>$/i);
    if (fontColorMatch) {
        const colorVal = escapeHtml(fontColorMatch[1]);
        return `<span style="color: ${colorVal};">`;
    }

    // 6. 安全な span
    if (/^<\/span>$/i.test(decoded)) {
        return '</span>';
    }
    const spanStyleMatch = decoded.match(/^<span\s+style=["']([^"']+)["']>$/i);
    if (spanStyleMatch) {
        const safeStyles = spanStyleMatch[1].split(';').map(s => s.trim()).filter(s => {
            return /^(color|font-weight|font-style|text-decoration|background-color)\s*:/i.test(s);
        }).join('; ');
        if (safeStyles) {
            return `<span style="${escapeHtml(safeStyles)}">`;
        }
        return '<span>';
    }

    // 7. 画像・アイコン (img)
    const imgMatch = decoded.match(/^<img\s+([^>]+)>/i);
    if (imgMatch) {
        const srcMatch = imgMatch[1].match(/src=["']([^"']+)["']/i);
        const altMatch = imgMatch[1].match(/alt=["']([^"']+)["']/i);
        if (srcMatch) {
            const src = escapeHtml(srcMatch[1]);
            const alt = altMatch ? escapeHtml(altMatch[1]) : '';
            return `<img src="${src}" alt="${alt}" style="max-height: 1.2em; vertical-align: middle;">`;
        }
    }

    // 8. ルビ (ruby, rt, rp)
    if (/^<\/?(ruby|rt|rp)>$/i.test(decoded)) {
        return decoded.toLowerCase();
    }

    // 9. 変数・プレースホルダーテキスト (%s, %d, {0}, {count}, &nbsp; 等で <タグ> 形式でないもの)
    if (!decoded.startsWith('<') && !decoded.endsWith('>')) {
        return escapeHtml(decoded);
    }

    // 10. それ以外のXLIFF / CAT独自メタタグ (<rpr>, <ph>, <g>, <bpt>, <ept> 等) は非表示
    return '';
}

/**
 * 訳文テキスト内のプレースホルダー ({@0}) をセーフリストで復元しつつ、プレーンテキスト部分に用語ハイライトを適用します。
 */
function renderSegmentTargetHtml(
    text: string,
    placeholders?: Record<number | string, string> | string[],
    terms: TermHighlightItem[] = []
): { html: string; matchCount: number } {
    if (!text) {
        return { html: '', matchCount: 0 };
    }

    // {@0} を区切りとしてテキストを分割
    const parts = text.split(/\{@(\d+)\}/g);
    let totalMatchCount = 0;
    let fullHtml = '';

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // テキスト部分：用語ハイライト
            const plainChunk = parts[i];
            if (plainChunk) {
                const { html, matchCount } = highlightTermsInTarget(plainChunk, terms);
                fullHtml += html;
                totalMatchCount += matchCount;
            }
        } else {
            // プレースホルダー番号部分
            const phIdx = parseInt(parts[i], 10);
            let rawTag = '';
            if (placeholders) {
                rawTag = (placeholders as any)[phIdx] !== undefined ? (placeholders as any)[phIdx] : (placeholders as any)[parts[i]] || '';
            }
            fullHtml += processPlaceholderTag(rawTag);
        }
    }

    return { html: fullHtml, matchCount: totalMatchCount };
}

/**
 * 原文テキスト内のプレースホルダーを除去・整形してツールチップ用のクリーンテキストにします。
 */
function formatSourceTextClean(text: string, placeholders?: Record<number | string, string> | string[]): string {
    if (!text) return '';
    return text.replace(/\{@(\d+)\}/g, (_match, idxStr) => {
        const idx = parseInt(idxStr, 10);
        let raw = '';
        if (placeholders) {
            raw = (placeholders as any)[idx] !== undefined ? (placeholders as any)[idx] : (placeholders as any)[idxStr] || '';
        }
        // 改行タグはスペースに変換
        if (/^<br\s*\/?>$/i.test(raw) || raw === '\\n') {
            return ' ';
        }
        // 変数 (%s, {0} など) はそのまま残す
        if (raw && !raw.startsWith('<') && !raw.endsWith('>')) {
            return raw;
        }
        // タグ類は除去
        return '';
    }).replace(/\s+/g, ' ').trim();
}

export class ReviewHtmlExporter {
    /**
     * プロジェクトデータから段落構成を復元し、原文ツールチップ・用語色付け付きのモノリンガルQAレビューHTMLを出力します。
     */
    public static exportHtml(data: ShWvData, rootPath: string, tbData: { src: string; tgt: string }[] = []): string {
        const shwvDir = path.join(rootPath, 'Working', '04_SHWV');
        if (!fs.existsSync(shwvDir)) {
            fs.mkdirSync(shwvDir, { recursive: true });
        }
        const outputPath = path.join(shwvDir, 'Review_Terms.html');

        const projectName = data.meta.projectName || data.projectInfo?.projectName || path.basename(rootPath);
        const sourceLang = data.meta.sourceLang || data.projectInfo?.sourceLanguage || 'Source';
        const targetLang = data.meta.targetLang || data.projectInfo?.targetLanguage || 'Target';

        // 全体のプロジェクト用語マップを構築
        const globalTermMap = new Map<string, Set<string>>();
        if (data.body?.terms) {
            for (const t of data.body.terms) {
                if (t.src && t.src.trim()) {
                    if (!globalTermMap.has(t.src)) globalTermMap.set(t.src, new Set());
                    if (t.tgt) globalTermMap.get(t.src)!.add(t.tgt);
                }
            }
        }
        if (tbData) {
            for (const t of tbData) {
                if (t.src && t.src.trim()) {
                    if (!globalTermMap.has(t.src)) globalTermMap.set(t.src, new Set());
                    if (t.tgt) globalTermMap.get(t.src)!.add(t.tgt);
                }
            }
        }

        const totalUnits = data.body.units.length;
        let confirmedCount = 0;
        let proofedCount = 0;
        let totalTermsFound = 0;

        // 段落ごとにユニットをグループ化（!unit.isSub で新しい段落を開始）
        const paragraphs: ShWvUnit[][] = [];
        let curPara: ShWvUnit[] = [];

        for (const unit of data.body.units) {
            if (!unit.isSub && curPara.length > 0) {
                paragraphs.push(curPara);
                curPara = [];
            }
            curPara.push(unit);
        }
        if (curPara.length > 0) {
            paragraphs.push(curPara);
        }

        const paragraphsHtml: string[] = [];

        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
            const pUnits = paragraphs[pIdx];
            const segSpans: string[] = [];

            for (const unit of pUnits) {
                const idx = unit.idx !== undefined ? unit.idx : 0;
                const status = unit.status || 0;

                if (status === 1) confirmedCount++;
                else if (status === 2) proofedCount++;

                // ユニット固有の用語マップ
                const unitTermMap = new Map<string, Set<string>>();
                if (unit.ref?.tb) {
                    for (const tb of unit.ref.tb) {
                        if (tb.src && tb.src.trim()) {
                            if (!unitTermMap.has(tb.src)) unitTermMap.set(tb.src, new Set());
                            if (tb.tgts) {
                                for (const tgt of tb.tgts) {
                                    if (tgt) unitTermMap.get(tb.src)!.add(tgt);
                                }
                            }
                            if ((tb as any).tgt) {
                                unitTermMap.get(tb.src)!.add((tb as any).tgt);
                            }
                        }
                    }
                }
                for (const [src, tgts] of globalTermMap.entries()) {
                    if (unit.src.includes(src)) {
                        if (!unitTermMap.has(src)) unitTermMap.set(src, new Set());
                        for (const tgt of tgts) {
                            unitTermMap.get(src)!.add(tgt);
                        }
                    }
                }

                const termItems: TermHighlightItem[] = Array.from(unitTermMap.entries()).map(([src, tgtsSet]) => ({
                    src,
                    tgts: Array.from(tgtsSet)
                }));

                const targetText = unit.tgt || unit.pre || '';
                const placeholders = unit.placeholders || [];
                const { html: targetHtml, matchCount } = renderSegmentTargetHtml(targetText, placeholders, termItems);
                totalTermsFound += matchCount;

                const cleanSrc = formatSourceTextClean(unit.src, placeholders);
                const tooltipTitle = `[#${idx + 1}] 原文: ${cleanSrc || unit.src}${unit.note ? ' | Note: ' + unit.note : ''}`;

                segSpans.push(
                    `<span class="seg status-${status}" data-idx="${idx}" data-status="${status}" data-src="${escapeHtml(cleanSrc || unit.src)}" data-raw-src="${escapeHtml(unit.src)}" data-note="${escapeHtml(unit.note || '')}" title="${escapeHtml(tooltipTitle)}">${targetHtml || '<span class="empty-seg">[未訳]</span>'}</span>`
                );
            }

            paragraphsHtml.push(
                `<p class="review-paragraph" data-para-idx="${pIdx + 1}">${segSpans.join('')}</p>`
            );
        }

        const nowStr = new Date().toLocaleString('ja-JP');

        const htmlContent = `<!DOCTYPE html>
<html lang="ja" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA Review: ${escapeHtml(projectName)}</title>
    <style>
        :root {
            --bg-color: #f8f9fa;
            --card-bg: #ffffff;
            --text-color: #2c3e50;
            --text-muted: #6c757d;
            --border-color: #e2e8f0;
            --header-bg: #ffffff;
            --term-color: #996515;
            --term-bg: #fff3cd;
            --term-border: #ffeeba;
            --seg-hover-bg: rgba(66, 153, 225, 0.15);
            --seg-active-bg: rgba(66, 153, 225, 0.3);
            --info-panel-bg: #ffffff;
            --info-panel-border: #cbd5e0;
            --status-draft-indicator: #e2e8f0;
            --status-confirmed-indicator: #48bb78;
            --base-font-size: 16px;
        }

        [data-theme="dark"] {
            --bg-color: #1a1a24;
            --card-bg: #242533;
            --text-color: #e2e8f0;
            --text-muted: #a0aec0;
            --border-color: #3b3d54;
            --header-bg: #1f202c;
            --term-color: #ffd700;
            --term-bg: rgba(255, 215, 0, 0.25);
            --term-border: #ffd700;
            --seg-hover-bg: rgba(99, 179, 237, 0.2);
            --seg-active-bg: rgba(99, 179, 237, 0.35);
            --info-panel-bg: #242533;
            --info-panel-border: #4a4d6b;
            --status-draft-indicator: #4a5568;
            --status-confirmed-indicator: #38a169;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "BIZ UDPGothic", Meiryo, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            font-size: var(--base-font-size);
            line-height: 1.85;
            transition: background-color 0.2s, color 0.2s;
            padding-bottom: 120px;
        }

        /* Top Bar */
        .top-navbar {
            background-color: var(--header-bg);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            padding: 10px 24px;
        }

        .navbar-inner {
            max-width: 1000px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        }

        .doc-title {
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .doc-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 4px;
            background-color: var(--border-color);
            color: var(--text-color);
            font-weight: 600;
        }

        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 5px 10px;
            font-size: 12px;
            font-weight: 500;
            border-radius: 5px;
            border: 1px solid var(--border-color);
            background-color: var(--card-bg);
            color: var(--text-color);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: all 0.15s ease;
        }
        .btn:hover {
            border-color: var(--text-muted);
        }
        .btn.active {
            background-color: var(--term-color);
            color: #1a1a24;
            font-weight: 700;
            border-color: var(--term-color);
        }

        .search-input {
            padding: 5px 10px;
            font-size: 12px;
            border-radius: 5px;
            border: 1px solid var(--border-color);
            background-color: var(--bg-color);
            color: var(--text-color);
            width: 160px;
            outline: none;
        }
        .search-input:focus {
            border-color: var(--term-color);
            width: 200px;
        }

        /* Document Reader Container */
        .reader-container {
            max-width: 860px;
            margin: 32px auto;
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 48px 56px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
        }

        .doc-header {
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 20px;
            margin-bottom: 32px;
        }

        .doc-main-title {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 8px;
        }

        .doc-meta {
            font-size: 13px;
            color: var(--text-muted);
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }

        /* Paragraphs & Segments */
        .review-paragraph {
            margin-bottom: 24px;
            text-align: justify;
            text-justify: inter-ideograph;
        }

        .seg {
            padding: 2px 2px;
            border-radius: 3px;
            transition: background-color 0.15s ease;
            cursor: pointer;
            position: relative;
        }

        .seg:hover {
            background-color: var(--seg-hover-bg);
        }

        .seg.active-seg {
            background-color: var(--seg-active-bg);
            box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.4);
        }

        /* Highlight unconfirmed segments when option enabled */
        body.highlight-unconfirmed .seg.status-0 {
            border-bottom: 2px dashed #e53e3e;
        }

        /* Term highlights (pure color styling, no tooltip) */
        mark.term-highlight {
            background-color: var(--term-bg);
            color: var(--term-color);
            font-weight: 600;
            padding: 1px 3px;
            border-radius: 3px;
        }

        body.no-term-highlight mark.term-highlight {
            background-color: transparent !important;
            color: inherit !important;
            font-weight: inherit !important;
        }

        .empty-seg {
            color: #e53e3e;
            font-style: italic;
            font-size: 0.9em;
        }

        /* Bottom Floating Source Inspector Panel */
        .inspector-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: var(--info-panel-bg);
            border-top: 1px solid var(--info-panel-border);
            padding: 12px 24px;
            box-shadow: 0 -4px 16px rgba(0,0,0,0.12);
            z-index: 999;
            backdrop-filter: blur(8px);
        }

        .inspector-inner {
            max-width: 860px;
            margin: 0 auto;
            display: flex;
            align-items: flex-start;
            gap: 16px;
        }

        .inspector-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            background-color: var(--border-color);
            white-space: nowrap;
            margin-top: 2px;
        }

        .inspector-content {
            flex: 1;
            font-size: 14px;
            line-height: 1.5;
        }

        .inspector-source {
            font-weight: 500;
            color: var(--text-color);
        }

        .inspector-note {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .inspector-hint {
            color: var(--text-muted);
            font-style: italic;
            font-size: 13px;
        }

        @media print {
            body {
                background-color: #ffffff !important;
                color: #000000 !important;
                font-size: 11pt !important;
                line-height: 1.6 !important;
                padding: 0 !important;
            }
            .top-navbar, .inspector-panel {
                display: none !important;
            }
            .reader-container {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                max-width: 100% !important;
                margin: 0 !important;
            }
            mark.term-highlight {
                background-color: transparent !important;
                color: #000000 !important;
                text-decoration: underline !important;
            }
            .seg {
                cursor: default !important;
            }
        }
    </style>
</head>
<body>
    <div class="top-navbar">
        <div class="navbar-inner">
            <div class="doc-title">
                📖 ${escapeHtml(projectName)}
                <span class="doc-badge">${escapeHtml(targetLang)} モノリンガルQA</span>
            </div>
            <div class="toolbar">
                <input type="text" id="searchInput" class="search-input" placeholder="🔍 テキスト検索...">
                <button id="btnToggleHighlight" class="btn active" title="用語ハイライトのON/OFF">🎨 用語色 ON</button>
                <button id="btnToggleUnconfirmed" class="btn" title="未確定文を下線で強調表示">⏳ 未確定強調</button>
                <button id="btnFontDec" class="btn" title="文字サイズ縮小">A-</button>
                <button id="btnFontInc" class="btn" title="文字サイズ拡大">A+</button>
                <button id="btnToggleTheme" class="btn" title="テーマ切り替え">🌓</button>
                <button id="btnPrint" class="btn" title="印刷またはPDF保存" onclick="window.print()">🖨️ 印刷/PDF</button>
            </div>
        </div>
    </div>

    <div class="reader-container">
        <div class="doc-header">
            <h1 class="doc-main-title">${escapeHtml(projectName)}</h1>
            <div class="doc-meta">
                <span>言語: <strong>${escapeHtml(sourceLang)} &rarr; ${escapeHtml(targetLang)}</strong></span>
                <span>総文数: <strong>${totalUnits}</strong></span>
                <span>段落数: <strong>${paragraphs.length}</strong></span>
                <span>確定率: <strong>${totalUnits > 0 ? Math.round(((confirmedCount + proofedCount) / totalUnits) * 100) : 0}%</strong></span>
                <span>出力日時: ${nowStr}</span>
            </div>
        </div>

        <div id="documentBody">
            ${paragraphsHtml.join('\n')}
        </div>
    </div>

    <!-- Floating Bottom Source Inspector Panel -->
    <div class="inspector-panel">
        <div class="inspector-inner">
            <div id="inspectorBadge" class="inspector-badge">#--</div>
            <div class="inspector-content">
                <div id="inspectorSource" class="inspector-hint">文にマウスを合わせるかクリックすると、対応する原文がここに表示されます（ツールチップでも確認可能）。</div>
                <div id="inspectorNote" class="inspector-note"></div>
            </div>
        </div>
    </div>

    <script>
        const searchInput = document.getElementById('searchInput');
        const btnToggleHighlight = document.getElementById('btnToggleHighlight');
        const btnToggleUnconfirmed = document.getElementById('btnToggleUnconfirmed');
        const btnFontDec = document.getElementById('btnFontDec');
        const btnFontInc = document.getElementById('btnFontInc');
        const btnToggleTheme = document.getElementById('btnToggleTheme');
        const segments = document.querySelectorAll('.seg');

        const inspectorBadge = document.getElementById('inspectorBadge');
        const inspectorSource = document.getElementById('inspectorSource');
        const inspectorNote = document.getElementById('inspectorNote');

        let highlightTerms = true;
        let highlightUnconfirmed = false;
        let baseFontSize = 16;
        let activeSegment = null;

        function showSegmentDetails(seg) {
            const idx = parseInt(seg.getAttribute('data-idx') || '0', 10);
            const src = seg.getAttribute('data-src') || '';
            const note = seg.getAttribute('data-note') || '';
            const status = seg.getAttribute('data-status') || '0';

            const statusText = status === '1' ? '確定' : (status === '2' ? '校正済' : '未確定');

            inspectorBadge.innerText = \`#\${idx + 1} [\${statusText}]\`;
            inspectorSource.innerText = src || '(原文なし)';
            inspectorSource.classList.remove('inspector-hint');
            inspectorNote.innerText = note ? \`Note: \${note}\` : '';
        }

        segments.forEach(seg => {
            seg.addEventListener('mouseenter', () => {
                showSegmentDetails(seg);
            });

            seg.addEventListener('click', () => {
                if (activeSegment) {
                    activeSegment.classList.remove('active-seg');
                }
                activeSegment = seg;
                seg.classList.add('active-seg');
                showSegmentDetails(seg);
            });
        });

        // Search highlight
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            segments.forEach(seg => {
                if (!query) {
                    seg.style.opacity = '1';
                } else {
                    const text = seg.innerText.toLowerCase();
                    const src = (seg.getAttribute('data-src') || '').toLowerCase();
                    if (text.includes(query) || src.includes(query)) {
                        seg.style.opacity = '1';
                    } else {
                        seg.style.opacity = '0.3';
                    }
                }
            });
        });

        btnToggleHighlight.addEventListener('click', () => {
            highlightTerms = !highlightTerms;
            document.body.classList.toggle('no-term-highlight', !highlightTerms);
            btnToggleHighlight.classList.toggle('active', highlightTerms);
            btnToggleHighlight.innerText = highlightTerms ? '🎨 用語色 ON' : '⚪ 用語色 OFF';
        });

        btnToggleUnconfirmed.addEventListener('click', () => {
            highlightUnconfirmed = !highlightUnconfirmed;
            document.body.classList.toggle('highlight-unconfirmed', highlightUnconfirmed);
            btnToggleUnconfirmed.classList.toggle('active', highlightUnconfirmed);
        });

        btnFontInc.addEventListener('click', () => {
            if (baseFontSize < 28) {
                baseFontSize += 2;
                document.documentElement.style.setProperty('--base-font-size', baseFontSize + 'px');
            }
        });

        btnFontDec.addEventListener('click', () => {
            if (baseFontSize > 12) {
                baseFontSize -= 2;
                document.documentElement.style.setProperty('--base-font-size', baseFontSize + 'px');
            }
        });

        btnToggleTheme.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'light';
            const next = cur === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
        });
    </script>
</body>
</html>`;

        fs.writeFileSync(outputPath, htmlContent, 'utf-8');
        return outputPath;
    }
}

