# E2E + DB 闭环测试报告

- 测试时间: 2026-04-11
- 测试环境:
  - 前端: `http://127.0.0.1:5173`
  - 后端: `http://127.0.0.1:7001`
  - 数据库: `82.157.237.217:35007 / kqai_web_ai_haibao`
- 执行人: Codex

## 1) 操作步骤

1. 启动并确认服务状态  
   - `npm run serve:bg`  
   - `npm run serve:status`
2. 执行前端全量 QA  
   - `npm run qa:full`
3. 读取 QA 产物  
   - `output/playwright/full-page-qa/report.json`  
   - `output/playwright/full-page-qa/report.md`  
   - `output/playwright/full-page-qa/screenshots/*`
4. 直连数据库只读核验  
   - `SHOW TABLES;`
   - `SELECT COUNT(*) ... FROM app_users/app_sessions/oauth_identities;`
   - `SELECT ... FROM app_users/app_sessions ORDER BY id DESC LIMIT 5;`
   - `SHOW TABLES LIKE '%poster%'; SHOW TABLES LIKE '%design%'; SHOW TABLES LIKE '%template%';`
5. 对照服务实现  
   - `service/src/service/design.ts`（`getMyDesigns/deleteWork/saveTemplate`）

## 2) 截图文件

- `home-tempid1.png`
- `home-tempid2.png`
- `route-home-tempid1.png`
- `route-draw.png`
- `route-html.png`
- `route-psd.png`

位置: `D:\code1\Ai-haibao\downloads\main-editor\poster-design\output\playwright\full-page-qa\screenshots`

## 3) SQL 与查询结果

```sql
SHOW TABLES;
```

结果: 仅有
- `account_permission_snapshots`
- `app_sessions`
- `app_users`
- `oauth_identities`

```sql
SELECT COUNT(*) AS app_users_count FROM app_users;
SELECT COUNT(*) AS app_sessions_count FROM app_sessions;
SELECT COUNT(*) AS oauth_identities_count FROM oauth_identities;
```

结果:
- `app_users_count = 1`
- `app_sessions_count = 1`
- `oauth_identities_count = 1`

```sql
SELECT id, display_name, email, provider_name, last_login_at
FROM app_users
ORDER BY id DESC LIMIT 5;

SELECT id, user_id, session_status, expired_at, last_seen_at
FROM app_sessions
ORDER BY id DESC LIMIT 5;
```

结果摘要:
- 存在用户 `wzx1`
- 最近 session 为 `revoked`

```sql
SHOW TABLES LIKE '%poster%';
SHOW TABLES LIKE '%design%';
SHOW TABLES LIKE '%template%';
```

结果: 无匹配表。

## 4) 前后端一致性结论

- 本次 QA 脚本统计: `15` 项检查，`3` 通过，`12` 失败。
- 关键失败根因: 前端路由引用缺失文件 `@/views/Welcome.vue`，导致 Vite 内部 500，进而使大量 UI 流程无法进入有效页面状态。
- 后端服务 `design` 相关接口在本地实现里使用 `mock JSON` 文件，而非数据库持久化:
  - `getMyDesigns` 读取 `mock/posters/list.json`
  - `deleteWork` 改写 `mock/posters/list.json`
  - `saveTemplate` 写入 `mock/templates/*.json` 与 `mock/templates/list.json`
- 远端数据库当前只有账号会话相关表，无作品/模板业务表，无法对“保存作品/删除作品”做 DB 级闭环对账。

结论:
- 账号会话链路（`app_users/app_sessions/oauth_identities`）可做数据库核验。
- 作品链路目前是“前端 + 本地 mock 文件”，不是“前端 + 数据库”，因此不满足你要求的“UI 操作 + 数据库查询”完整闭环条件。

## 5) Bug 汇总

1. **P0** `/welcome` 相关缺失导致全局路由构建异常  
   - 证据: `report.json`/控制台错误反复出现  
   - 报错: `Failed to resolve import "@/views/Welcome.vue" from "src/router/base.ts"`

2. **P1** QA 脚本面板交互全部超时（连锁故障）  
   - 证据: `panel-template/panel-materials/panel-photos/toolbox/...` 均 `locator timeout`
   - 本质: 页面未正确渲染到可交互状态，不是单一组件点击问题。

3. **P1** 乱码风险仍在  
   - 证据: 页面标题显示为 `椴茬┕璁捐`（`APP_NAME` 乱码）

## 6) 建议

1. 先恢复 `src/views/Welcome.vue`，解除路由构建错误，再复跑同一套 QA。
2. 若目标是严格 DB 闭环，需把作品保存/删除链路接入数据库表（而非 mock JSON）。
3. 完成上面两点后，再执行第二轮“UI + DB”闭环验收并复用本报告模板。
