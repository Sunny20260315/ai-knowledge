以下是详细的 Git 规范，涵盖提交信息、分支管理、代码风格等方面：

### 1. 提交信息规范（Conventional Commits）

- **格式**：`<类型>(<范围>): <描述>`
- **类型**：
  - `feat`：新增功能
  - `fix`：修复bug
  - `docs`：文档更新
  - `style`：代码风格调整（不影响功能）
  - `refactor`：代码重构（不新增功能或修复bug）
  - `test`：测试相关
  - `chore`：构建、依赖等配置修改
- **范围**：可选，指定影响的模块（如 `feat(auth): add login feature`）
- **描述**：简洁明了，不超过50字符
- **示例**：
  - `feat(user): add login functionality`
  - `fix(api): resolve CORS issue`
  - `docs(readme): update installation guide`

### 2. 分支管理规范

- **主分支**：
  - `main`：生产环境分支，保持稳定
  - `develop`：开发分支，集成所有功能
- **功能分支**：
  - 格式：`feature/<功能名>`（如 `feature/login`）
- **修复分支**：
  - 格式：`bugfix/<bug描述>`（如 `bugfix/cors-error`）
- **热修复分支**：
  - 格式：`hotfix/<问题描述>`（如 `hotfix/security-patch`）

### 3. 代码风格规范

- **前端**：
  - 使用 ESLint 检查代码风格
  - 遵循 Prettier 代码格式化规则
  - 统一缩进（2空格或4空格）
  - 统一引号（单引号或双引号）
- **后端**：
  - 使用 ESLint 检查 TypeScript 代码
  - 遵循项目指定的代码风格
  - 保持代码结构清晰

### 4. 提交前检查规范

- **Lint 检查**：提交前运行 `eslint` 检查代码风格
- **测试检查**：提交前运行测试用例，确保功能正常
- **类型检查**：对于 TypeScript 项目，运行 `tsc --noEmit` 检查类型
- **构建检查**：确保代码可以正常构建

### 5. 其他最佳实践

- **提交频率**：频繁提交，每次提交只包含一个逻辑变更
- **提交信息清晰**：避免使用模糊的提交信息（如 "fix bug"）
- **避免提交敏感信息**：如 API 密钥、密码等
- **使用 .gitignore**：忽略不必要的文件（如 node\_modules、构建产物）
- **代码审查**：通过 Pull Request 进行代码审查

### 6. Git Husky 配置示例

- **安装依赖**：
  ```bash
  pnpm add -D husky @commitlint/cli @commitlint/config-conventional
  ```
- **初始化 Husky**：
  ```bash
  npx husky init
  ```
- **配置 pre-commit 钩子**（`.husky/pre-commit`）：
  ```bash
  #!/usr/bin/env sh
  . "$(dirname -- "$0")/_/husky.sh"

  # 前端检查
  cd frontend && pnpm lint && pnpm test

  # 后端检查
  cd ../backend && pnpm lint && pnpm test
  ```
- **配置 commit-msg 钩子**（`.husky/commit-msg`）：
  ```bash
  #!/usr/bin/env sh
  . "$(dirname -- "$0")/_/husky.sh"

  npx --no-install commitlint --edit "$1"
  ```
- **配置 commitlint**（`commitlint.config.js`）：
  ```javascript
  module.exports = {
    extends: ['@commitlint/config-conventional'],
  };
  ```

### 7. 代码提交流程

1. **创建分支**：从 `develop` 分支创建功能分支
2. **开发代码**：实现功能或修复bug
3. **运行检查**：本地运行 lint 和测试
4. **提交代码**：使用规范的提交信息
5. **推送分支**：推送到远程仓库
6. **创建 PR**：提交 Pull Request 进行代码审查
7. **合并分支**：审查通过后合并到 `develop` 分支
8. **发布版本**：从 `develop` 分支合并到 `main` 分支并发布

通过遵循这些规范，可以确保代码库的整洁性、可维护性，同时提高团队协作效率。
