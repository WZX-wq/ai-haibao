# 第三方应用授权登录接口文档

## 概述

本文档描述第三方应用如何通过 OAuth2 授权码模式接入统一登录中心，实现用户授权登录功能。

## 授权流程

```
┌─────────────┐                                    ┌─────────────────┐
│   第三方    │ ──1. 引导用户到授权页─────────────▶ │  统一登录中心   │
│   应用      │                                    │                 │
│             │ ◀─2. 用户登录并授权─────────────── │                 │
│             │                                    │                 │
│             │ ◀─3. 返回授权码(code)───────────── │                 │
│             │    (通过回调地址)                   │                 │
│             │                                    │                 │
│             │ ──4. 用授权码换取Token────────────▶ │                 │
│             │                                    │                 │
│             │ ◀─5. 返回access_token和用户信息─── │                 │
└─────────────┘                                    └─────────────────┘
```

## 接口列表

### 1. 授权码换取Token

**接口地址**: `POST /api/oauth/token`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明                     |
|---------------|--------|------|--------------------------|
| grant_type    | string | 是   | 固定值: authorization_code |
| code          | string | 是   | 授权码                   |
| client_id     | string | 是   | 应用客户端ID             |
| client_secret | string | 是   | 应用客户端密钥           |
| redirect_uri  | string | 是   | 回调地址(需与授权时一致) |

**响应示例**:

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": {
            "id": 1,
            "username": "testuser",
            "nickname": "测试用户",
            "email": "test@example.com",
            "phone": "13800138000",
            "avatar": null
        }
    }
}
```

## 错误码说明

| 状态码 | 说明                     |
|--------|--------------------------|
| 200    | 请求成功                 |
| 400    | 参数错误                 |
| 401    | 未授权/认证失败          |
| 404    | 应用不存在               |
| 422    | 参数验证失败             |
| 500    | 服务器内部错误           |

## 完整接入示例

### 步骤1: 引导用户到授权页面

```html
<!-- 在第三方应用中放置登录按钮 -->
<a href="https://login.kunqiongai.com/authorize.html?client_id=your_client_id&redirect_uri=http://your-app.com/callback&state=random_string">
    使用统一登录中心登录
</a>
```

### 步骤2: 处理回调获取授权码

```javascript
// 回调页面 callback.html
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

// 验证state防止CSRF攻击
if (state !== sessionStorage.getItem('oauth_state')) {
    alert('非法请求');
    return;
}

// 使用授权码换取Token
fetch('/your-backend/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
});
```

### 步骤3: 后端换取Token

```php
// 第三方应用后端
public function exchangeToken(Request $request)
{
    $response = Http::post('https://login.kunqiongai.com/api/oauth/token', [
        'grant_type' => 'authorization_code',
        'code' => $request->code,
        'client_id' => 'your_client_id',
        'client_secret' => 'your_client_secret',
        'redirect_uri' => 'http://your-app.com/callback',
    ]);
    
    $data = $response->json();
    
    // 保存用户信息到本地
    // 创建本地会话...
    
    return response()->json($data);
}
```

## 安全建议

1. **使用HTTPS**: 所有接口调用必须使用HTTPS
2. **验证回调地址**: 确保回调地址在应用注册时已配置
3. **State参数**: 必须传递随机state参数防止CSRF攻击
4. **密钥保管**: client_secret 必须妥善保管，不要暴露在前端
5. **授权码时效**: 授权码有效期为10分钟，只能使用一次
