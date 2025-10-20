// =========================================================================
// 1. 配置与常量 (精简)
// =========================================================================
const KV_NAMESPACE = "LINK_LIST_NAMESPACE"; 
const EDIT_PATH = "/edit"; 
const TOKEN_PARAM = "access_token"; 
const SESSION_COOKIE = "access_session"; 
const MAX_LINKS = 50; 

// =========================================================================
// 2. 基础工具函数 (精简)
// =========================================================================
function setCookie(response, name, value, maxAgeSeconds) {
    const cookieString = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
    response.headers.append('Set-Cookie', cookieString);
    return response;
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie'); 
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${name}=`));
    return cookie ? cookie.substring(name.length + 1) : null;
}

function getExpiry(env) {
    return Math.max(0, parseInt(env.ACCESS_COOKIE_AGE) || 7 * 24) * 3600; 
}

async function getLinks(env) {
    const value = await env[KV_NAMESPACE].get("all_links");
    if (!value) return [];
    try {
        const data = JSON.parse(value);
        return Array.isArray(data) ? data.map(link => ({ name: link.name || '', url: link.url || '' })) : [];
    } catch (e) {
        console.error("KV JSON parse error:", e);
        return [];
    }
}


// =========================================================================
// 3. HTML/CSS 模板 (高度精简 & 增加 Favicon)
// =========================================================================

// 极简的链环 SVG 作为 Favicon (内嵌，无需单独文件)
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
const FAVICON_BASE64 = `data:image/svg+xml;base64,${btoa(FAVICON_SVG)}`;


const BASE_CSS = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 20px; background-color: #f8f9fa; color: #333; }
    .container-wide { max-width: 900px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .container-narrow { max-width: 450px; margin: 50px auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); } 
    h2 { color: #007bff; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
    .btn { border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background-color 0.2s; text-decoration: none; display: inline-block; text-align: center; }
    .btn-primary { background-color: #007bff; color: white; } .btn-primary:hover { background-color: #0056b3; }
    .btn-secondary { background-color: #6c757d; color: white; margin-right: 10px; } .btn-secondary:hover { background-color: #5a6268; }
    .btn-danger { background-color: #dc3545; color: white; padding: 5px 10px; font-size: 0.9em; } .btn-danger:hover { background-color: #c82333; }
    .status-message { padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold; font-size: 0.9em; } 
    .status-message.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .status-message.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .status-message.info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
    .link-list { list-style: none; padding: 0; margin: 20px 0; }
    .link-item { display: flex; align-items: center; padding: 15px 20px; margin-bottom: 10px; border: 1px solid #dee2e6; border-radius: 6px; background-color: #ffffff; transition: box-shadow 0.2s ease-in-out; }
    .link-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .link-title { font-size: 1.1em; font-weight: 600; color: #007bff; text-decoration: none; flex-grow: 1; }
    .editor-controls { margin-top: 25px; display: flex; gap: 10px; flex-wrap: wrap; }
    .input-field { width: 100%; padding: 10px; margin: 10px 0 20px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    .editor-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .editor-table th, .editor-table td { border: 1px solid #ccc; padding: 10px; text-align: left; }
    .editor-table th { background-color: #e9ecef; }
    .editor-table input { width: 95%; padding: 8px; border: 1px solid #ced4da; border-radius: 3px; box-sizing: border-box; }
    .btn-full-width { width: 100%; }
`;

// -------------------------------------------------------------------------
// 渲染密钥输入页面 (已修复变量引用错误)
// -------------------------------------------------------------------------
function renderTokenEntry(mode, statusMessage = null, nextPath = '/') {
    const isError = statusMessage && (statusMessage.includes('错误') || statusMessage.includes('失败'));
    const isFirstVisit = !statusMessage && nextPath === '/'; 

    const title = mode === 'view' ? '请输入访问密钥' : '请输入编辑密钥';
    const label = mode === 'view' ? '访问密钥:' : '编辑密钥:';
    
    const submitButtonText = '解锁'; 
    let backLink = '';
    
    if (!isFirstVisit) {
        const targetPath = isError ? nextPath : '/';
        const backButtonText = isError ? '返回' : '返回主页';
        backLink = `<p><a href="${targetPath}" class="btn btn-secondary" style="width: auto; display: inline-block; margin-top: 15px;">${backButtonText}</a></p>`;
    }

    const messageHtml = statusMessage ? `<p class="status-message ${isError ? 'error' : 'info'}">${statusMessage}</p>` : '';
    const formAction = EDIT_PATH + `?next=${encodeURIComponent(nextPath)}`;

    const html = `
<!DOCTYPE html>
<html>
<head><title>${title}</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="${FAVICON_BASE64}" type="image/svg+xml">
    <style>${BASE_CSS}.btn-primary { width: 100%; margin-top: 15px; }</style>
</head>
<body>
    <div class="container-narrow">
        <h2>${title}</h2>
        ${messageHtml}
        <form method="POST" action="${formAction}">
            <label for="${TOKEN_PARAM}" style="font-weight: bold;">${label}</label><br>
            <input type="password" id="${TOKEN_PARAM}" name="${TOKEN_PARAM}" required class="input-field">
            <button type="submit" class="btn btn-primary btn-full-width">${submitButtonText}</button>
        </form>
        ${backLink}
    </div>
</body>
</html>`;
    return html;
}

// -------------------------------------------------------------------------
// 渲染列表/编辑页面 (已修复链接打开方式)
// -------------------------------------------------------------------------
function renderList(links, isEditMode, statusMessage = null) {
    const msgHtml = statusMessage ? `<p class="status-message ${statusMessage.includes('失败') ? 'error' : 'success'}">${statusMessage}</p>` : '';

    if (!isEditMode) {
        // 修复：移除 target="_blank"，链接在当前页打开
        const listItems = links.map(link => `<li class="link-item"><a href="${link.url}" title="点击跳转到: ${link.url}" class="link-title">${link.name || '无名称链接'}</a></li>`).join('');
        const html = `
<!DOCTYPE html><html><head><title>链接列表</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="${FAVICON_BASE64}" type="image/svg+xml">
    <style>${BASE_CSS}</style></head>
<body><div class="container-wide">${msgHtml}<h2>精选链接</h2>${links.length === 0 ? '<p>当前没有已配置的链接。</p>' : `<ul class="link-list">${listItems}</ul>`}<p class="edit-prompt"><a href="${EDIT_PATH}" class="btn btn-primary">编辑</a></p></div></body></html>`;
        return html;
    } 
    
    // 编辑模式 (JS 逻辑保持不变，但被压缩在模板字符串中)
    let linkRows = links.map((link, index) => {
        const safeName = link.name ? link.name.replace(/"/g, '&quot;') : '';
        const safeUrl = link.url ? link.url.replace(/"/g, '&quot;') : '';
        return `
            <tr class="link-editor-row" data-index="${index}">
                <td><input type="text" name="link_${index}_name" value="${safeName}" placeholder="链接名称"></td>
                <td><input type="url" name="link_${index}_url" value="${safeUrl}" placeholder="https://example.com"></td>
                <td><button type="button" class="btn btn-danger remove-row-btn" onclick="removeRow(this)">删除</button></td>
            </tr>`;
    }).join('');

    const script = `
        const tbody = document.getElementById('link-editor-tbody');
        let rowIndex = ${links.length}; 
        function addRow(name = '', url = '') {
            if (tbody.children.length >= ${MAX_LINKS}) { alert('已达到最大链接数 (${MAX_LINKS})！'); return; }
            const row = document.createElement('tr');
            row.className = 'link-editor-row';
            row.setAttribute('data-index', rowIndex);
            row.innerHTML = \`<td><input type="text" name="link_\${rowIndex}_name" value="\${name.replace(/"/g, '&quot;')}" placeholder="链接名称"></td><td><input type="url" name="link_\${rowIndex}_url" value="\${url.replace(/"/g, '&quot;')}" placeholder="https://example.com"></td><td><button type="button" class="btn btn-danger remove-row-btn" onclick="removeRow(this)">删除</button></td>\`;
            tbody.appendChild(row);
            rowIndex++;
        }
        function removeRow(button) { button.closest('tr').remove(); }
        if (tbody.children.length < ${MAX_LINKS}) { addRow(); }
        document.getElementById('add-row-btn').addEventListener('click', () => addRow());
        document.getElementById('editor-form').addEventListener('submit', function() {
            document.querySelectorAll('.link-editor-row').forEach((row, index) => {
                row.querySelector('input[name^="link_"]').name = \`link_\${index}_name\`;
                row.querySelector('input[name$="_url"]').name = \`link_\${index}_url\`;
            });
        });`;

    const html = `
<!DOCTYPE html><html><head><title>编辑链接列表</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="${FAVICON_BASE64}" type="image/svg+xml">
    <style>${BASE_CSS}</style></head>
<body><div class="container-wide">${msgHtml}<h2>编辑链接列表 (最多 ${MAX_LINKS} 个链接)</h2><p class="status-message info">请编辑现有链接或点击“添加新链接”来创建新的条目。**保存时会提交所有可见的行。**</p><form id="editor-form" method="POST" action="/save"><table class="editor-table"><thead><tr><th>名称 (Name)</th><th>URL (链接)</th><th>操作</th></tr></thead><tbody id="link-editor-tbody">${linkRows}</tbody></table><div class="editor-controls"><button type="button" class="btn btn-secondary" id="add-row-btn">添加新链接</button><button type="submit" class="btn btn-primary">保存所有更改</button><button onclick="window.location.href='/'" class="btn btn-secondary" type="button">取消并返回</button></div></form></div>
<script>${script}</script></body></html>`;
    return html;
}

// -------------------------------------------------------------------------
// 渲染重定向页面 (用于 /success 和 /error)
// -------------------------------------------------------------------------
function renderRedirect(message, target, isSuccess = true) {
    const msgClass = isSuccess ? 'success' : 'error';
    const title = isSuccess ? '操作成功' : '操作失败';
    
    const html = `
<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="${FAVICON_BASE64}" type="image/svg+xml">
    <style>${BASE_CSS}.container-narrow { text-align: center; }</style></head>
<body>
    <div class="container-narrow">
        <p class="status-message ${msgClass}">${message}</p>
        <p>页面将在 2 秒后自动返回 ${target}...</p>
        <a href="${target}" class="btn btn-primary">立即返回</a>
    </div>
    <script>setTimeout(function(){ window.location.replace("${target}"); }, 2000);</script>
</body>
</html>`;
    return html;
}


// =========================================================================
// 4. 主请求处理器 (最终修正)
// =========================================================================
async function handleRequest(request, env) {
    const { ACCESS_TOKEN, ACCESS_MODE } = env;
    const isAuthRequired = !!ACCESS_TOKEN;
    // 如果是 VIEW 模式，则访问 / 也需要认证
    const isViewRequired = isAuthRequired && ACCESS_MODE === "view"; 
    const isAuthenticated = isAuthRequired && getCookie(request, SESSION_COOKIE) === ACCESS_TOKEN;

    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const nextPath = searchParams.get('next') || '/'; 
    const statusMessage = searchParams.get('status'); 

    // --- POST 请求处理 (重定向模式) ---
    if (request.method === "POST") {
        if (pathname === EDIT_PATH) { // POST /edit (密钥验证)
            try {
                const token = (await request.formData()).get(TOKEN_PARAM);
                if (token === ACCESS_TOKEN) {
                    // 成功：设置 Cookie 并 303 重定向到目标路径
                    // 如果是 view 模式，验证成功后跳回 / (列表页)
                    // 如果是 edit 模式，验证成功后跳到 /edit (编辑页)
                    const res = new Response("Redirecting...", { status: 303, headers: { 'Location': isViewRequired ? '/' : EDIT_PATH } }); 
                    setCookie(res, SESSION_COOKIE, ACCESS_TOKEN, getExpiry(env));
                    return res;
                } else {
                    // 失败：303 重定向到 /error
                    const msg = encodeURIComponent("验证密钥错误，请重试。"); 
                    return new Response("Redirecting...", { status: 303, headers: { 'Location': `/error?status=${msg}&next=${encodeURIComponent(nextPath)}` } });
                }
            } catch (e) {
                console.error("POST /edit Error:", e);
                const msg = encodeURIComponent(`内部错误: ${e.message.substring(0, 50)}`); 
                return new Response("Redirecting...", { status: 303, headers: { 'Location': `/error?status=${msg}&next=${encodeURIComponent(nextPath)}` } });
            }
        }
        
        if (pathname === "/save") { // POST /save (保存数据)
            if (!isAuthenticated) return new Response("Unauthorized", { status: 403 });
            try {
                const formData = await request.formData();
                const newLinks = [];
                for (let i = 0; i < MAX_LINKS; i++) {
                    const name = (formData.get(`link_${i}_name`) || '').toString().trim();
                    const url = (formData.get(`link_${i}_url`) || '').toString().trim();
                    if (name || url) newLinks.push({ name, url });
                }
                await env[KV_NAMESPACE].put("all_links", JSON.stringify(newLinks));
                // 成功：303 重定向到 /success
                return new Response("Redirecting...", { status: 303, headers: { 'Location': '/success' } });
            } catch (e) {
                console.error("POST /save Error:", e);
                const msg = encodeURIComponent(`保存失败: ${e.message.substring(0, 50)}`); 
                return new Response("Redirecting...", { status: 303, headers: { 'Location': `/error?status=${msg}&next=${encodeURIComponent('/')}` } });
            }
        }
    }

    // --- GET 请求处理 ---
    if (request.method === "GET") {
        const links = await getLinks(env); 

        if (pathname === '/success') {
             return new Response(renderRedirect('所有更改已成功保存！', '/', true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        if (pathname === '/error') {
             const msg = statusMessage ? decodeURIComponent(statusMessage) : '发生未知错误。';
             const target = decodeURIComponent(nextPath);
             return new Response(renderRedirect(msg, target, false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        if (pathname === EDIT_PATH) {
            if (isAuthenticated) {
                return new Response(renderList(links, true, statusMessage), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            } else {
                // 未认证，显示输入密钥界面 (mode='edit')
                return new Response(renderTokenEntry('edit', statusMessage, EDIT_PATH), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
        }
        
        if (pathname === '/') {
            if (isAuthRequired && !isAuthenticated) { 
                if (isViewRequired) {
                    // 模式为 VIEW 且未认证：需要输入访问密钥
                    return new Response(renderTokenEntry('view', statusMessage, '/'), { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 });
                } else {
                    // 模式为 EDIT 且未认证：跳过密钥输入，直接显示列表
                }
            }
            
            // 正常访问首页 (已认证 或 无需认证 或 EDIT 模式且未认证)
            const html = renderList(links, false, statusMessage);
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
    }

    return new Response("Not Found", { status: 404 });
}

// =========================================================================
// 导出 worker (保持不变)
// =========================================================================
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    }
};
