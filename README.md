# 📄 Cloudflare Workers 精选链接列表 (Link List Manager)

这是一个部署在 Cloudflare Workers 上的轻量级、无服务器（Serverless）的精选链接列表管理系统。它允许用户通过一个受保护的编辑界面来添加、修改和删除链接，并在主页上以简洁的列表形式展示这些链接。

## ✨ 主要功能

1. **动态链接展示**: 在主页（`/`）以列表形式展示配置好的链接。
2. **受保护的编辑模式**: 只有输入正确的**编辑密钥**（`SECRET_TOKEN`）才能进入编辑界面。
3. **客户端动态编辑**: 编辑界面使用 JavaScript 动态管理链接列表，支持增、删、改操作。
4. **可选的查看保护**: 如果设置了 `VIEW_TOKEN` 环境变量，主页访问将需要输入**查看密钥**才能显示列表。
5. **KV 存储**: 所有链接数据持久化存储在 Cloudflare **KV 命名空间**中。
6. **简洁的列表**: 非编辑模式下，只显示链接名称，不显示 URL，界面更清爽。

## 🚀 部署步骤 (通过 Cloudflare Dashboard)

部署此项目需要您拥有一个 Cloudflare 账户，并熟悉 Workers 和 KV 的配置。

### 步骤 1: 创建 KV 命名空间

1. 登录 Cloudflare Dashboard。
2. 导航至 **Workers & Pages** -> **KV** -> **Create a namespace**。
3. 命名您的命名空间，例如：`LINK_LIST_NAMESPACE`。
4. **记下该命名空间的 ID**（非常重要）。

### 步骤 2: 创建并配置 Worker

1. 在 **Workers & Pages** 中创建一个新的 Worker (或使用现有 Worker)。
2. 将 Worker 代码粘贴到代码编辑器中。
3. 进入 Worker 的 **Settings** 标签页，配置以下**环境变量 (Variables)** 和**绑定 (Binding)**：

| 类型 | 名称 (Name) | 值 (Value) / 绑定目标 | 描述 |
| :--- | :--- | :--- | :--- |
| **Variable** | `EDIT_TOKEN` | **您自己设定的编辑密钥** (例如: `my-super-secret-key-123`) | 进入编辑模式和保存更改时所需的**主密钥**。**请务必设置一个强密码！** |
| **Variable** | `VIEW_TOKEN` | **可选：您自己设定的查看密钥** (例如: `view-only-key-456`) | 如果设置，访问主页时将需要输入此密钥才能看到链接列表。如果**不设置**，列表将**公开**显示。 |
| **Binding** | `LINK_LIST_NAMESPACE` | **您在步骤 1 中创建的 KV 命名空间** | 用于数据持久化的 KV 绑定。**名称必须与代码中的常量保持一致**。 |

4. 点击 **Save and Deploy** 保存并部署 Worker。

### 步骤 3: 首次使用

1. 访问您的 Worker 域名（例如 `https://your-worker-name.your-account.workers.dev/`）。
2. **如果未设置 `VIEW_TOKEN`**：您将直接看到链接列表。
3. **如果设置了 `VIEW_TOKEN`**：您将首先看到要求输入**查看密钥**的页面。
4. 点击主页上的“**进入编辑模式**”按钮（或直接访问 `/edit`）。
5. 在弹出的页面中输入您在 `EDIT_TOKEN` 中设置的**编辑密钥**进行验证。
6. 进入编辑界面后，您可以添加、修改或删除链接，然后点击“**保存所有更改**”。保存成功后系统会自动返回主页。
