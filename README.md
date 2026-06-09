<div align="center">
  <img src="./logo.png" alt="panic.design logo" width="300" />
  <h1>panic.design | Zero-Intrusion Chaos Gateway</h1>
  <p>
    <a href="https://github.com/AndrewWangDev/panic_design/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
    <img src="https://img.shields.io/badge/Edge-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
    <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js&logoColor=white" alt="Next.js 16.2">
    <img src="https://img.shields.io/badge/Framework-Hono_v4.12.23-E36002" alt="Hono v4.12">
    <img src="https://img.shields.io/badge/Auth-NextAuth-000000" alt="Next Auth">
    <img src="https://img.shields.io/badge/Map-topojson--client-green" alt="topojson-client">
  </p>
</div>

---

## ⚡ 核心特性矩阵 (Core Features)

### 🧠 Intent-Driven AIOps (意图驱动的 AI 运维)
无需繁琐的 YAML 配置。基于 **Llama 4 Scout 17B (MoE)** 强大的逻辑推演能力，您只需输入自然语言（如 *"Simulate trans-Pacific cable congestion"*），AI Copilot 即可自动：
1. 推演物理路由轨迹并触发逻辑校验 (Simulated Routing)。
2. 生成确定性的边缘混沌注入参数 (Auto-fill Chaos Parameters)。
3. 在不执行真实网络注入的情况下，度量并预测这波外部环境变化对企业 SLO（服务等级目标）可能造成的负面影响。

### ☠️ L4/L7 Mutilation Engine (全栈故障残害引擎)
在 Cloudflare 边缘节点实现真正的**零侵入 (Zero-Intrusion) 故障注入**，客户端与服务端均无需安装任何 Agent SDK：
- **L4 传输层降级**：支持精准的包丢失 (Packet Loss)、绝对延迟 (Base Latency) 与网络抖动 (Jitter Distribution: Uniform/Normal/Spikes)。
- **L7 应用层篡改**：支持 429/502/504 状态码覆写、类型毒化 (Type Poisoning)、空响应截断 (Empty Shell) 以及 强行截断 (Unexpected EOF)。

### 🌍 Global Spatial Sandbox (全球物理空间沙盒)
基于自研的 **LGPA (Localized Geodesic Proximity Algorithm)** 算法，我们在 3D SVG 世界地图沙盘中实时可视化物理节点的空间漂移与网络降级轨迹。
通过清晰切分 `T1` (客户端到边缘), `T2` (边缘注入耗时), `T3` (边缘到源站)，我们能以极其直观的视觉动画，让你彻底告别盲目的黑盒故障注入。

### 💻 Immersive SRE Console (沉浸式 SRE 终端)
内置赛博朋克风格的交互式终端 (Interactive Terminal)，实时打印边缘拦截日志与 AI 仲裁的思维链过程。配合多维度的配额和使用量统计面板，精准管控 JWT Chaos Token 的分发与全局秒级吊销。

---

## 🏗 架构设计 (Architecture)

panic.design 采用了彻底的**控制面与数据面分离**的云原生架构设计：

```text
[ External Client ]  ◄─────►  [ panic.design Edge Gateway ]  ◄─────►  [ Target Host ]
    (W1 Ingress)                 (Global W2 Proxy Nodes)                (Upstream)
```

- **控制面 (Control Plane - `new_website`)**：
  基于 Next.js 16.2 App Router 搭建。负责完整的 OAuth 鉴权、D1 数据库管理、Token 配额限制与生成、以及 AIOps 提示词工程仲裁。控制面会通过 Web Crypto API 离线签发携带有故障配置 (Payload) 与目标坐标的高强度 JWT。
- **数据面 (Data Plane - `new_website_data`)**：
  采用极致轻量的 **Hono** 框架构建纯粹的无状态反向代理。它部署在 Cloudflare 全球 300+ 个 Workers 边缘节点上。单次请求可在 1ms 内完成 JWT 验签并提取混沌配置，对流量进行 L4/L7 的拦截、篡改和延迟注入，随后异步写入 SQLite (D1) 监控日志，确保测试过程对正常时延的干扰为零。

---

## 🚀 快速开始 (Getting Started)

### 环境要求 (Prerequisites)
- Node.js (v20+)
- Cloudflare 账号 & `wrangler` CLI (v4.95+)
- GitHub OAuth App (用于控制面登录)

### 部署步骤
1. 克隆代码库。
2. 在控制面 (`new_website`) 配置 `.dev.vars` (包含 `AUTH_SECRET`, `GITHUB_ID`, `TURNSTILE_SECRET_KEY` 等)。
3. 使用 `npx wrangler d1 execute DB --local --file=./prisma/schema.sql` 初始化数据库，并执行 `npm run dev` 启动控制台。
4. 进入 `new_website_data` 目录，部署边缘 Worker 代理。

---

## 💥 零侵入集成演示 (Zero-Intrusion Demo)

以下示例展示了当我们对 HTTP 流量注入 **Traffic Degradation (延迟降级)** + **Payload 篡改 (Unexpected EOF 截断)** 时，数据面的极致透明表现：

```bash
$ export PANIC_TOKEN="eyJhbG...9qu4MA"
$ curl -i "https://gateway.andrewwangdev.com/?token=$PANIC_TOKEN"

HTTP/1.1 200 OK
Date: Tue, 09 Jun 2026 06:14:15 GMT
Content-Type: text/html; charset=UTF-8
Transfer-Encoding: chunked
Connection: keep-alive
CF-Ray: a08dfeb1b9940d77-LAX
CF-Cache-Status: HIT
Age: 45
Cache-Control: public, max-age=43200
Last-Modified: Tue, 09 Jun 2026 01:36:29 GMT
Server: cloudflare
Vary: Origin, Accept-Encoding
Via: 2.0 heroku-router
Access-Control-Allow-Credentials: true
X-Powered-By: Express           <-- 【完全透传】源站应用的真实框架头
X-Ratelimit-Limit: 1000         <-- 【完全透传】源站真实限流规则
X-Ratelimit-Remaining: 996
X-Ratelimit-Reset: 1780985615

# ===== 以下为 panic.design 边缘节点追加的遥测头 ===== #
x-panic-colo: LAX               
# [解析] 边缘代理执行反代所在的机房码。如果你是在 Dashboard 运行 Cloud Injection，
# 这个参数代表控制面 (W1) 机房码；如果是在本地终端 curl，则代表数据面 (W2) 机房码。

x-panic-t2: 997                 
# [解析] 执行混沌注入 (Traffic Degradation) 所消耗的精准延迟毫秒数。

x-panic-t3: 20                  
# [解析] 数据面向上游源站 (W3) 请求的真实 RTT。

x-panic-w1: -118.2437,34.0522   
# [解析] 发起请求终端的估算经纬度。如果是在 Dashboard 运行，它代表浏览器公网 IP 估算位置；
# 若在本地终端运行，则代表你本地网络的公网 IP 位置。此参数用于 LGPA 算法测算。

x-panic-w3: 0,0                 
# [解析] 上游源站的 IP 估算经纬度。如果你在本地终端 curl，它始终为 0,0。
# 为什么？因为“上游目标 DNS 解析 + IP 定位”和“边缘混沌注入”是物理与逻辑彻底解耦的。
# 控制面在签发 Token 时已离线算好并存入 JWT 减少时延。本地纯净的 curl 缺乏 Dashboard 上下文，
# 数据面为了保证零侵入、不引入哪怕 1ms 的多余 DNS 查询耗时，默认置零。

Strict-Transport-Security: max-age=2592000
Speculation-Rules: "/cdn-cgi/speculation"
alt-svc: h3=":443"; ma=86400

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
......
<p><strong>Note

... [ERR_TCP_RESET: CONNECTION_DROPPED_BY_PEER] 
# [解析] 数据面按照 Unexpected EOF 策略强行制造的 Payload 截断点！

<script>(function(){function c(){var b=a.contentDocument||... // Cloudflare Bot Challenge 
# [补充说明] 这里截断后跟着的 <script> 是 Cloudflare 外部边缘基础设施自动追加的验证码防御代码，
# 它将我们强行截断的报错当成了正常 HTML 一部分，这完美证明了我们的网关已经成功骗过了最外层的清洗机制！
```

---

## 🏆 黑客松免责声明 / 团队 (Hackathon Notice)

本项目作为某大型全球 Hackathon 的参赛原型作品 (Prototype) 提交。
我们旨在探索 Serverless 与 AIOps 在下一代网络混沌工程 (Chaos Engineering) 中的极致可能性。
**Please DO NOT use this tool for malicious attacks or unauthorized DDoS simulations.** 

Built with 🔥 by Andrew Wang & Lin Yu.
