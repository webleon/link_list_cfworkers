// =========================================================================
// 常量声明
// =========================================================================
const KV_NAMESPACE_BINDING_NAME = "LINK_LIST_NAMESPACE";
const EDIT_ROUTE_PATH = "/enter-edit"; 
// =========================================================================
// 辅助函数：从 KV 读取所有链接 (保持不变)
// =========================================================================
async function getLinks(env) {
    // 优化：直接尝试列出所有 keys，如果失败则返回空数组，避免不必要的 Promise.all 嵌套
    try {
        const { keys } = await env[KV_NAMESPACE_BINDING_NAME].list(); 
        
        // 过滤掉可能存在的 "all_links" 以外的键，并只获取 "all_links" 的内容
        const linkKey = keys.find(k => k.name === "all_links");
        if (!linkKey) return [];

        const value = await env[KV_NAMESPACE_BINDING_NAME].get(linkKey.name);
        
        if (value) {
            try {
                const linkData = JSON.parse(value);
                if (Array.isArray(linkData)) {
                    // 优化：使用 map 和 index 来生成 ID，更简洁
                    return linkData.map((link, index) => ({ id: index + 1, ...link }));
                }
                return [];
            } catch (e) {
                console.error(`Error parsing KV value for key all_links:`, e);
                return [];
            }
        }
        return [];
    } catch (e) {
        console.error("Error listing KV keys:", e);
        return [];
    }
}

// =========================================================================
// HTML 渲染函数 (重大更新：主页列表显示优化 & 编辑器样式现代化)
// =========================================================================
function renderHtml(links, isEditMode, error = null, success = null, currentUrl, env) {
    
    const secretToken = env.SECRET_TOKEN; 
    const editModeKey = env.EDIT_MODE_KEY;

    // 成功后客户端重定向脚本
    let redirectScript = '';
    if (success) {
        redirectScript = `<script>
            console.log('${success}');
            // 优化：重定向到根路径，不再停留在成功页面
            setTimeout(() => {
                window.location.href = '/'; 
            }, 1500); 
        </script>`;
    }

    let contentHtml = '';

    if (!isEditMode) {
        // --- 非编辑模式 (显示列表) - **现代化样式优化 & URL 移除** ---
        
        // 使用更现代的卡片/列表样式代替表格
        const listItems = links.map(link => `
            <li class="link-item">
                <a href="${link.url}" target="_blank" title="点击跳转到: ${link.url}" class="link-title">
                    ${link.name || '无名称链接'}
                </a>
            </li>
        `).join('');

        // **关键修改：仅在 success 有值时才渲染成功消息的 <p> 标签**
        const successMessageHtml = success ? `<p class="status-message success">${success}</p>` : '';

        contentHtml = `
            <h2>精选链接</h2>
            ${successMessageHtml} 
            ${links.length === 0 ? '<p>当前没有已配置的链接。</p>' : `
                <ul class="link-list">
                    ${listItems}
                </ul>
            `}
            <p class="edit-prompt">
                <form method="GET" action="${EDIT_ROUTE_PATH}">
                    <button type="submit" class="btn-primary">进入编辑模式</button>
                </form>
            </p>
        `;
    } else {
        // --- 编辑模式 (JS 驱动的表单) - **现代化 JS 结构** ---
        
        // 1. 准备初始数据 (JSON 字符串，供 JS 读取)
        const initialLinksJson = JSON.stringify(links);

        // 2. 渲染表单结构
        contentHtml = `
            <h2>编辑链接列表</h2>
            <p class="status-message info">使用下方的表单编辑链接，点击“保存所有更改”按钮。</p>
            
            <div id="link-editor">
                <!-- 链接行将由 JavaScript 动态插入到这里 -->
            </div>

            <p class="editor-controls">
                <button id="add-link-btn" class="btn-secondary">增加新链接</button>
                <button id="save-links-btn" class="btn-primary">保存所有更改</button>
                <button onclick="window.location.href='/'" class="btn-secondary">取消并返回</button>
            </p>
            
            <div id="status-message"></div>

            <!-- 隐藏的用于提交数据的表单 -->
            <form id="data-form" method="POST" action="/save" style="display:none;">
                <input type="hidden" name="${editModeKey}" value="${secretToken}"> 
                <textarea id="data-payload" name="data"></textarea>
                <button type="submit" id="submit-form-btn">Submit</button>
            </form>
        `;
        
        // 3. 嵌入 JavaScript 逻辑 (使用更现代的 JS 风格)
        const jsLogic = `
        <script>
            const linksData = ${initialLinksJson} || [];
            const editorDiv = document.getElementById('link-editor');
            const addButton = document.getElementById('add-link-btn');
            const saveButton = document.getElementById('save-links-btn');
            const statusDiv = document.getElementById('status-message');
            const dataForm = document.getElementById('data-form');
            const payloadTextarea = document.getElementById('data-payload');
            let nextId = linksData.length > 0 ? Math.max(...linksData.map(l => l.id)) + 1 : 1;

            // --- 核心渲染函数 ---
            function renderLinks() {
                editorDiv.innerHTML = '';
                if (linksData.length === 0) {
                    editorDiv.innerHTML = '<p>当前列表为空。请点击“增加新链接”添加。</p>';
                    return;
                }
                
                const table = document.createElement('table');
                table.className = 'editor-table';
                table.innerHTML = '<thead><tr><th>名称 (Name)</th><th>URL (链接)</th><th>操作</th></tr></thead><tbody></tbody>';
                const tbody = table.querySelector('tbody');

                linksData.forEach(link => {
                    const row = tbody.insertRow();
                    
                    // 1. 名称输入框
                    const nameCell = row.insertCell();
                    nameCell.innerHTML = \`<input type="text" name="name_\${link.id}" value="\${link.name}" placeholder="链接名称"> \`;
                    
                    // 2. URL 输入框
                    const urlCell = row.insertCell();
                    urlCell.innerHTML = \`<input type="url" name="url_\${link.id}" value="\${link.url}" placeholder="https://example.com"> \`;
                    
                    // 3. 操作单元格 (删除按钮)
                    const actionCell = row.insertCell();
                    actionCell.style.textAlign = 'center';
                    actionCell.innerHTML = \`<button type="button" onclick="deleteLink(\${link.id})" class="btn-danger">删除</button>\`;
                });
                
                editorDiv.appendChild(table);
            }

            // --- 动态添加新行 ---
            addButton.onclick = () => {
                const newLink = { id: nextId++, name: '', url: '' };
                linksData.push(newLink);
                renderLinks();
            };

            // --- 删除链接 ---
            window.deleteLink = (id) => {
                const index = linksData.findIndex(l => l.id === id);
                if (index !== -1) {
                    linksData.splice(index, 1);
                    renderLinks();
                }
            };

            // --- 保存所有更改 ---
            saveButton.onclick = () => {
                statusDiv.textContent = '正在保存...';
                statusDiv.className = 'status-message saving';
                
                // 1. 从 DOM 中收集最新的数据
                const updatedLinks = [];
                const inputs = editorDiv.querySelectorAll('input');
                
                // 收集所有输入框的数据
                const tempMap = {};
                inputs.forEach(input => {
                    tempMap[input.name] = input.value;
                });

                // 2. 重构数据结构 (基于 ID)
                linksData.forEach(link => {
                    const name = tempMap[\`name_\${link.id}\`] || link.name;
                    const url = tempMap[\`url_\${link.id}\`] || link.url;
                    
                    // 仅保留有效的链接 (名称或URL不为空)
                    if (name.trim() !== "" || url.trim() !== "") {
                        updatedLinks.push({
                            name: name.trim(),
                            url: url.trim()
                        });
                    }
                });

                // 3. 准备提交
                payloadTextarea.value = JSON.stringify(updatedLinks);
                // 触发隐藏表单提交
                document.getElementById('submit-form-btn').click(); 
            };
            
            // 初始渲染
            renderLinks();
        </script>
        `;
        
        contentHtml += jsLogic;
    }


    const messageHtml = error ? `<p class="status-message error">错误: ${error}</p>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>链接列表管理</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* --- 现代化基础样式 (list.js 风格的替代) --- */
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; 
            margin: 0; padding: 20px; background-color: #f8f9fa; color: #333; 
        }
        .container { max-width: 900px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        h2 { color: #007bff; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
        
        /* --- 非编辑模式样式 --- */
        .link-list { list-style: none; padding: 0; margin: 20px 0; }
        .link-item { 
            display: flex; 
            align-items: center; 
            padding: 15px 20px; 
            margin-bottom: 10px; 
            border: 1px solid #dee2e6; 
            border-radius: 6px; 
            background-color: #ffffff;
            transition: box-shadow 0.2s ease-in-out;
        }
        .link-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .link-title { font-size: 1.1em; font-weight: 600; color: #007bff; text-decoration: none; flex-grow: 1; }

        /* --- 按钮样式 --- */
        .btn-primary {
            background-color: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background-color 0.2s;
        }
        .btn-primary:hover { background-color: #0056b3; }
        .btn-secondary {
            background-color: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; margin-right: 10px;
        }
        .btn-secondary:hover { background-color: #5a6268; }
        .btn-danger {
            background-color: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.9em;
        }
        .btn-danger:hover { background-color: #c82333; }
        .edit-prompt { margin-top: 20px; }

        /* --- 状态消息样式 --- */
        .status-message { padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold; }
        .status-message.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status-message.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status-message.info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .status-message.saving { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; }

        /* --- 编辑模式样式 --- */
        .editor-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .editor-table th, .editor-table td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        .editor-table th { background-color: #e9ecef; }
        .editor-table input { width: 95%; padding: 8px; border: 1px solid #ced4da; border-radius: 3px; box-sizing: border-box; }
        .editor-controls { margin-top: 25px; display: flex; gap: 10px; }

    </style>
    ${redirectScript}
</head>
<body>
    <div class="container">
        ${messageHtml}
        ${contentHtml}
    </div>
</body>
</html>
    `;
}

// =========================================================================
// 密钥验证页面渲染 (优化：使用相同的现代容器样式)
// =========================================================================
function renderTokenEntry(error = null) {
    const editRoute = EDIT_ROUTE_PATH;
    const messageHtml = error ? `<p class="status-message error">错误: ${error}</p>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>输入编辑密钥</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 20px; background-color: #f8f9fa; color: #333; }
        .container { max-width: 400px; margin: 50px auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h2 { color: #007bff; text-align: center; margin-bottom: 25px; }
        .status-message.error { padding: 10px; border-radius: 4px; margin-bottom: 15px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        input[type="password"] { width: 100%; padding: 10px; margin: 10px 0 20px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background-color 0.2s; }
        button:hover { background-color: #0056b3; }
        p { text-align: center; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>请输入编辑密钥</h2>
        ${messageHtml}
        <form method="POST" action="${editRoute}">
            <label for="token" style="font-weight: bold;">密钥:</label><br>
            <input type="password" id="token" name="token" required>
            <button type="submit">验证并进入编辑</button>
        </form>
        <p><a href="/">返回主页</a></p>
    </div>
</body>
</html>
    `;
}

// =========================================================================
// 主请求处理函数 (保持不变)
// =========================================================================
async function handleRequest(request, env) {
    const editModeKey = env.EDIT_MODE_KEY;
    const secretToken = env.SECRET_TOKEN;
    
    let url;
    
    try {
        url = new URL(request.url);
    } catch (e) {
        return new Response(`Error: Invalid URL format: ${request.url}`, { status: 400 });
    }

    const pathname = url.pathname; 
    const isPostToSave = request.method === "POST" && pathname === "/save";
    const isPostToEnterEdit = request.method === "POST" && pathname === EDIT_ROUTE_PATH;
    
    // 检查是否在编辑模式 (GET 请求时，通过 URL 参数判断)
    const editTokenFromQuery = url.searchParams.get(editModeKey);
    const isEditMode = editTokenFromQuery === secretToken;
    
    // --- 1. 处理保存请求 (POST /save) ---
    if (isPostToSave) {
        
        try {
            const formData = await request.formData();
            const receivedToken = formData.get(editModeKey); 
            const dataContent = formData.get("data"); 
            
            const isAuthorized = receivedToken === secretToken;
            
            if (!isAuthorized) {
                console.warn("POST /save Unauthorized attempt. Received Token:", receivedToken);
                return new Response("Unauthorized", { status: 403 });
            }

            if (!dataContent) {
                throw new Error("提交的数据为空。");
            }

            const newLinksArray = JSON.parse(dataContent); 
            // 优化：此处使用 put 覆盖整个 "all_links" 键
            await env[KV_NAMESPACE_BINDING_NAME].put("all_links", JSON.stringify(newLinksArray));
            
            // 成功：返回 200 OK 并附带客户端重定向指令
            const links = await getLinks(env); 
            return new Response(renderHtml(links, false, null, '链接列表已成功保存!', url, env), { 
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 200
            });

        } catch (e) {
            console.error("Save error:", e);
            // 失败：返回 500 错误页面 (仍然在编辑模式下)
            const links = await getLinks(env);
            return new Response(renderHtml(links, true, `保存失败: ${e.message}`, null, url, env), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 500
            });
        }
    }
    
    // --- 2. 处理进入编辑模式的 POST 验证 (POST /enter-edit) ---
    if (isPostToEnterEdit) {
        try {
            const formData = await request.formData();
            const receivedToken = formData.get("token");
            
            if (receivedToken === secretToken) {
                // 优化：直接重定向到 /edit，并在 URL 中携带 token，这样 GET /edit 就能进入编辑模式
                const redirectUrl = `${url.origin}/edit?${editModeKey}=${secretToken}`;
                return Response.redirect(redirectUrl, 302);
            } else {
                return new Response(renderTokenEntry("密钥错误，请重试。"), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    status: 403
                });
            }
        } catch (e) {
             console.error("Token entry POST error:", e);
             return new Response(renderTokenEntry(`处理请求时发生错误: ${e.message}`), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 500
            });
        }
    }

    // --- 3. 处理显示/编辑界面请求 (GET / 或 GET /edit, GET /enter-edit) ---
    if (request.method === "GET") {
        try {
            
            const links = await getLinks(env);
            // 确保 links 是一个扁平的数组，用于渲染
            const flatLinks = links.flat().filter(link => link);
            
            if (pathname === EDIT_ROUTE_PATH) {
                // GET /enter-edit：显示输入密钥页面
                return new Response(renderTokenEntry(), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            
            // 正常显示主页 (/) 或 编辑页 (/edit?token=...)
            return new Response(renderHtml(flatLinks, isEditMode, null, null, url, env), {
                headers: { 
                    'Content-Type': 'text/html; charset=utf-8'
                },
            });

        } catch (e) {
            console.error("Read error:", e);
            return new Response(`Error loading links: ${e.message}`, { 
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                status: 500 
            });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
}

// =========================================================================
// 导出 worker
// =========================================================================
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    }
};
