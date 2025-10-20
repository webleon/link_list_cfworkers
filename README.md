# Cloudflare Worker - 动态链接列表管理

一个基于 Cloudflare Worker 实现的**动态链接列表**应用。它通过 KV 存储数据，并支持**查看**和**编辑**两种模式，受密钥保护。

## ✨ 功能特性

* **动态列表：** 从 Cloudflare KV 读取链接数据。
* **双重模式 (`ACCESS_MODE` 环境变量控制)：**
 * `view`：访问 `/` 和 `/edit` 都需要密钥。
 * `edit`：访问 `/` **无需密钥**；访问 `/edit` 需要密钥。
* **编辑界面：** 允许添加、修改、删除链接，并保存至 KV。

## 🚀 部署指南

### 1. 准备 KV 命名空间

在 Cloudflare Dashboard 中创建 **KV 命名空间**（例如命名为 `LINK_LIST_NAMESPACE`），并将其绑定到您的 Worker。

### 2. 部署 Worker

将代码部署到 Cloudflare Worker。**必须**配置以下环境变量：

| 变量名 | 描述 | 示例值 | 备注 |
| :--- | :--- | :--- | :--- |
| `ACCESS_TOKEN` | 访问/编辑保护密钥。 | `my-secret-key-123` | **必需**。 |
| `ACCESS_MODE` | 决定主页 (`/`) 策略。 | `view` 或 `edit` | **推荐值**：`view` 或 `edit`。 |
| `LINK_LIST_NAMESPACE` | KV 命名空间名称。 | `LINK_LIST_NAMESPACE` | 需与步骤 1 的名称一致。 |

### 3. 初始数据

首次运行时，列表为空。您可以通过访问 `/edit` (如果 `ACCESS_MODE='edit'`) 或直接向 KV 写入 `all_links` 键来初始化数据。

## 🛠️ 使用说明

部署成功后，访问您的 Worker 域名：

* **查看列表：** 访问 `your-domain.workers.dev/`。
* **编辑列表：** 访问 `your-domain.workers.dev/edit`。如果未认证或处于 `ACCESS_MODE='view'` 模式，系统会提示您输入密钥。
