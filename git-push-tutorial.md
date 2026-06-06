# Git → GitHub 推送教程

*基于 leorn 环境 (CentOS Stream 9)*

---

## 目录

- [1. 前置准备](#1-前置准备)
- [2. 每日工作流](#2-每日工作流)
- [3. 常见操作](#3-常见操作)
- [4. 分支管理](#4-分支管理)
- [5. 故障排查](#5-故障排查)
- [6. 速查卡片](#6-速查卡片)

---

## 1. 前置准备

### 1.1 SSH Key

机器上已有 SSH key（`oc_user01` 生成），已添加到 GitHub 账户。

```bash
# Key 位置
~/.ssh/id_ed25519          # 私钥（不要外传）
~/.ssh/id_ed25519.pub      # 公钥（已添加到 GitHub）
```

如果在新机器上需要生成：

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
# 复制输出，去 GitHub → Settings → SSH and GPG keys → New SSH key
```

### 1.2 Git 配置

```bash
# 首次使用时设置
git config --global user.name "your_name"
git config --global user.email "your_email@example.com"

# 查看当前配置
git config --list
```

### 1.3 克隆仓库（首次）

```bash
git clone git@github.com:leorn596/AI-works.git
cd AI-works
```

---

## 2. 每日工作流

### 2.1 标准流程（三步走）

```bash
# 1. 检查状态
cd ~/.openclaw/workspace/robot01
git status

# 2. 暂存 + 提交
git add <文件路径>   # 或 git add . 暂存所有改动
git commit -m "类型: 简短描述"

# 3. 推送
git push origin main
```

### 2.2 完整示例

```bash
# 修改了 MEMORY.md 和 SKILL.md
git status
# 输出:
#   修改: MEMORY.md
#   修改: skills/image-generator/SKILL.md

# 暂存
git add MEMORY.md skills/image-generator/SKILL.md

# 提交
git commit -m "feat: 添加模型选择规则, 更新推断逻辑

- 新增模型选择: 含文字用 nano-banana-pro, 纯图用 gpt-image-2
- 更新 size 推断表, 增加架构图场景"

# 推送
git push origin main
```

---

## 3. 常见操作

### 3.1 查看变更

```bash
# 查看未暂存的改动（逐行对比）
git diff

# 查看已暂存的改动
git diff --cached

# 查看提交历史
git log --oneline -5           # 最近 5 条
git log --oneline --graph      # 分支图
```

### 3.2 撤销

```bash
# 撤销工作区未暂存的修改
git restore <文件>

# 从暂存区移出（保留工作区修改）
git restore --staged <文件>

# 修改最后一次提交（还没 push）
git commit --amend -m "修正后的提交信息"

# 回退到上一个提交（谨慎，不要用在已推送的分支）
git reset --soft HEAD~1        # 撤销 commit，保留工作区
git reset --hard HEAD~1        # 彻底丢弃（不可恢复）
```

### 3.3 拉取远程更新

```bash
git pull origin main

# 等价于:
# git fetch origin main
# git merge origin/main
```

---

## 4. 分支管理

### 4.1 创建并推送新分支

```bash
# 创建分支并切换
git checkout -b feat/xxx-name

# 在新分支上工作、提交
git add .
git commit -m "feat: xxx"

# 推送新分支到 GitHub
git push origin feat/xxx-name
# GitHub 会自动创建远程分支，并返回 PR 链接
```

### 4.2 合并到 main

```bash
# 切回 main 并更新
git checkout main
git pull origin main

# 合并 feature 分支
git merge feat/xxx-name

# 推送到 GitHub
git push origin main

# 可选：删除远程 feature 分支
git push origin --delete feat/xxx-name

# 可选：删除本地 feature 分支
git branch -d feat/xxx-name
```

### 4.3 工作流程图

```
main ──A──B──C─────────● (合并)
                       ↑
feat/xxx ────D──E──F───┘
               ↑
        提交 + 推送
```

---

## 5. 故障排查

### 5.1 SSH 认证失败

```bash
# Permission denied (publickey)

# 检查 SSH agent
eval $(ssh-agent)
ssh-add ~/.ssh/id_ed25519    # 输入密码（如果有）

# 测试连接
ssh -T git@github.com
# 成功: "Hi leorn596! You've successfully authenticated..."
```

### 5.2 提示"no remote"

```bash
git remote -v
# 如果没有输出，添加远程仓库:
git remote add origin git@github.com:leorn596/AI-works.git
```

### 5.3 推送被拒绝（non-fast-forward）

```bash
# 远程有本地没有的提交
git pull origin main --rebase
# 或
git pull origin main
# 解决冲突后再次推送
```

### 5.4 输入了错误的提交信息

```bash
# 还没推送
git commit --amend -m "正确的信息"

# 已经推送了（谨慎）
git commit --amend -m "正确的信息"
git push origin main --force-with-lease   # 比 --force 安全
```

### 5.5 提交了不该提交的文件

```bash
# 从 Git 追踪中移除（保留本地文件）
git rm --cached <文件>
echo "<文件>" >> .gitignore
git add .gitignore
git commit -m "chore: 移除 xxx 追踪"
```

---

## 6. 速查卡片

```bash
# ┌────────────────────────────────────────────┐
# │  操作                     命令              │
# ├────────────────────────────────────────────┤
# │  查看状态                 git status        │
# │  查看差异                 git diff          │
# │  查看历史                 git log --oneline  │
# │  暂存文件                 git add <文件>      │
# │  暂存全部                 git add .          │
# │  提交                    git commit -m "..." │
# │  推送                    git push origin main│
# │  拉取                    git pull origin main│
# │  创建分支                 git checkout -b <名>│
# │  切换分支                 git checkout <分支> │
# │  合并分支                 git merge <分支>    │
# │  删本地分支               git branch -d <分支>│
# │  删远程分支               git push origin -d  │
# └────────────────────────────────────────────┘
```

### 常用提交前缀

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: 添加 image-generator skill` |
| `fix:` | 修 bug | `fix: api.sh 环境变量检查报错` |
| `refactor:` | 重构 | `refactor: 抽取公共 api.sh 层` |
| `docs:` | 文档 | `docs: 更新模型选择说明` |
| `chore:` | 杂项 | `chore: 初始化 MEMORY.md` |
| `perf:` | 性能 | — |

### 一句话推送到 GitHub

```bash
# 日常三步
git status
git add -A && git commit -m "feat: xxx"
git push origin main
```
