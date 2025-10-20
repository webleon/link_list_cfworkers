# 🔗 Cloudflare Worker 链接列表管理

这是一个轻量级的 Cloudflare Worker 应用程序，用于通过 KV Namespace 存储和展示一个可自定义的链接列表。它支持**只读**模式和**受保护的编辑**模式。

## ⚙️ 部署与配置

### 1. KV Namespace

您需要创建一个 KV Namespace 并将其绑定到 Worker。代码中使用的绑定名称为：`LINK_LIST_NAMESPACE`。

### 2. 环境变量 (Environment Variables)

您的 Worker 需要以下环境变量来运行：

| 变量名 | 描述 | 示例值 | 必需性 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| **`EDIT_TOKEN`** | **编辑模式**所需的密钥。用于验证进入 `/edit` 页面和保存更改的权限。 | `my-secret-edit-key-123` | **必需** | N/A |
| **`VIEW_TOKEN`** | **查看模式**所需的密钥（可选）。如果设置，用户需要输入此密钥或携带正确的 Cookie 才能看到链接列表。 | `my-secret-view-key-456` | 可选 | 无 |
| **`EDIT_COOKIE_AGE`** | **编辑会话 Cookie** 的有效期（**小时**）。 | `168` | 可选 | **24 小时** |
| **`VIEW_COOKIE_AGE`** | **查看会话 Cookie** 的有效期（**小时**）。 | `24` | 可选 | **24 小时** |

### 3. 初始数据

链接数据存储在 KV 中的 `all_links` 键下，格式为 JSON 数组。您需要在部署后通过 `/edit` 路径初始化或更新此数据。

## 🗺️ 路由和操作

| 路由 | 方法 | 描述 | 访问要求 |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | 显示链接列表。 | 如果设置了 `VIEW_TOKEN`，则需要验证。 |
| `/edit` | `GET` | 显示输入编辑密钥的页面。 | 无，进入验证流程。 |
| `/edit` | `POST` | 提交编辑密钥进行验证。 | 密钥匹配 `EDIT_TOKEN`。成功后将设置会话 Cookie 并进入编辑界面。 |
| `/save` | `POST` | 提交编辑后的链接数据。 | 必须通过编辑权限验证。 |

---
**注意：** Worker 使用 **HttpOnly Cookie** 来保持编辑和查看会话的有效性。
