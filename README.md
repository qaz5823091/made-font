# made-font

React + Vite + TypeScript + Tailwind CSS + shadcn/ui，搭配 Dev Container 開發環境。

## 開發環境（Dev Container）

需求：[Docker](https://www.docker.com/)、[VS Code](https://code.visualstudio.com/) + Dev Containers 擴充套件。

1. 用 VS Code 開啟此資料夾
2. 跳出提示時點 **Reopen in Container**（或執行命令面板 `Dev Containers: Reopen in Container`）
3. 容器啟動後會自動執行 `npm install` 並啟動 Vite Dev Server (port 5173)

## 本機指令

```bash
npm install        # 安裝依賴
npm run dev        # 啟動 dev server (http://localhost:5173)
npm run build      # 編譯型別 + 打包
npm run preview    # 預覽打包結果
```

## 加入新的 shadcn/ui 元件

```bash
npx shadcn@latest add <component>
# 例：npx shadcn@latest add card dialog input
```

## 目錄結構

```
src/
├── components/ui/    # shadcn/ui 元件
├── lib/utils.ts      # cn() helper
├── App.tsx
├── main.tsx
└── index.css         # Tailwind + shadcn CSS 變數
```
