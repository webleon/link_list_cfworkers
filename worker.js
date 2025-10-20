// =========================================================================
// 常量声明
// =========================================================================
const KV_NAMESPACE_BINDING_NAME = "LINK_LIST_NAMESPACE";
const EDIT_ROUTE_PATH = "/edit"; 
const EDIT_TOKEN_PARAM = "edit_token"; // 用于编辑的查询参数（仅用于首次进入时的重定向）
const VIEW_TOKEN_PARAM = "view_token"; // 用于查看的查询参数（仅用于首次进入时的重定向）

// Cookie 相关常量
const EDIT_COOKIE_NAME = "edit_session";
const VIEW_COOKIE_NAME = "view_session";

// =========================================================================
// 辅助函数：Cookie 管理工具
// =========================================================================
function setSessionCookie(name, value, maxAgeSeconds, response) {
    // HttpOnly: 阻止客户端 JavaScript 访问
    // Secure: 仅在 HTTPS 上发送（Workers 默认是 HTTPS）
    // SameSite=Lax: 默认的安全设置
    const cookieString = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
    // !!! 关键：确保 response 对象是可修改的，此处 .append() 会修改传入的 response 对象的 headers
    response.headers.append('Set-Cookie', cookieString);
    return response;
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${name}=`));
    
    if (cookie) {
        return cookie.substring(name.length + 1);
    }
    return null;
}

// 新增：从环境变量获取有效期（秒）
function getCookieExpirySeconds(env, cookieName) {
    let hours;
    
    if (cookieName === EDIT_COOKIE_NAME) {
        // 默认值：7天 (168 小时)
        const defaultHours = 7 * 24; 
        // 环境变量名称: EDIT_COOKIE_AGE (小时)
        hours = parseInt(env.EDIT_COOKIE_AGE) || defaultHours; 
    } else if (cookieName === VIEW_COOKIE_NAME) {
        // 默认值：1 小时
        const defaultHours = 1; 
        // 环境变量名称: VIEW_COOKIE_AGE (小时)
        hours = parseInt(env.VIEW_COOKIE_AGE) || defaultHours; 
    } else {
        return 0; // 未知 Cookie
    }
    
    // 确保解析成功且大于 0，然后转换为秒
    return Math.max(0, hours) * 3600; 
}


// =========================================================================
// KV 数据操作
// =========================================================================
async function getLinks(env) {
    try {
        // 尝试列出 keys 以找到 "all_links"
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
// HTML 渲染样式
// =========================================================================
const BASE_CSS = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 20px; background-color: #f8f9fa; color: #333; }
    
    /* --- 容器样式 --- */
    .container-wide { max-width: 900px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .container-narrow { max-width: 450px; margin: 50px auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); } 
    
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
    .status-message { padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold; font-size: 0.9em; } 
    .status-message.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .status-message.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .status-message.info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
    .status-message.saving { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; margin-top: 15px; } 
    
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
// 渲染编辑密钥输入页 (窄布局)
// -------------------------------------------------------------------------
function renderEditTokenEntry(error = null) {
    const editRoute = EDIT_ROUTE_PATH;
    const messageHtml = error ? `<p class="status-message error">${error}</p>` : '';

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
// 渲染查看密钥输入页 (窄布局)
// -------------------------------------------------------------------------
function renderViewTokenEntry(error = null, currentUrl) {
    const messageHtml = error ? `<p class="status-message error">${error}</p>` : '';
    const viewTokenParam = VIEW_TOKEN_PARAM;

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
        // 成功保存后，自动跳转回主页，并清除查询参数
        redirectScript = `<script>
            console.log('${success}');
            setTimeout(() => {
                const location = window.location.href.split('?')[0].replace('/save', '/');
                window.location.href = location; 
            }, 1500); 
        </script>`;
    }

    let contentHtml = '';
    let containerClass = 'container-wide'; 

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
            // --- 需要查看密钥的逻辑 (Cookie 优先) ---
            const viewSessionCookie = getCookie(currentUrl.request, VIEW_COOKIE_NAME);
            const viewTokenFromQuery = currentUrl.searchParams.get(VIEW_TOKEN_PARAM);
            
            if (viewSessionCookie === viewToken || viewTokenFromQuery === viewToken) {
                // 密钥正确或 Cookie 有效，显示内容
                containerClass = 'container-wide'; 
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
                // 如果是通过查询参数进入的，标记需要重定向设置 Cookie (在 handleRequest 中处理 302)
                if (viewTokenFromQuery === viewToken) {
                    return { html: null, status: 302, viewToken: viewToken, viewExpirySeconds: getCookieExpirySeconds(env, VIEW_COOKIE_NAME) }; 
                }
            } else {
                // 密钥错误或未输入，调用 renderViewTokenEntry
                return { html: renderViewTokenEntry(null, currentUrl), status: 200 };
            }

        } else {
            // --- 无需密钥，直接显示内容 ---
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
        // --- 编辑模式 (JS 驱动的表单) ---
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
                    nameCell.innerHTML = \`<input type="text" name="name_\${link.id}" value="\${link.name.replace(/"/g, '&quot;')}" placeholder="链接名称"> \`;
                    
                    const urlCell = row.insertCell();
                    urlCell.innerHTML = \`<input type="url" name="url_\${link.id}" value="\${link.url.replace(/"/g, '&quot;')}" placeholder="https://example.com"> \`;
                    
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
                statusDiv.className = 'status-message saving';
                
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

    return { html: `
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
</html>`, status: 200 };
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
    
    // --- Cookie 检查 ---
    const editSessionCookie = getCookie(request, EDIT_COOKIE_NAME);
    const viewSessionCookie = getCookie(request, VIEW_COOKIE_NAME);
    
    // 检查是否已通过编辑密钥验证（Cookie 优先）
    const isAuthenticatedForEdit = editSessionCookie === editToken; 
    
    // 检查是否已通过查看密钥验证（Cookie 优先）
    const isAuthenticatedForView = viewToken && (viewSessionCookie === viewToken); 

    // ----------------------------------------------------------
    // 1. 处理进入/验证编辑密钥请求 (POST /edit)
    // ----------------------------------------------------------
    if (isPostToEdit) {
        try {
            const formData = await request.formData();
            const receivedToken = formData.get("token");
            
            if (receivedToken === editToken) {
                // 验证成功，设置 HttpOnly Cookie
                const editExpirySeconds = getCookieExpirySeconds(env, EDIT_COOKIE_NAME);
                
                // !!! 修复：创建新的 Response 对象来设置 Location 和 Set-Cookie
                const response = new Response(null, {
                    status: 302,
                    headers: {
                        'Location': url.origin + EDIT_ROUTE_PATH
                    }
                });
                setSessionCookie(EDIT_COOKIE_NAME, editToken, editExpirySeconds, response);
                
                return response;
            } else {
                // 验证失败，返回编辑密钥输入页
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

    // ----------------------------------------------------------
    // 2. 处理保存请求 (POST /save)
    // ----------------------------------------------------------
    if (isPostToSave) {
        
        try {
            const formData = await request.formData();
            const receivedToken = formData.get(EDIT_TOKEN_PARAM);
            const dataContent = formData.get("data"); 
            
            // 验证逻辑：检查 Cookie 或 POST 数据中的 Token
            const isAuthorized = isAuthenticatedForEdit || receivedToken === editToken;
            
            if (!isAuthorized) {
                console.warn("POST /save Unauthorized attempt.");
                return new Response("Unauthorized", { status: 403 });
            }

            if (!dataContent) {
                throw new Error("提交的数据为空。");
            }

            const newLinksArray = JSON.parse(dataContent); 
            await env[KV_NAMESPACE_BINDING_NAME].put("all_links", JSON.stringify(newLinksArray));
            
            // 成功后，重定向到主页 (302)，并在重定向响应中设置 VIEW_COOKIE (如果 VIEW_TOKEN 存在且未验证)
            
            // !!! 修复：创建新的 Response 对象来设置 Location 和 Set-Cookie
            const response = new Response(null, {
                status: 302,
                headers: {
                    'Location': url.origin + '/'
                }
            });
            
            if (viewToken && !isAuthenticatedForView) {
                const viewExpirySeconds = getCookieExpirySeconds(env, VIEW_COOKIE_NAME);
                setSessionCookie(VIEW_COOKIE_NAME, viewToken, viewExpirySeconds, response);
            }
            return response;

        } catch (e) {
            console.error("Save error:", e);
            const links = await getLinks(env);
            // 失败时仍使用编辑模式界面，显示错误
            const rendered = renderHtml(links, true, `保存失败: ${e.message}`, null, { request: request, searchParams: url.searchParams, pathname: url.pathname }, env);
            return new Response(rendered.html, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 500
            });
        }
    }
    
    // ----------------------------------------------------------
    // 3. 处理显示/编辑界面请求 (GET / 或 GET /edit)
    // ----------------------------------------------------------
    if (request.method === "GET") {
        
        const links = await getLinks(env);
        const flatLinks = links.flat().filter(link => link);
        
        if (pathname === EDIT_ROUTE_PATH) {
            if (isAuthenticatedForEdit) {
                // Cookie 有效，进入编辑模式
                const rendered = renderHtml(flatLinks, true, null, null, { request: request, searchParams: url.searchParams, pathname: url.pathname }, env);
                return new Response(rendered.html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            } else {
                // 未验证，显示输入编辑密钥页面
                return new Response(renderEditTokenEntry(), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
        }
        
        // 正常显示主页 (/)
        if (viewToken) { // 如果设置了 VIEW_TOKEN
            const viewTokenFromQuery = url.searchParams.get(VIEW_TOKEN_PARAM);
            
            if (isAuthenticatedForView || viewTokenFromQuery === viewToken) {
                 // Cookie 有效 或 查询参数正确 (首次验证)
                 
                 // 如果是通过查询参数进入的，设置 Cookie 并重定向（302）
                 if (viewTokenFromQuery === viewToken) {
                    const viewExpirySeconds = getCookieExpirySeconds(env, VIEW_COOKIE_NAME);
                    
                    // !!! 修复：创建新的 Response 对象来设置 Location 和 Set-Cookie
                    const response = new Response(null, {
                        status: 302,
                        headers: {
                            'Location': url.origin + '/'
                        }
                    });
                    setSessionCookie(VIEW_COOKIE_NAME, viewToken, viewExpirySeconds, response);
                    
                    return response;
                 }
                 
                 // 否则 (Cookie 有效)，直接返回 HTML
                 const rendered = renderHtml(flatLinks, false, null, null, { request: request, searchParams: url.searchParams, pathname: url.pathname }, env);
                 return new Response(rendered.html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            } else {
                // 密钥错误或未输入，调用 renderViewTokenEntry
                return new Response(renderViewTokenEntry(null, url), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    status: 200 
                });
            }
        }

        // 无需密钥验证，直接显示主页 
        const rendered = renderHtml(flatLinks, false, null, null, { request: request, searchParams: url.searchParams, pathname: url.pathname }, env);
        return new Response(rendered.html, {
            headers: { 
                'Content-Type': 'text/html; charset=utf-8'
            },
        });

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
