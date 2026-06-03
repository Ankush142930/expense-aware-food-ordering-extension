//TODO:
const CLIENT_ID = 'REPLACE_WITH_YOUR_CLIENT_ID';
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
const AUTH_URL = 'https://mcp.swiggy.com/auth/authorize';
const TOKEN_URL = 'https://mcp.swiggy.com/auth/token';
const MCP_FOOD_URL = 'https://mcp.swiggy.com/food';
const SCOPES = 'mcp:tools mcp:resources mcp:prompts';

// PKCE + CSRF helpers
function randomBase64Url(byteLength) {
    const arr = new Uint8Array(byteLength);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier() {
    return randomBase64Url(32);
}

async function generateCodeChallenge(verifier) {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(verifier)
    );
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateOAuthState() {
    return randomBase64Url(16);
}

// Token storage and session clear
async function storeTokens(tokens) {
    await chrome.storage.session.set({
        accessToken: tokens.access_token,
        expiresAt: Date.now() + tokens.expires_in * 1000
    })
}

async function getAccessToken() {
    const { accessToken, expiresAt } = await chrome.storage.session.get(['accessToken', 'expiresAt']);

    if(!accessToken) return null;

    // Treat as expired when ≤60s remain (Swiggy recommends proactive re-auth)
    if(expiresAt && Date.now() > expiresAt - 60000) return null;
    return accessToken;
}

async function clearAuthSession() {
    await chrome.storage.session.remove(['accessToken', 'expiresAt', 'pkceVerifier', 'oauthState']);

    await chrome.storage.sync.set({ swiggyConnected: false });
}

/** Throws if user must connect again (v1: no silent refresh). */
async function getValidToken() {
    const token = await getAccessToken();
    if(token) return token;
    throw new Error('REAUTH_REQUIRED');
}

// OAuth Launch (interactive only)
async function launchOAuthFlow() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateOAuthState();
    
    await chrome.storage.session.set({ pkceVerifier: verifier, oauthState: state});
    const authUrl = `${AUTH_URL}?${new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        scope: SCOPES,
    })}`

    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { 
                url: authUrl, 
                interactive: true
            }, 
            (responseUrl) => {
                (async () => {
                    try {
                        if(chrome.runtime.lastError || !responseUrl){
                            throw new Error(chrome.runtime.lastError?.message || 'Auth Failed')
                            return;
                        }

                        const url = new URL(responseUrl);
                        const oauthError = url.searchParams.get('error');
                        if(oauthError){
                            const errDesc = url.searchParams.get('error_description');
                            throw new Error(errDesc || oauthError);
                        }

                        const returnedState = url.searchParams.get('state');
                        if(!returnedState || returnedState !== state){
                            throw new Error('Invalid OAuth state - possible CSRF, try again');
                        }

                        const code = url.searchParams.get('code');
                        if(!code) throw new Error('No authorization code in redirect URL');

                        const { pkceVerifier } = await chrome.storage.session.get('pkceVerifier');
                        if(!pkceVerifier) throw new Error('PKCE verifier missing - try Connect again');

                        const tokenResponse = await fetch(TOKEN_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                grant_type: 'authorization_code',
                                code,
                                code_verifier: pkceVerifier,
                                redirect_uri: REDIRECT_URI,
                            })
                        })

                        if(!tokenResponse.ok){
                            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
                        }

                        const tokens = await tokenResponse.json();
                        await storeTokens(tokens);
                        await chrome.storage.session.remove(['pkceVerifier', 'oauthState']);
                        await chrome.storage.sync.set({ swiggyConnected: true});
                        resolve({ success: true});
                    } catch (error) {
                        await clearAuthSession();
                        reject(error);
                    }
                })();
            }
        )
    });
}

//MCP Callers and data helpers
function parseMcpToolResult(json){
    if(json.error){
        throw new Error(json.error.message ?? 'MCP request failed');
    }

    return json.result?.content?.[0]?.data ?? null;
}

async function callMcpTool(toolName, args = {}) {
    const token = await getValidToken();

    const body = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args},
    });

    let lastError;
    for(let attempt = 0; attempt < 4; attempt++){
        if(attempt > 0){
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        }

        const response = await fetch(MCP_FOOD_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body,
        });

        if(response.status === 401 || response.status ===  419){
            await clearAuthSession();
            throw new Error('REAUTH_REQUIRED');
        }

        if(response.status === 403){
            throw new Error('Insufficient scope - reconnect with required MCP scopes');
        }

        if(response.ok){
            const json = await response.json();
            return parseMcpToolResult(json);
        }

        lastError = new Error(`MCP call failed: ${response.status}`);
    }

    throw lastError;
}

async function getFoodCart() {
    const data = await callMcpTool('get_food_cart');
    if(!data) return { total: 0, items: [], restaurantName: null};

    return {
        total: data.total ?? data.bill?.total ?? 0,
        items: data.items ?? [],
        restaurantName: data.restaurantName ?? data.restaurant?.name ?? null,
    }
}

async function getMonthlySpend() {
    const data = await callMcpTool('get_food_orders');
    if(!data) return ({totalSpent: 0, orderCount: 0});

    const orders = data.orders ?? [];
    const now = new Date();
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();

    const thisMonthOrders = orders.filter(order => {
        if(order.status === 'CANCELLED') return false;
        const d = new Date(order.createdAt ?? order.placedAt ?? 0);
        return (d.getMonth() === currMonth && d.getFullYear() === currYear);
    })

    const totalSpent = thisMonthOrders.reduce((sum, order) => {
        return sum + (order.total ?? order.bill?.total ?? 0);
    }, 0);

    return {totalSpent, orderCount: thisMonthOrders.length};
}

//Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        try {
            switch(message.type){
                case 'TRIGGER_AUTH': {
                    const result = await launchOAuthFlow();
                    sendResponse(result);
                    break;
                }
                case 'GET_CART': {
                    const result = await getFoodCart();
                    await chrome.storage.local.set({cachedCart: result});
                    sendResponse({success: true, data: result});
                    break;
                }
                case 'GET_ORDERS': {
                    const result = await getMonthlySpend();
                    await chrome.storage.local.set({ monthlySpent: result.totalSpent});
                    sendResponse({success: true, data: result});
                    break;
                }
                default: {
                    sendResponse({success: false, error: 'Unknown message type'});
                }
            }
        } catch (error) {
            const needsReauth = error.message === 'REAUTH_REQUIRED';
            if(needsReauth) await clearAuthSession();
            sendResponse({
                success: false, 
                error: needsReauth 
                    ? 'Connect Swiggy in the extension popup' 
                    : error.message, 
                reauth: needsReauth
            });
        }
    })();
    return true;
})

