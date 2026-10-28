#!/usr/bin/env node
/**
 * 设计系统文档站生成器：内容从基座仓生成（单一事实源），零构建依赖。
 *
 * 数据源（相对工作区根）：
 *   projects/iwan-admin/web/src/styles/globals.css      → 设计 token（色彩/圆角/字号）
 *   projects/iwan-admin/web/src/shared/menu-icons.ts    → 菜单图标注册表
 *   projects/iwan-admin/web/src/components/patterns/*.tsx → patterns 组件清单（ADR-0010/0011：shared/components 已收口为 patterns）
 *   projects/iwan-admin/web/src/components/ui/*.tsx     → 基础组件清单
 *
 * 用法：
 *   node scripts/generate.mjs            # 渲染 docs/index.html
 *   node scripts/generate.mjs --check    # 渲染到临时并与已提交版本 diff（防漂移，退出码非 0 = 漂移）
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const workspaceRoot = resolve(repoRoot, '../..');
const baseWeb = resolve(workspaceRoot, 'projects/iwan-admin/web');
const outPath = resolve(repoRoot, 'docs/index.html');

const check = process.argv.includes('--check');

// ---------- token 解析 ----------
function parseTokens() {
  const css = readFileSync(join(baseWeb, 'src/styles/globals.css'), 'utf8');
  const rootBlock = css.match(/:root \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const themeBlock = css.match(/@theme \{([\s\S]*?)\n\}/)?.[1] ?? '';

  const colors = [];
  for (const match of rootBlock.matchAll(/^  --([a-z-]+):\s*(#[0-9a-fA-F]{6});/gm)) {
    colors.push({ name: match[1], value: match[2] });
  }
  const radius = [];
  for (const match of themeBlock.matchAll(/^  --radius-([a-z]+):\s*(\d+px);/gm)) {
    radius.push({ name: match[1], value: match[2] });
  }
  const typeScale = [];
  for (const match of themeBlock.matchAll(/^  --text-([a-z0-9]+):\s*(\d+px);/gm)) {
    typeScale.push({ name: match[1], value: match[2] });
  }
  return { colors, radius, typeScale };
}

// ---------- 组件清单 ----------
/** 源码链接分支：v1.0.0 合入 main 后改回 'main' */
const SOURCE_BRANCH = 'refactor/v1.0.0';

function listComponents(relDir) {
  const absDir = resolve(baseWeb, relDir);
  if (!existsSync(absDir)) {
    return [];
  }
  return readdirSync(absDir)
    .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
    .sort()
    .map((file) => {
      const name = file.replace('.tsx', '');
      const source = readFileSync(join(absDir, file), 'utf8');
      const exportMatch = source.match(/export function ([A-Z]\w*)/);
      const docMatch = source.match(/\/\*\*\n \* ([^\n]*)/);
      return {
        name: exportMatch?.[1] ?? name,
        file,
        desc: docMatch?.[1]?.trim() ?? '',
        url: githubUrl(`${relDir}/${file}`),
      };
    });
}

function githubUrl(relativePath) {
  return `https://github.com/iwantools/iwan-admin/blob/${SOURCE_BRANCH}/${relativePath}`;
}

// ---------- 渲染 ----------
function render({ colors, radius, typeScale }, patterns, primitives) {
  const swatches = colors
    .map(
      (token) => `<div class="swatch"><span class="chip" style="background:${token.value}"></span>
        <span class="tname">${token.name}</span><span class="tvalue">${token.value}</span></div>`,
    )
    .join('\n');
  const radiusCards = radius
    .map(
      (token) =>
        `<div class="swatch"><span class="chip radius-demo" style="border-radius:${token.value}"></span>
        <span class="tname">radius-${token.name}</span><span class="tvalue">${token.value}</span></div>`,
    )
    .join('\n');
  const typeRows = typeScale
    .map(
      (token) =>
        `<div class="type-row"><span class="type-demo" style="font-size:${token.value}">${token.value}</span>
        <span class="tname">text-${token.name}</span></div>`,
    )
    .join('\n');
  const componentCard = (item) =>
    `<div class="comp"><div class="comp-head"><span class="comp-name">${item.name}</span>
      <a class="comp-link" href="${item.url}">源码 ↗</a></div>
      <p class="comp-desc">${item.desc || '—'}</p></div>`;
  const patternsHtml = patterns.map(componentCard).join('\n');
  const primitivesHtml = primitives.map(componentCard).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>iwan-admin 设计系统</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
         background: #f6f7f9; color: #161a20; }
  header { background: #fff; border-bottom: 1px solid #e3e6eb; padding: 28px 40px; }
  header h1 { margin: 0 0 4px; font-size: 22px; }
  header p { margin: 0; color: #6b7280; font-size: 13px; }
  main { padding: 32px 40px; max-width: 1200px; margin: 0 auto; }
  section { margin-bottom: 40px; }
  h2 { font-size: 16px; border-left: 3px solid #155eef; padding-left: 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .swatch { background: #fff; border: 1px solid #e3e6eb; border-radius: 6px; padding: 10px 12px;
            display: flex; align-items: center; gap: 10px; }
  .chip { width: 32px; height: 32px; border-radius: 4px; border: 1px solid #e3e6eb; display: inline-block; flex-shrink: 0; }
  .radius-demo { background: #eff4ff; border-color: #155eef; }
  .tname { font-size: 12px; font-weight: 500; }
  .tvalue { font-size: 11px; color: #6b7280; margin-left: auto; }
  .type-row { display: flex; align-items: baseline; gap: 16px; background: #fff;
              border: 1px solid #e3e6eb; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; }
  .type-demo { font-weight: 500; min-width: 70px; }
  .comp { background: #fff; border: 1px solid #e3e6eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
  .comp-head { display: flex; align-items: center; justify-content: space-between; }
  .comp-name { font-weight: 600; font-size: 14px; }
  .comp-link { font-size: 12px; color: #155eef; text-decoration: none; }
  .comp-desc { margin: 6px 0 0; font-size: 12px; color: #6b7280; }
  footer { text-align: center; color: #9ca3af; font-size: 11px; padding: 24px; }
</style>
</head>
<body>
<header>
  <h1>iwan-admin 设计系统</h1>
  <p>内容自基座仓生成（单一事实源）：token 取自 globals.css，组件清单扫描自源码目录 · 由 scripts/generate.mjs 渲染</p>
</header>
<main>
  <section>
    <h2>色彩 Token（${colors.length}）</h2>
    <div class="grid">${swatches}</div>
  </section>
  <section>
    <h2>圆角 Token（${radius.length}）</h2>
    <div class="grid">${radiusCards}</div>
  </section>
  <section>
    <h2>字号刻度（${typeScale.length}）</h2>
    ${typeRows}
  </section>
  <section>
    <h2>Patterns 组件（${patterns.length}）</h2>
    ${patternsHtml}
  </section>
  <section>
    <h2>基础组件（${primitives.length}）</h2>
    ${primitivesHtml}
  </section>
</main>
<footer>由 scripts/generate.mjs 自基座生成 · 勿直接编辑 · 漂移检查：node scripts/generate.mjs --check</footer>
</body>
</html>`;
}

// ---------- 主流程 ----------
const tokens = parseTokens();
const sharedDir = join(baseWeb, 'src/components/patterns');
const uiDir = join(baseWeb, 'src/components/ui');
const patterns = listComponents('src/components/patterns');
const primitives = listComponents('src/components/ui');
const html = render(tokens, patterns, primitives);

if (check) {
  if (!existsSync(outPath)) {
    console.error('docs/index.html 不存在，先运行 generate.mjs 生成');
    process.exit(1);
  }
  const tmp = mkdtempSync(join(tmpdir(), 'docs-check-'));
  const tmpOut = join(tmp, 'index.html');
  writeFileSync(tmpOut, html);
  const diff = execFileSync('git', ['diff', '--no-index', '--stat', outPath, tmpOut], {
    encoding: 'utf8',
  }).trim();
  if (diff) {
    console.error('检测到文档漂移：内容与基座不一致，请重新运行 generate.mjs 并提交');
    process.exit(1);
  }
  console.log('[OK] docs/index.html 与基座内容一致');
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`rendered ${outPath}（colors ${tokens.colors.length} / radius ${tokens.radius.length} / type ${tokens.typeScale.length} / patterns ${patterns.length} / primitives ${primitives.length}）`);
}
