# iwan-admin-docs

基座（[iwantools/iwan-admin](https://github.com/iwantools/iwan-admin)）设计系统文档站。
内容**从基座仓生成**（单一事实源），零构建依赖的静态单页。

## 数据源

| 内容 | 来源（基座仓） |
|---|---|
| 色彩 / 圆角 / 字号 Token | `web/src/styles/globals.css` |
| Patterns 组件清单 | `web/src/shared/components/*.tsx` |
| 基础组件清单 | `web/src/components/ui/*.tsx` |
| 组件源码链接 | github.com/iwantools/iwan-admin（main 分支） |

## 使用

```bash
# 生成/更新 docs/index.html（需工作区内存在 projects/iwan-admin 克隆）
node scripts/generate.mjs

# 漂移检查（CI / check-workspace 可挂载）：基座内容变了而文档未重生成即失败
node scripts/generate.mjs --check
```

本地查看：浏览器直接打开 `docs/index.html`。

## 规则

- `docs/index.html` 为生成物，勿手改；界面改动后重新生成并随基座改动一并提交
- 文档只读呈现 token 与组件清单，交互示例后续按需扩展
