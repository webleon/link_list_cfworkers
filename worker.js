// =========================================================================
// 常量声明
// =========================================================================
const KV_NAMESPACE_BINDING_NAME = "LINK_LIST_NAMESPACE";
const EDIT_ROUTE_PATH = "/edit"; 
const EDIT_TOKEN_PARAM = "edit_token"; // 用于编辑的查询参数/表单字段名
const VIEW_TOKEN_PARAM = "view_token"; // 用于查看的查询参数/表单字段名
// =========================================================================
// 辅助函数：从 KV 读取所有链接
// =========================================================================
async function getLinks(env) {
    try {
        const { keys } = await env[KV_NAMESPACE_BINDING_NAME].list(); 
        
        const linkKey = keys.find(k => k.name === "all_links");
        if (!linkKey) return [];

        const value = await env[KV_NAMESPACE_BINDING_NAME].get(linkKey.name);
        
        if (value) {
            try {
                const linkData = JSON.parse(value);
                if (Array.isArray(linkData)) {
                    // 确保每个链接都有一个临时的 ID 用于前端编辑
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
// 基础 CSS 样式（统一复用）
// =========================================================================
const BASE_CSS = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 20px; background-color: #f8f9fa; color: #333; }
    
    /* --- 容器样式 --- */
    .container-wide { max-width: 900px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .container-narrow { max-width: 450px; margin: 50px auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); } /* 统一窄容器宽度 */

    h2 { color: #007bff; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
    
    /* --- 按钮样式 --- */
    .btn { border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background-color 0.2s; text-decoration: none; display: inline-block; text-align: center; }
    .btn-primary { background-color: #007bff; color: white; }
    .btn-primary:hover { background-color: #0056b3; }
    .btn-secondary { background-color: #6c757d; color: white; margin-right: 10px; }
    .btn-secondary:hover { background-color: #5a6268; }
    .btn-danger { background-color: #dc3545; color: white; padding: 5px 10px; font-size: 0.9em; }
    .btn-danger:hover { background-color: #c82333; }

    /* --- 状态消息样式 --- */
    .status-message { padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold; font-size: 0.9em; } /* 修改：统一字体大小为 0.9em */
    .status-message.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .status-message.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .status-message.info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
    .status-message.saving { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; margin-top: 15px; } /* 修改：增加 margin-top 间距 */
    
    /* --- 链接列表样式 --- */
    .link-list { list-style: none; padding: 0; margin: 20px 0; }
    .link-item { 
        display: flex; align-items: center; padding: 15px 20px; margin-bottom: 10px; border: 1px solid #dee2e6; border-radius: 6px; background-color: #ffffff; transition: box-shadow 0.2s ease-in-out;
    }
    .link-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .link-title { font-size: 1.1em; font-weight: 600; color: #007bff; text-decoration: none; flex-grow: 1; }

    .edit-prompt { margin-top: 20px; }
    .editor-controls { margin-top: 25px; display: flex; gap: 10px; flex-wrap: wrap; }
    .input-field { width: 100%; padding: 10px; margin: 10px 0 20px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    .editor-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .editor-table th, .editor-table td { border: 1px solid #ccc; padding: 10px; text-align: left; }
    .editor-table th { background-color: #e9ecef; }
    .editor-table input { width: 95%; padding: 8px; border: 1px solid #ced4da; border-radius: 3px; box-sizing: border-box; }

    /* 针对特定场景的调整 */
    .token-form-wrapper { text-align: center; }
`;

// -------------------------------------------------------------------------
// 渲染编辑密钥输入页 (窄布局) -> renderEditTokenEntry()
// -------------------------------------------------------------------------
function renderEditTokenEntry(error = null) {
    const editRoute = EDIT_ROUTE_PATH;
    const messageHtml = error ? `<p class="status-message error">${error}</p>` : '';

    // 专门用于编辑密钥的 CSS
    const TOKEN_CSS = `
        ${BASE_CSS}
        .btn-primary { width: 100%; margin-top: 15px; }
    `;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>输入编辑密钥</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${TOKEN_CSS}</style>
</head>
<body>
    <div class="container-narrow">
        <h2>请输入编辑密钥</h2>
        ${messageHtml}
        <form method="POST" action="${editRoute}">
            <label for="token" style="font-weight: bold;">编辑密钥:</label><br>
            <input type="password" id="token" name="token" required class="input-field">
            <button type="submit" class="btn btn-primary">解锁并编辑</button>
        </form>
        <p><a href="/" class="btn btn-secondary" style="width: auto; display: inline-block; margin-top: 15px;">返回主页</a></p>
    </div>
</body>
</html>
    `;
}

// -------------------------------------------------------------------------
// 渲染查看密钥输入页 (窄布局) -> renderViewTokenEntry()
// -------------------------------------------------------------------------
function renderViewTokenEntry(error = null, currentUrl) {
    const messageHtml = error ? `<p class="status-message error">${error}</p>` : '';
    const viewTokenParam = VIEW_TOKEN_PARAM;

    // 专门用于查看密钥的 CSS，与编辑密钥页面共用窄容器
    const TOKEN_CSS = `
        ${BASE_CSS}
        .btn-primary { width: 100%; margin-top: 15px; }
    `;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>请输入查看密钥</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${TOKEN_CSS}</style>
</head>
<body>
    <div class="container-narrow">
        <h2>请输入查看密钥</h2>
        ${messageHtml}
        <form method="GET" action="${currentUrl.pathname}">
            <label for="${viewTokenParam}" style="font-weight: bold;">访问密钥:</label><br>
            <input type="password" id="${viewTokenParam}" name="${viewTokenParam}" required class="input-field"> 
            <button type="submit" class="btn btn-primary">解锁并查看</button>
        </form>
        <!-- 移除了返回主页的链接 -->
    </div>
</body>
</html>
    `;
}


// -------------------------------------------------------------------------
// 渲染主列表页/编辑页的函数
// -------------------------------------------------------------------------
function renderHtml(links, isEditMode, error = null, success = null, currentUrl, env) {
    
    const editToken = env.EDIT_TOKEN;
    const viewToken = env.VIEW_TOKEN || "";

    let redirectScript = '';
    if (success) {
        redirectScript = `<script>
            console.log('${success}');
            setTimeout(() => {
                const location = window.location.href.split('?')[0].replace('/save', '/');
                window.location.href = location; 
            }, 1500); 
        </script>`;
    }

    let contentHtml = '';
    let containerClass = 'container-wide'; // 默认宽容器

    if (!isEditMode) {
        // --- 非编辑模式 (显示列表) ---
        
        const listItems = links.map(link => `
            <li class="link-item">
                <a href="${link.url}" target="_blank" title="点击跳转到: ${link.url}" class="link-title">
                    ${link.name || '无名称链接'}
                </a>
            </li>
        `).join('');

        const successMessageHtml = success ? `<p class="status-message success">${success}</p>` : '';

        if (viewToken) {
            // --- 需要查看密钥的逻辑 ---
            const viewTokenFromQuery = currentUrl.searchParams.get(VIEW_TOKEN_PARAM);
            
            if (viewTokenFromQuery === viewToken) {
                // 密钥正确，显示内容
                containerClass = 'container-wide'; // 保持宽容器
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
                            <button type="submit" class="btn btn-primary">进入编辑模式</button>
                        </form>
                    </p>
                `;
            } else {
                // 密钥错误或未输入，调用 renderViewTokenEntry
                return renderViewTokenEntry(null, currentUrl);
            }

        } else {
            // --- 无需密钥，直接显示内容 (使用宽容器) ---
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
                        <button type="submit" class="btn btn-primary">进入编辑模式</button>
                    </form>
                </p>
            `;
        }

    } else {
        // --- 编辑模式 (JS 驱动的表单) (使用宽容器) ---
        const initialLinksJson = JSON.stringify(links);

        contentHtml = `
            <h2>编辑链接列表</h2>
            <p class="status-message info">使用下方的表单编辑链接，点击“保存所有更改”按钮。</p>
            
            <div id="link-editor"></div>

            <div class="editor-controls">
                <button id="add-link-btn" type="button" class="btn btn-secondary">增加新链接</button>
                <button id="save-links-btn" type="button" class="btn btn-primary">保存所有更改</button>
                <button onclick="window.location.href='/'" class="btn btn-secondary">取消并返回</button>
            </div>
            
            <div id="status-message"></div>

            <!-- 隐藏的用于提交数据的表单 -->
            <form id="data-form" method="POST" action="/save" style="display:none;">
                <input type="hidden" name="${EDIT_TOKEN_PARAM}" value="${editToken}"> 
                <textarea id="data-payload" name="data"></textarea>
                <button type="submit" id="submit-form-btn">Submit</button>
            </form>
        `;
        
        const jsLogic = `
        <script>
            const linksData = ${initialLinksJson} || [];
            const editorDiv = document.getElementById('link-editor');
            const addButton = document.getElementById('add-link-btn');
            const saveButton = document.getElementById('save-links-btn');
            const statusDiv = document.getElementById('status-message');
            let nextId = linksData.length > 0 ? Math.max(...linksData.map(l => l.id)) + 1 : 1;

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
                    
                    const nameCell = row.insertCell();
                    nameCell.innerHTML = \`<input type="text" name="name_\${link.id}" value="\${link.name}" placeholder="链接名称"> \`;
                    
                    const urlCell = row.insertCell();
                    urlCell.innerHTML = \`<input type="url" name="url_\${link.id}" value="\${link.url}" placeholder="https://example.com"> \`;
                    
                    const actionCell = row.insertCell();
                    actionCell.style.textAlign = 'center';
                    actionCell.innerHTML = \`<button type="button" onclick="deleteLink(\${link.id})" class="btn btn-danger">删除</button>\`;
                });
                
                editorDiv.appendChild(table);
            }

            addButton.onclick = () => {
                const newLink = { id: nextId++, name: '', url: '' };
                linksData.push(newLink);
                renderLinks();
            };

            window.deleteLink = (id) => {
                const index = linksData.findIndex(l => l.id === id);
                if (index !== -1) {
                    linksData.splice(index, 1);
                    renderLinks();
                }
            };

            saveButton.onclick = () => {
                statusDiv.textContent = '正在保存...';
                statusDiv.className = 'status-message saving'; // 样式已在 CSS 中调整了 margin-top
                
                const updatedLinks = [];
                const inputs = editorDiv.querySelectorAll('input');
                const tempMap = {};
                inputs.forEach(input => {
                    tempMap[input.name] = input.value;
                });

                linksData.forEach(link => {
                    const name = tempMap[\`name_\${link.id}\`] || link.name;
                    const url = tempMap[\`url_\${link.id}\`] || link.url;
                    
                    if (name.trim() !== "" || url.trim() !== "") {
                        updatedLinks.push({
                            name: name.trim(),
                            url: url.trim()
                        });
                    }
                });

                document.getElementById('data-payload').value = JSON.stringify(updatedLinks);
                document.getElementById('submit-form-btn').click(); 
            };
            
            renderLinks();
        </script>
        `;
        
        contentHtml += jsLogic;
    }


    const messageHtml = error ? `<p class="status-message error">${error}</p>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${isEditMode ? '编辑链接列表' : '链接列表'}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${BASE_CSS}</style>
    ${redirectScript}
</head>
<body>
    <div class="${containerClass}">
        ${messageHtml}
        ${contentHtml}
    </div>
</body>
</html>
    `;
}

// =========================================================================
// 主请求处理函数
// =========================================================================
async function handleRequest(request, env) {
    const editToken = env.EDIT_TOKEN;
    const viewToken = env.VIEW_TOKEN || "";
    
    let url;
    
    try {
        url = new URL(request.url);
    } catch (e) {
        return new Response(`Error: Invalid URL format: ${request.url}`, { status: 400 });
    }

    const pathname = url.pathname; 
    const isPostToSave = request.method === "POST" && pathname === "/save";
    const isPostToEdit = request.method === "POST" && pathname === EDIT_ROUTE_PATH; 
    
    // 检查编辑模式 (GET /edit?edit_token=...)
    const editTokenFromQuery = url.searchParams.get(EDIT_TOKEN_PARAM);
    const isEditMode = editTokenFromQuery === editToken && pathname === EDIT_ROUTE_PATH; 
    
    // 检查查看模式 (GET / 或 GET /edit 且 url 中有 view_token)
    const viewTokenFromQuery = url.searchParams.get(VIEW_TOKEN_PARAM);
    const requiresViewToken = !!viewToken && !viewTokenFromQuery && url.pathname === "/"; // 仅在主页且需要 token 时触发
    const isViewTokenCorrect = !!viewToken && viewTokenFromQuery === viewToken;

    // --- 1. 处理保存请求 (POST /save) ---
    if (isPostToSave) {
        
        try {
            const formData = await request.formData();
            const receivedToken = formData.get(EDIT_TOKEN_PARAM);
            const dataContent = formData.get("data"); 
            
            const isAuthorized = receivedToken === editToken;
            
            if (!isAuthorized) {
                console.warn("POST /save Unauthorized attempt. Received Token:", receivedToken);
                return new Response("Unauthorized", { status: 403 });
            }

            if (!dataContent) {
                throw new Error("提交的数据为空。");
            }

            const newLinksArray = JSON.parse(dataContent); 
            await env[KV_NAMESPACE_BINDING_NAME].put("all_links", JSON.stringify(newLinksArray));
            
            const links = await getLinks(env); 
            return new Response(renderHtml(links, false, null, '链接列表已成功保存!', url, env), { 
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 200
            });

        } catch (e) {
            console.error("Save error:", e);
            const links = await getLinks(env);
            // 失败时仍使用编辑模式界面，显示错误
            return new Response(renderHtml(links, true, `保存失败: ${e.message}`, null, url, env), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 500
            });
        }
    }
    
    // --- 2. 处理进入/验证编辑密钥请求 (POST /edit) ---
    if (isPostToEdit) {
        try {
            const formData = await request.formData();
            const receivedToken = formData.get("token");
            
            if (receivedToken === editToken) {
                // 验证成功，重定向到 GET /edit?edit_token=...
                const redirectUrl = `${url.origin}${EDIT_ROUTE_PATH}?${EDIT_TOKEN_PARAM}=${editToken}`;
                return Response.redirect(redirectUrl, 302);
            } else {
                // 验证失败，返回编辑密钥输入页 (使用 renderEditTokenEntry)
                return new Response(renderEditTokenEntry("密钥错误，请重试。"), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    status: 403
                });
            }
        } catch (e) {
             console.error("Token entry POST error:", e);
             return new Response(renderEditTokenEntry(`处理请求时发生错误: ${e.message}`), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 500
            });
        }
    }
    
    // --- 3. 处理显示/编辑界面请求 (GET / 或 GET /edit) ---
    if (request.method === "GET") {
        try {
            
            const links = await getLinks(env);
            const flatLinks = links.flat().filter(link => link);
            
            if (pathname === EDIT_ROUTE_PATH) {
                if (isEditMode) {
                    // 携带了正确 token，进入编辑模式 (使用宽容器)
                    return new Response(renderHtml(flatLinks, true, null, null, url, env), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                } else {
                    // 未携带 token 或 token 错误，显示输入编辑密钥页面 (使用 renderEditTokenEntry)
                    return new Response(renderEditTokenEntry(), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                }
            }
            
            // 正常显示主页 (/)
            if (viewToken) { // 如果设置了 VIEW_TOKEN
                if (viewTokenFromQuery === viewToken) {
                     // 密钥正确，显示主列表页
                     return new Response(renderHtml(flatLinks, false, null, null, url, env), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                } else if (viewTokenFromQuery !== null) {
                    // URL 中有 view_token 但不正确
                     return new Response(renderViewTokenEntry("访问密钥错误，请重试。", url), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                        status: 403
                    });
                } else if (requiresViewToken) {
                    // URL 中没有 view_token，需要提示输入
                    return new Response(renderViewTokenEntry(null, url), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                        status: 403
                    });
                }
            }

            // 无需密钥或 view_token 验证通过，直接显示主页 (使用 renderHtml 默认宽容器)
            return new Response(renderHtml(flatLinks, false, null, null, url, env), {
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
