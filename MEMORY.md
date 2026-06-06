# MEMORY.md — robot01 长期记忆

*始于 2026-06-05*

---

## 🧬 Identity

- **Agent ID:** `robot01`
- **模型:** deepseek/deepseek-v4-flash
- **参数偏好:** topP=0.2, temperature=0.2, frequencyPenalty=0.5
- **性格:** 直接、务实、乐于动手。不喜欢废话,有问题先查再问。
- **Workspace:** `/root/.openclaw/workspace/robot01`
- **代码仓库:** `git@github.com:leorn596/AI-works.git`

---

## 👤 用户

- **时区:** Asia/Shanghai (UTC+8)
- **语言:** 中文 (简体)
- **操作系统:** CentOS Stream 9 / Linux 5.14.0-611.x
- **工作用户:** `oc_user01` (UID 1001) — 日常操作以此为身份
- **Root 规则:** 普通命令 → `su - oc_user01 -c "..."`；需要提权时直接执行
- **机器名:** leorn (4核, ~1.6G 内存)

---

## 🔧 系统配置

### 网关 (Gateway)
- **端口:** 18789 (loopback-only)
- **认证:** token 模式 (`token_for_openclaw`)
- **服务:** systemd user service
- **日志:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

### 记忆系统
- **Backend:** builtin (避免缺失 openai embedding key 导致 memory_search 不可用)
- **File:** `MEMORY.md` + `memory/YYYY-MM-DD.md`

### 已启用 plugins
- `deepseek` ✅ — 模型提供商
- `ollama` ✅ — 本地模型
- `workboard` ✅ — 工作板
- 其他 bundled 插件大多为默认启用的 provider,不一一列举

### 已知问题
- chronyd 配置曾修复: `driftflie` → `driftfile`
- memory_search 需要 embedding key (openai),目前用 builtin 后端绕过了缺失问题

---

## 📅 重要事件

### 2026-06-05 — 首日上线

#### Bootstrap
- 全新 OpenClaw workspace bootstrap
- 创建系统用户 `oc_user01` (UID 1001),密码存入 `User` 文件
- oc_user01 的工作区镜像: `/home/oc_user01/workspace/`

#### Git
- 绑定仓库 `leorn596/AI-works` (SSH + GitHub 公钥)
- 首版推送: 9 files, 446 insertions

#### 错误修复
1. **chronyd** — 配置文件 `/etc/chrony.conf` 第 57 行 `driftflie` 拼写错误,已修复
2. **memory_search** — openai embedding key 缺失,后端改为 builtin,已生效
3. **dnf 滞留锁** — 检查后无残留,系统干净

#### 系统状态
- **遗留:** 系统近 1 小时内发生过 RCU stall (CPU 饥饿)和 hung task,可能与 dnf 卡死有关
- **NTP:** chronyd 已恢复运行
- **firewalld:** Docker 策略冲突警告存在,但未修复

---

## 🌐 OpenStack 环境 (虚拟机集群)

| 角色 | 主机名 | IP | SSH 账户 | 密码 |
|------|--------|-----|---------|------|
| Controller | controller | 192.168.100.10 | root | root |
| Compute | computer1 | 192.168.100.20 | root | root |
| Block Storage | block1 | 192.168.100.30 | root | root |

**SSH 方式:** `sshpass -p 'root' ssh root@<IP>`

**admin-openrc 路径:** `/root/admin-openrc` (controller)

**Neutron 关键命令:** `source /root/admin-openrc && openstack network agent list`

### 已知配置
- **Provider 接口 (compute):** ens34 (IP 192.168.200.20/24, provider 网络)
- **Management 接口 (compute):** ens33 (IP 192.168.100.20/24)
- **RabbitMQ:** controller:5672, 用户 `openstack`, 密码 `rb123`
- **NTP:** compute 节点仅向 controller 同步,controller 用 `local stratum 10` 兜底

---

## 🧠 Lessons

1. **记忆文件要主动写。** AGENTS.md 强调 "Text > Brain" — 重要的决定、教训、上下文要写进文件,不然下次 session 就丢了。
2. **改系统配置前先看现状。** AGENTS.md 的 Red Lines: inspect before changing.
3. **用户偏好中文交流。** 回复用简洁中文化,避免浮夸的开场白。
