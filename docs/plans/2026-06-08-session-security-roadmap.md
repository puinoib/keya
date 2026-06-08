# Keya 会话安全与 Vault 架构重新设计

> 目标:在不依赖浏览器持久化任何可恢复秘密的前提下,做到"页面刷新(单 tab 或多 tab)不解锁状态丢失",浏览器重启可丢解锁状态。生物识别优先使用 PRF,但不支持 PRF 的浏览器也能用(non-PRF 仅作 UI 门)。

## 设计基线

- **vaultKey-centric**:`.keya` 文件用一份稳定的随机 DEK(`vaultKey`)加密 payload。密码和生物识别都只负责 wrap/unwrap `vaultKey`,不再直接驱动 payload 加密。
- **Service Worker 作为唯一秘密持有者**:`vaultKey` 只存在于 SW 的 module-scope RAM。主线程永远不持有 `password` 或 `vaultKey`。
- **跨 tab 共享**:同源所有 tab 共享同一个 SW。任何一个 tab 解锁,所有 tab 都解锁;任何一个 tab lock,所有 tab 同步 lock。
- **心跳保活**:页面每 10s 给 SW 发一次 heartbeat。SW 60s 没收到心跳就视为 abandoned,主动清 `vaultKey`。
- **不依赖 IndexedDB / sessionStorage 持久化秘密**:浏览器存储中只有非敏感 hints(`vaultId`、`fileName`、`lastSeenAt`),以及可选的 WebAuthn `credentialId`(用于 PRF 解锁时找到对应 credential)。

---

## §1 — 架构总览

```
┌────────────────────────────────────────────────────────────────┐
│ 主线程 (React)                                                  │
│                                                                 │
│  useStore                                                       │
│   ├─ workspaceState: welcome|locked|unlocked                   │
│   ├─ db: Database           ← 已解密的内存快照                  │
│   ├─ activeVaultFileName                                        │
│   └─ ❌ password / ❌ vaultKey  (永远不出现在主线程)             │
│                                                                 │
│  SessionRestore → 问 SW "有 vaultKey 吗"                       │
│  VaultPasswordDialog → 把 password 一次性发给 SW               │
│  BiometricPrompt → 触发 WebAuthn,结果送进 SW                   │
└─────────────────────────┬──────────────────────────────────────┘
                          │ postMessage (vaultKey 永远不跨界)
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ Service Worker (keya-sw.ts)  ← 同源所有 tab 共享                │
│                                                                 │
│  module-scope RAM:                                             │
│   ├─ vaultKey: Uint8Array | null    ← 唯一的秘密               │
│   ├─ vaultId / fileName                                         │
│   ├─ dbSnapshot: KeyaDatabase  ← 最新明文,供 autosave 增量用   │
│   ├─ fileHandle: FileSystemFileHandle  ← 接管磁盘 IO           │
│   ├─ lastHeartbeatAt                                            │
│   └─ autoLockDeadline                                           │
│                                                                 │
│  操作:                                                          │
│   ├─ unlock(password, fileHandle) → derive KEK → unwrap vKey  │
│   ├─ encryptAndSave(dbData) → 用 vaultKey 加密 → 写盘          │
│   ├─ reauth() → 心跳 + 检查 autoLock                            │
│   ├─ lock() → 清 vaultKey, 广播 locked 事件                    │
│   └─ getStatus() → { unlocked, vaultId }                       │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                   .keya 文件 (vaultKey-centric)
```

### 关键设计点

1. **vaultKey 是唯一的长期秘密**,且只存在于 SW 的 module-scope RAM。
2. **主线程永远不持有 password / vaultKey**,unlock 后 password 立即从 SW 局部变量清掉。
3. **SW 接管磁盘 IO**:主线程 unlock 时把 `FileSystemFileHandle` 通过 `postMessage` 转移给 SW,之后所有 save/read 都在 SW 内完成。
4. **多标签共享同一个 SW**:任何一个 tab 解锁,所有 tab 都解锁;任何一个 tab lock,全部同步 lock。
5. **心跳保活**:页面每 10s 给 SW 发一次 heartbeat,SW 60s 没收到心跳就视为 abandoned,主动清 vaultKey。
6. **没有 IndexedDB / sessionStorage 存任何秘密**,只有非敏感 hints(vaultId / fileName / lastSeenAt)。

---

## §2 — 文件格式 (vaultKey-centric)

完全重写 `.keya` 二进制格式。把"密钥"和"加密载荷"解耦,这样改密码 = rewrap,不再 re-encrypt 整个 payload。

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (128 bytes)                                             │
│   magic         "KEYA"                          4 B             │
│   version       uint16 LE = 1                   2 B             │
│   vault_id      UUID                            16 B             │
│   created_at    int64 LE (unix ms)              8 B             │
│   updated_at    int64 LE (unix ms)              8 B             │
│   argon2_ops    uint32 LE                       4 B             │
│   argon2_mem    uint32 LE (bytes)               4 B             │
│   argon2_salt   16 B (pwhash_SALTBYTES)                        │
│   flags         uint8 (bit0: has deviceWrap)    1 B             │
│   reserved      65 B (零填充)                                   │
├─────────────────────────────────────────────────────────────────┤
│  Password Wrap Block (固定 72 B)                                │
│   nonce         24 B                                            │
│   ciphertext    48 B                                            │
│     = XChaCha20-Poly1305(vaultKey, nonce, aad=Header)           │
│     (32 B vaultKey + 16 B Poly1305 tag)                         │
├─────────────────────────────────────────────────────────────────┤
│  Device Wrap Block (可选,104 B,flags.bit0=1 时存在)            │
│   nonce         24 B                                            │
│   ciphertext    48 B                                            │
│     = XChaCha20-Poly1305(vaultKey, nonce, aad=Header)           │
│   prf_salt      32 B  ← 用于 PRF 输出绑定的 salt               │
├─────────────────────────────────────────────────────────────────┤
│  Payload                                                        │
│   payload_len   uint32 LE                       4 B             │
│   nonce         24 B                                            │
│   ciphertext    N B                                             │
│     = XChaCha20-Poly1305(JSON(dbData), nonce,                   │
│                          aad=Header+WrapBlocks, key=vaultKey)   │
└─────────────────────────────────────────────────────────────────┘
```

### 关键点

1. **vaultKey 是 32 字节随机 DEK**,每次"改密码"时只 rewrap 这 32 字节,payload 不动。
2. **AEAD 替代独立 HMAC**:Poly1305 tag 同时认证 header 和 wrap blocks(作为 AAD),篡改任意字段都会让 unwrap 失败。
3. **改密码 ≠ 改 vaultKey**:用户改密码时,SW 用旧 `passwordKEK` unwrap 出 `vaultKey`,用新 `passwordKEK` 重新 wrap,写盘。`vaultKey` 本身不变,payload 不需要重新加密。
4. **Device Wrap Block 是 PRF 入口**:首次启用 PRF 时,SW 拿 PRF 输出 derive 出 `deviceKEK`,把 `vaultKey` 再 wrap 一份塞进去。冷启动可以用 Touch ID 解锁,不需要密码。
5. **argon2 参数写进 header**:`ops=3, mem=64MB` 是默认值,但写入文件让以后升级 KDF 强度时不需要破坏性格式变更。
6. **flags + reserved** 留扩展位(revision metadata、未来字段),不破坏解析。
7. **单 deviceWrapBlock 限制**:本设计只支持一份 deviceWrapBlock。需要多设备 PRF 时(例如同时用 Chrome 和 Safari),后续可扩展格式,但不在当前 spec 范围内。

### 与当前格式的差异

| 维度 | 当前实现 | 新设计 |
|---|---|---|
| 加密层级 | password → derivedKey → payload | password → KEK → wrap vaultKey → payload |
| 改密码 | 重新生成 masterSeed + 重加密整个 payload | 只 rewrap 32 B vaultKey |
| PRF 生物识别 | wrap password(绕回到密码中心) | wrap vaultKey(真正的 vaultKey-centric) |
| 整文件认证 | HMAC-SHA256 + payload AEAD | 全部走 AEAD AAD,无独立 HMAC |

---

## §3 — Service Worker 设计

### SW 的 module-scope 状态

```typescript
// keya-sw.ts 顶层变量,SW 死亡即丢失
let session: {
  vaultKey: Uint8Array | null;     // 唯一长期秘密
  vaultId: string;
  fileName: string;
  dirHandle: FileSystemDirectoryHandle;   // 接管磁盘
  fileHandle: FileSystemFileHandle;
  dbSnapshot: KeyaDatabase;               // 最新明文,save 用
  autoLockMinutes: number;
  lastActivityAt: number;                 // page 推送 TOUCH 时更新
  lastHeartbeatAt: number;                // page HEARTBEAT 时更新
} | null = null;
```

### 消息协议(page → SW)

| 消息 | payload | 返回 | 何时调用 |
|---|---|---|---|
| `STATUS` | — | `{ unlocked, vaultId, fileName }` | 页面加载/路由切换时探活 |
| `UNLOCK` | `{ password, dirHandle, fileHandle }` | `{ ok, dbSnapshot }` 或 `{ error }` | 用户输密码 |
| `UNLOCK_PRF` | `{ credential, prfOutput, dirHandle, fileHandle }` | `{ ok, dbSnapshot }` 或 `{ error }` | PRF 生物识别解锁 |
| `LOCK` | — | `{ ok }` | 用户手动 lock |
| `TOUCH` | — | `{ ok }` | 用户交互时(防抖) |
| `HEARTBEAT` | — | `{ ok }` | 每 10s 一次 |
| `SAVE` | `{ dbData }` | `{ ok }` 或 `{ conflict }` | autosave debounce 后 |
| `GET_DB` | — | `{ dbSnapshot }` | 多 tab 共享解锁时新 tab 拉数据 |
| `CHANGE_PASSWORD` | `{ oldPassword, newPassword }` | `{ ok }` 或 `{ error }` | 设置页改密码 |
| `ENROLL_PRF` | `{ credential, prfOutput, salt }` | `{ ok }` | 启用"Touch ID 解锁" |
| `DISABLE_PRF` | — | `{ ok }` | 关闭 PRF |
| `EXPORT` | `{ targetHandle }` | `{ ok }` | 导出 .keya 副本 |

### SW 主动广播(SW → 所有 client)

| 事件 | 含义 | page 反应 |
|---|---|---|
| `LOCKED` | vaultKey 已清,可能来自手动 lock / auto-lock / abandoned | 所有 tab 跳 locked 页 |
| `AUTO_LOCK_SOON` | 距 auto-lock 还剩 60s(可选 UX) | 弹"即将锁定"提示 |

### 心跳与生命周期

```
Page                    SW
 │                       │
 │── HEARTBEAT ─────────►│  更新 lastHeartbeatAt
 │      (每 10s)         │
 │                       │
 │                  每 5s 自检:
 │                  if (now - lastHeartbeatAt > 60s) → lock
 │                  if (now - lastActivityAt > autoLockMinutes*60s) → lock
```

**SW 死亡场景与处理:**

| 场景 | 结果 | 是否符合 spec |
|---|---|---|
| 单 tab 刷新(Cmd+R) | SW 通常存活(Chrome 给 ~30s 优雅期,刷新 <1s)→ STATUS 命中 → 恢复 | ✅ |
| 多 tab 中关一个 | 其他 tab 还在心跳,SW 不死 | ✅ |
| 全部 tab 关闭 | 60s 内无心跳 → SW 自杀清 vaultKey;再开 tab → STATUS → 重输密码 | ✅ 符合"重启可丢" |
| 浏览器重启 | SW 自然死亡,vaultKey 永远消失 | ✅ |
| 系统内存压力杀 SW | SW 重启后 session=null → page 第一次 STATUS 就知道要重输密码 | ✅ 低频 |

**关键决策:60s 心跳超时触发主动 lock**

这个超时不是"防攻击",是清理 abandoned session:用户合上电脑、tab 没关但页面被挂起(suspended)、网络断开等情况。SW 不能让 vaultKey 在没有活跃 client 的情况下继续留在 RAM。

### File System Access API 移交

```
1. 用户点 "Open Vault" → showDirectoryPicker()(需要 user gesture)
2. page 拿到 dirHandle → 列出 .keya 文件
3. 用户选 fileA.keya → page 通过 dirHandle.getFileHandle() 拿到 fileHandle
4. page 读 fileA 验证 magic + version → 显示密码框
5. 用户输密码 → page 调 SW.UNLOCK({ password, dirHandle, fileHandle })
6. SW 接管 dirHandle + fileHandle → 从此所有 IO 在 SW 内完成
7. page 不再持有任何 file handle
```

**好处:**

- 主线程拿不到 file handle,XSS 也写不进磁盘。
- SW 是唯一 save authority,避免 page 和 SW 各写各的导致竞态。
- 多 tab 共享 SW → 多 tab 写盘天然串行化。

### SW 注册与版本管理

- 应用启动时 `navigator.serviceWorker.register('/keya-sw.js', { type: 'module' })`。
- **主线程在 unlock 前必须 `await navigator.serviceWorker.ready`**:首次注册时 SW 异步 install + activate,这段时间内 `controller` 是 null,UNLOCK 消息会丢失。`ready` promise 解决后才保证 SW 已控制当前 page。
- SW 文件改动后,新版本会在 background install,old SW 控制当前 tab 直到所有 tab 关闭。
- 用户刷新后新 SW 接管 → 看到 `session=null` → 自动 redirect 到 locked。
- 这意味着 SW 升级 = vault 被锁一次。可以接受,但要在 release notes 提醒。
- **HTTPS 要求**:Service Worker 只在 HTTPS 或 `http://localhost` 下注册。生产部署已经满足(Cloudflare Pages 强制 HTTPS),dev 用 `localhost:5173` 也豁免。

---

## §4 — 完整时序

### 4.1 首次解锁(密码)

```
User         Page(React)          Service Worker          Disk
 │                │                      │                  │
 │ type password  │                      │                  │
 │───────────────►│                      │                  │
 │                │ UNLOCK{pw,h1,h2}     │                  │
 │                │─────────────────────►│                  │
 │                │                      │ read header      │
 │                │                      │─────────────────►│
 │                │                      │◄─────────────────│
 │                │                      │                  │
 │                │                      │ KEK=Argon2id(pw) │
 │                │                      │ vKey=AEAD.decrypt│
 │                │                      │   (wrapBlock)    │
 │                │                      │ db=AEAD.decrypt  │
 │                │                      │   (payload,vKey) │
 │                │                      │                  │
 │                │                      │ session = {      │
 │                │                      │   vaultKey:vKey, │
 │                │                      │   dbSnapshot:db, │
 │                │                      │   fileHandle,    │
 │                │                      │   ...            │
 │                │                      │ }                │
 │                │                      │                  │
 │                │ ◄──── {ok, db} ──────│                  │
 │                │                      │                  │
 │                │ useStore.db = db     │                  │
 │                │ workspaceState=      │                  │
 │                │   'unlocked'         │                  │
 │ show keys UI   │                      │                  │
 │◄───────────────│                      │                  │
```

**关键:** 密码在 SW 的 UNLOCK handler 局部变量里,函数返回前 clear。从此主线程永远拿不到密码。

### 4.2 单 tab 刷新

```
Cmd+R          Page(old)        SW             Page(new)
  │                │             │                 │
  │                │ unload      │                 │
  │                │──────►(死)  │                 │
  │                              │                 │
  │                              │  (SW 存活,      │
  │                              │   session 仍在) │
  │                              │                 │
  │                              │   STATUS?       │
  │                              │◄────────────────│
  │                              │ {unlocked:true, │
  │                              │  vaultId, ...}  │
  │                              │────────────────►│
  │                              │                 │
  │                              │  GET_DB?        │
  │                              │◄────────────────│
  │                              │ { dbSnapshot }  │
  │                              │────────────────►│
  │                              │                 │
  │                              │                 │ useStore.db = db
  │                              │                 │ workspaceState =
  │                              │                 │   'unlocked'
  │                              │                 │
  │                              │  HEARTBEAT      │
  │                              │◄────────────────│ (恢复心跳)
```

**为什么能恢复:** SW 在 page unload 到 reload 之间没有死亡。Chrome 的 SW 在还有"controlling client"或最近活跃 client 时不会立即 stop。Cmd+R 整个过程通常 <1s,SW 的 idle-stop 默认 30s+,所以基本不会断。

**极端情况:** 如果 SW 恰好在 unload 间隙被 browser 杀了(内存压力等),`STATUS` 返回 `{unlocked:false}` → page 走 locked 流程,要求重输密码。这种概率低,且符合"丢失状态可接受"的精神。

### 4.3 多 tab:Tab B 打开

```
Tab A (unlocked)    SW              Tab B (new)
      │              │                   │
      │              │                   │ load
      │              │                   │ STATUS?
      │              │◄──────────────────│
      │              │ {unlocked:true,   │
      │              │  vaultId, ...}    │
      │              │──────────────────►│
      │              │                   │
      │              │                   │ GET_DB?
      │              │◄──────────────────│
      │              │ { dbSnapshot }    │
      │              │──────────────────►│
      │              │                   │
      │              │                   │ unlock silently
      │              │                   │ show keys UI
      │              │                   │
      │              │  HEARTBEAT (10s)  │
      │              │◄──────────────────│
      │  HEARTBEAT   │                   │
      │─────────────►│                   │
```

**Tab B 不需要密码**,因为 SW 已经持有 vaultKey。两个 tab 的心跳共同保活 SW。

### 4.4 手动 Lock(多 tab 同步)

```
Tab A           SW              Tab B
  │              │                 │
  │ click "Lock" │                 │
  │─────────────►│                 │
  │              │ session = null  │
  │              │ broadcast LOCKED│
  │              │────────────────►│ (Tab A)
  │              │────────────────►│ (Tab B)
  │              │                 │
  │ redirect to  │                 │ redirect to
  │ locked page  │                 │ locked page
```

**Lock 是全局事件**,所有 tab 立即跳转。SW 清掉 vaultKey,后续 STATUS 返回 false。

### 4.5 Auto-lock

```
                SW internal timer (每 5s)
                        │
                        │ check:
                        │   idle = now - lastActivityAt
                        │   if (idle > autoLockMinutes * 60s):
                        │     session = null
                        │     broadcast LOCKED
                        │
                        ▼
            所有 tab 收到 LOCKED → 跳 locked 页
```

`lastActivityAt` 由 page 在用户交互(键盘/鼠标/聚焦)时防抖推送 TOUCH 更新。

**Auto-lock 分钟数=0** = 永不 auto-lock。SW 仍然会因 60s 心跳超时或浏览器重启而清 vaultKey。

### 4.6 PRF 生物识别解锁(冷启动)

适用场景:用户之前在设置里启用了"Touch ID 解锁"(ENROLL_PRF 已写过 deviceWrapBlock)。

```
User         Page              SW              Authenticator
 │              │                │                   │
 │ click        │                │                   │
 │ "Touch ID"   │                │                   │
 │─────────────►│                │                   │
 │              │ WebAuthn.get({ │                   │
 │              │   prf:{eval:   │                   │
 │              │     {salt}}})  │                   │
 │              │───────────────────────────────────►│
 │              │                │                   │
 │ Touch sensor │                │                   │ (用户碰指纹)
 │◄──────────────────────────────────────────────────│
 │              │                │                   │
 │              │ ◄─ prfOutput ──────────────────────│
 │              │                │                   │
 │              │ UNLOCK_PRF{cred, prfOutput,        │
 │              │            dirHandle, fileHandle}  │
 │              │───────────────►│                   │
 │              │                │                   │
 │              │                │ deviceKEK = HKDF( │
 │              │                │   prfOutput)      │
 │              │                │ vKey = AEAD.decrypt│
 │              │                │   (deviceWrapBlock)│
 │              │                │                   │
 │              │                │ session = {...}  │
 │              │                │                   │
 │              │ ◄── {ok, db} ──│                   │
 │              │                │                   │
 │ unlock silently, show keys UI │                   │
```

**关键:** PRF 路径完全不经过密码。`prfOutput` 永远不离开 authenticator(在 Secure Enclave / TPM 里),page 和 SW 只拿到 derive 后的 `deviceKEK` 用来 unwrap vaultKey。

### 4.7 Non-PRF 浏览器:生物识别只能 warm re-auth

PRF 不支持时(Firefox 已排除,旧 Safari),生物识别的角色降级。SW 没有 vaultKey 时无法 unlock,生物识别不能"替代密码冷启动"。

### 4.8 Non-PRF 生物识别:仅作 auto-lock 内的 UI 门

更细的场景:用户离开 5 分钟触发 auto-lock 之前,SW 其实还持有 vaultKey(因为没到 deadline,或 autoLockMinutes=0)。此时出于安全考虑,page 应该要求 re-auth 才显示敏感内容。

```
User         Page              SW
 │              │                │
 │ 回来,切换    │                │
 │ 到 keya tab  │                │
 │─────────────►│                │
 │              │                │
 │              │ 显示 "Touch ID │
 │              │  重新解锁" 蒙层│
 │              │                │
 │ click Touch  │                │
 │  ID          │                │
 │─────────────►│                │
 │              │ WebAuthn.get   │
 │              │ (assertion,    │
 │              │  无 PRF)       │
 │              │─────►(成功)    │
 │              │                │
 │              │ GET_DB?        │
 │              │───────────────►│
 │              │ ◄── {db} ──────│
 │              │                │
 │              │ 取消蒙层,      │
 │              │ 显示 keys UI   │
```

**含义:** 这层生物识别是 UX 装饰,**不是真正的安全边界** —— 因为 SW 仍然持有 vaultKey,任何同源代码都能直接调 STATUS + GET_DB。它的作用是"防止偷瞄":同事路过你的电脑时,看到的是 Touch ID 蒙层而不是 keys。

PRF 浏览器则可以把这层 UX 升级成真正的安全边界(每次都重新走 PRF unwrap)。

### 4.9 切换 vault

用户在已解锁 vault A 的状态下打开 vault B:

```
Page                              SW
  │                                │
  │ user picks vault B             │
  │ UNLOCK {passwordB, hB1, hB2}   │
  │───────────────────────────────►│
  │                                │
  │                       session = null  ← 先清掉 vault A 的状态
  │                       (lock A 隐式触发,但不广播 LOCKED,
  │                        因为马上要 unlock B)
  │                                │
  │                       derive KEK from passwordB
  │                       unwrap vaultKey B
  │                       session = { vaultKey: B, ... }
  │                                │
  │ ◄────── {ok, dbB} ─────────────│
  │                                │
  │ useStore.db = dbB              │
  │ activeVaultFileName = B        │
```

**单 vault 模型**:SW 同时只持有一个 session。切换 = 替换。多 tab 中,任一 tab 切 vault,所有 tab 自动切到新 vault(因 SW session 改变)。这与当前 Keya UX 一致。

---

## §5 — 改密码 / Save / PRF Enroll

### 5.1 改密码 = rewrap vaultKey

这是 vaultKey-centric 架构最大的胜利 —— 改密码不再触碰 payload。

```
User          Page              SW                    Disk
 │              │                 │                     │
 │ old pw,new pw│                 │                     │
 │─────────────►│                 │                     │
 │              │ CHANGE_PASSWORD │                     │
 │              │ {old,new}       │                     │
 │              │────────────────►│                     │
 │              │                 │                     │
 │              │                 │ 1. oldKEK =         │
 │              │                 │    Argon2id(old,    │
 │              │                 │    existing_salt)   │
 │              │                 │ 2. vKey = AEAD      │
 │              │                 │    .decrypt         │
 │              │                 │    (wrapBlock,oldKEK)│
 │              │                 │ 3. newSalt = random │
 │              │                 │ 4. newKEK =         │
 │              │                 │    Argon2id(new,    │
 │              │                 │    newSalt)         │
 │              │                 │ 5. newWrap = AEAD   │
 │              │                 │    .encrypt(vKey,   │
 │              │                 │    newKEK)          │
 │              │                 │ 6. 重写 header +    │
 │              │                 │    wrapBlock        │
 │              │                 │    (payload 不动)   │
 │              │                 │────────────────────►│
 │              │                 │                     │
 │              │                 │ session.vaultKey    │
 │              │                 │   不变,仍持有原值  │
 │              │                 │                     │
 │              │ ◄─── {ok} ──────│                     │
 │              │                 │                     │
 │ show "密码已 │                 │                     │
 │  更新" toast │                 │                     │
```

**关键点:**

- 步骤 2 拿到 vaultKey,步骤 5 用新 KEK 包回去,**vaultKey 本身不变**。
- payload ciphertext 完全不动(几十 KB ~ 几 MB 数据零拷贝)。
- Argon2id 是耗时大头(~1s),但只跑两次(old + new),不是按 payload 大小线性放大。
- SW 内部 `session.vaultKey` 持续有效,用户改完密码不需要重新解锁。
- 改密码后 `argon2_salt` 必须换新 —— 同一个 salt + 不同密码虽然 KEK 不同,但用旧 salt 等于泄露"我曾经用过这个 salt",无意义且增加 replay 表面。

### 5.2 Autosave 流程

```
User edits key  →  useStore.db 变更  →  scheduleSave (500ms debounce)
                                              │
                                              ▼
                                  page sends SW.SAVE({dbData})
                                              │
                                              ▼
                                       SW handler:
                                       1. session.dbSnapshot = dbData
                                       2. ciphertext = AEAD.encrypt(
                                            JSON(dbData),
                                            vaultKey,
                                            nonce=fresh random)
                                       3. 重写整文件 (header + wrapBlock + payload)
                                       4. fsync
                                              │
                                              ▼
                                          返回 {ok}
```

**为什么仍然要重写整文件,而不是只重写 payload 段?**

文件结构是顺序布局 `[Header][Wrap][Payload]`,payload 长度变化时无法原地更新。Rewrite 整文件 + atomic rename 是最稳的做法。对小文件(几十 KB ~ 几 MB)成本可忽略。

**Atomic write 策略:**

不变量:任何崩溃点之后,`vault.keya` 文件必须是完整的(要么旧版完整,要么新版完整),不允许半截写。

实现方式按浏览器能力降级:

1. **优先(`FileSystemFileHandle.move` 可用,Chrome 较新版本)**:
   - 写 `vault.keya.tmp`(同目录)
   - `fsync` close
   - `tmpHandle.move('vault.keya')`(原子替换,自动覆盖旧文件)

2. **回退(`move` 不支持)**:
   - 写 `vault.keya.tmp`
   - `fsync` close
   - 读旧 `vault.keya` 备份到 `vault.keya.bak`(若存在)
   - 覆写 `vault.keya`(createWritable + write + close)
   - `fsync` close
   - 删除 `vault.keya.bak` 与 `vault.keya.tmp`

3. **启动时清理**:
   - 若存在 `vault.keya.tmp` → 删除(上次写到一半)
   - 若存在 `vault.keya.bak` 且 `vault.keya` 校验失败 → 用 `vault.keya.bak` 恢复

回退路径在"覆写 vault.keya"这一步不是真原子,但通过 `vault.keya.bak` 备份可以在崩溃后恢复到旧版完整状态。

### 5.3 Save Authority 边界

**重要:** 主线程永远不直接写 `.keya` 文件。所有写盘都走 SW。

| 操作 | 当前实现 | 新设计 |
|---|---|---|
| autosave | page: scheduleSave → FileStorage.saveVault(password, db) | page → SW.SAVE |
| 手动保存 | page → FileStorage.saveVault | page → SW.SAVE |
| 导出 .keya | page: TopBar 直接调 saveVault | page → SW.EXPORT |
| 改密码 | page: 用 password 重加密 payload | page → SW.CHANGE_PASSWORD |
| PRF enroll | page → biometric.ts → IndexedDB | page → SW.ENROLL_PRF |

主线程代码删除所有 `password` / `vaultKey` 字段。`useStore` 也不再持有 password。

### 5.4 PRF Enroll("启用 Touch ID 解锁")

```
User           Page              SW              Authenticator    Disk
 │               │                 │                   │           │
 │ toggle "Touch │                 │                   │           │
 │ ID unlock" ON │                 │                   │           │
 │──────────────►│                 │                   │           │
 │               │                 │                   │           │
 │               │ WebAuthn.create │                   │           │
 │               │ ({prf:{seed}})  │                   │           │
 │               │────────────────────────────────────►│           │
 │ Touch sensor  │                 │                   │           │
 │◄────────────────────────────────────────────────────│           │
 │               │                 │                   │           │
 │               │ ◄─ {cred, prfOutput} ───────────────│           │
 │               │                 │                   │           │
 │               │ ENROLL_PRF      │                   │           │
 │               │ {cred, prfOut,  │                   │           │
 │               │  salt}          │                   │           │
 │               │────────────────►│                   │           │
 │               │                 │                   │           │
 │               │                 │ deviceKEK = HKDF(│           │
 │               │                 │   prfOutput,      │           │
 │               │                 │   "keya-device-   │           │
 │               │                 │   kek")           │           │
 │               │                 │ deviceWrap =      │           │
 │               │                 │   AEAD.encrypt(   │           │
 │               │                 │     vaultKey,     │           │
 │               │                 │     deviceKEK)    │           │
 │               │                 │ flags.bit0 = 1    │           │
 │               │                 │ 重写 header +     │           │
 │               │                 │   deviceWrapBlock │──────────►│
 │               │                 │                   │           │
 │               │                 │ 存 cred_id 到     │           │
 │               │                 │   IndexedDB       │           │
 │               │                 │   (非敏感,可选)  │           │
 │               │                 │                   │           │
 │               │ ◄─── {ok} ──────│                   │           │
```

**IndexedDB 里存什么:**

只存 `credentialId`(公开字段,WebAuthn credential 的 ID)和 `prf_salt`,用来下次 unlock 时知道用哪个 credential + 哪个 salt 调 PRF。**不存任何密钥材料**。

### 5.5 关闭 PRF

```
User            Page              SW              Disk
 │ toggle OFF     │                 │               │
 │───────────────►│                 │               │
 │                │ DISABLE_PRF     │               │
 │                │────────────────►│               │
 │                │                 │ flags.bit0 = 0│
 │                │                 │ 移除 device-  │
 │                │                 │   WrapBlock   │
 │                │                 │ 重写文件      │──────────►
 │                │                 │ 清 IndexedDB  │
 │                │                 │   credentialId│
 │                │ ◄─── {ok} ──────│               │
```

vaultKey 不变,payload 不动,只是删掉一份 wrap。下次 unlock 只能走密码或重新 enroll。

### 5.6 改密码 vs PRF Enroll 的关系

| 场景 | vaultKey | passwordWrap | deviceWrap |
|---|---|---|---|
| 初始创建 | 随机生成 | 包裹 vKey | 无 |
| 改密码 | **不变** | 重新包裹 | 不动 |
| 启用 PRF | **不变** | 不动 | 新增包裹 |
| 关闭 PRF | **不变** | 不动 | 删除 |
| 改密码 + 启用 PRF | **不变** | 重新包裹 | 新增包裹 |

vaultKey 在 vault 生命周期内**永远不变**,除非用户主动"重置 vault 密钥"(高级功能,不在 spec 范围)。

---

## §6 — 生物识别决策树与浏览器降级

### 6.1 运行时 PRF 能力探测

页面启动时跑一次 PRF 能力探测,缓存结果:

```typescript
async function detectPrfSupport(): Promise<'prf' | 'platform-only' | 'none'> {
  if (!window.PublicKeyCredential) return 'none';
  
  const platformOk = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!platformOk) return 'none';
  
  // PRF 探测:用一个虚拟 assertion 测浏览器是否会处理 prf extension
  // (Chrome 116+ 在 clientExtensionResults 里回填 prf.results)
  try {
    const probe = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(1),
        allowCredentials: [],
        extensions: { prf: { eval: { salt: new Uint8Array(32) } } }
      }
    });
    // 实际拿到 probe 没意义,看 browser 有没有 ack extension
    return probe?.getClientExtensionResults?.()?.prf ? 'prf' : 'platform-only';
  } catch {
    return 'platform-only';
  }
}
```

(真实实现可能需要更复杂的探测,这里只示意思路。结果在 SW 也存一份,避免每次解锁都跑探测。)

### 6.2 解锁时决策树

```
用户点击 / 页面加载
       │
       ▼
   有 deviceWrapBlock?
   (flags.bit0 == 1)
       │
   ┌───┴───┐
   │       │
  Yes      No
   │       │
   ▼       ▼
浏览器支持  ┌─────────────────┐
PRF?       │ 直接走密码解锁   │
   │       │ (password UI)   │
   ├───┐   └─────────────────┘
   │   │
  Yes  No
   │   │
   │   ▼
   │   ┌─────────────────────────┐
   │   │ 文件里有 deviceWrapBlock│
   │   │ 但本浏览器不支持 PRF   │
   │   │ → 提示 + 走密码        │
   │   └─────────────────────────┘
   │
   ▼
尝试 UNLOCK_PRF
   │
   ├─── 成功 → 解锁
   │
   └─── 失败 (Touch ID 取消/指纹不对)
       │
       ▼
   回退到密码 UI
```

**关键:deviceWrapBlock 在文件里是"已登记"标记,但本浏览器有没有 PRF 能力是运行时决定。** 文件可以在 Chrome 上 PRF enroll,然后文件传到 Firefox 上,Firefox 走密码路径。

### 6.3 设置页 UI

```
┌────────────────────────────────────────────────┐
│ Security                                       │
├────────────────────────────────────────────────┤
│ Auto-lock                                      │
│   [ 5 minutes ▼ ]                              │
│                                                │
│ Biometric unlock                               │
│   ┌──────────────────────────────────────────┐ │
│   │ Touch ID unlock            [ON/OFF]      │ │
│   │                                          │ │
│   │ ⚠ Strong mode (PRF)      ✓ Enabled      │ │
│   │   Use Touch ID instead of password on    │ │
│   │   cold start                             │ │
│   │                                          │ │
│   │ ⚠ Compatibility mode                    │ │
│   │   Touch ID only re-shows UI after        │ │
│   │   auto-lock, not for cold start          │ │
│   └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

PRF 浏览器看到 strong mode 已启用;non-PRF 浏览器看到 compatibility mode,并提示"切到 Chrome 可启用 strong mode"。

### 6.4 浏览器能力矩阵

| 浏览器 | File System Access | Service Worker | WebAuthn PRF | 平台 authenticator | 解锁路径 |
|---|---|---|---|---|---|
| Chrome 116+ (Win/Mac) | ✅ | ✅ | ✅ | Windows Hello / Touch ID | 密码 / PRF / 兼容 |
| Edge 116+ | ✅ | ✅ | ✅ | Windows Hello | 密码 / PRF / 兼容 |
| Safari 17+ (Mac/iOS) | ✅ (15.2+,读写) | ✅ | ⚠ TP only (17.4 部分) | Touch ID / Face ID | 密码 / 兼容 |
| Firefox | ❌ | ✅ | ❌ | — | **不支持整个应用** |
| Chrome (Linux) | ✅ | ✅ | ✅ | (依赖硬件) | 密码 / 兼容 |

**应用门槛:File System Access API 是硬性要求**(当前 Keya 已经是),所以 Firefox 早就排除。剩下 Chromium 系列基本都支持 PRF,Safari 是主要 non-PRF 用户群。

### 6.5 降级行为汇总

| 能力缺失 | 行为 |
|---|---|
| 无 Service Worker 支持 | 应用拒绝启动,显示"请用 Chrome/Edge/Safari"。当前 Keya 已经依赖 File System Access API,门槛一致。 |
| 无 WebAuthn 平台 authenticator | PRF 选项灰显,只走密码。 |
| 无 PRF,但有平台 authenticator | PRF enroll 不可用;PRF unlock 不可用;auto-lock 后的 Touch ID 蒙层仍可用(仅作 UI 门)。 |
| 无 PRF,无平台 authenticator | 生物识别完全不可用,只走密码。 |
| 浏览器杀掉 SW(罕见) | page 第一次 STATUS 拿到 `unlocked:false` → 跳 locked 页 → 重输密码。 |

### 6.6 错误恢复场景

| 场景 | 处理 |
|---|---|
| Touch ID 三次失败 | WebAuthn 抛错 → page 弹"密码"框,PRF 路径自动降级到密码 |
| 用户在 Chrome enroll,文件传到 Firefox | Firefox 看到文件有 deviceWrapBlock 但本机 PRF 不支持 → 走密码,UI 提示"在 Chrome 上启用 strong mode" |
| PRF 输出和文件 wrap 不匹配(用户换 authenticator) | UNLOCK_PRF AEAD 解密失败 → 回退到密码 |
| SW 升级,session=null | STATUS 返回 false → 自动 redirect 到 locked,要求重输密码(无需特殊处理) |
| vault.tmp 写到一半断电 | 重启后 page 看到 `vault.keya` 还是旧版完整 + `vault.tmp` 残留 → 启动时清理 tmp → 用户无感 |

---

## §7 — 测试策略与验收标准

### 7.1 测试金字塔

```
        ┌──────────────────┐
        │   E2E (Playwright)│  ~10 tests
        │   SW 真实生命周期 │  刷新/多 tab/PRF/lock 广播
        └──────────────────┘
       ┌────────────────────┐
       │ Integration        │  ~30 tests
       │ (Vitest + jsdom    │  消息协议、状态机、文件 IO mock
       │  + SW handler 提取)│
       └────────────────────┘
      ┌──────────────────────┐
      │ Unit (Vitest)        │  ~80 tests
      │ 纯函数:crypto /     │  wrap/unwrap/KDF/格式 round-trip
      │ 文件格式 / 决策树    │
      └──────────────────────┘
```

### 7.2 单元测试覆盖

#### `src/core/__tests__/crypto.test.ts`(扩展)

| 测试 | 验证点 |
|---|---|
| `wrapVaultKey(vaultKey, kek)` ↔ `unwrapVaultKey` round-trip | wrap 后能 unwrap 回原值 |
| 错误 KEK unwrap | AEAD 抛 `Decryption failed` |
| AAD 篡改(header 改 1 byte) | unwrap 失败 |
| `derivePasswordKEK(password, salt, ops, mem)` 确定性 | 同输入同输出 |
| 不同 salt → 不同 KEK | 是 |
| HKDF derive deviceKEK from PRF output | 32 B 输出,同 prf+salt 同输出 |

#### `src/core/__tests__/schema.test.ts`(重写)

| 测试 | 验证点 |
|---|---|
| `serializeToFile(dbData, vaultKey, passwordKEK)` round-trip | parse 回来等价 |
| Header magic 错 | parse 抛错 |
| Version 不匹配 | parse 抛错 |
| WrapBlock nonce 篡改 | unwrap 失败 |
| Payload ciphertext 篡改 | AEAD 失败 |
| `flags.bit0=0` 时跳过 deviceWrapBlock | parse 不读越界 |
| `flags.bit0=1` 但无 deviceWrapBlock 数据 | parse 抛错 |
| 大 payload (1 MB JSON) round-trip | 字节级一致 |
| `rewriteHeaderAndWrapBlocks(newHeader, newWrap, existingPayloadBytes)` | payload 字节不变,header/wrap 替换(用于改密码) |

#### `src/app/lib/__tests__/session-hints.test.ts`(扩展)

| 测试 | 验证点 |
|---|---|
| Hints 不含 vaultKey/password | 是 |
| Touch 不变 identity | tabId/resumeToken 持续 |
| Lock 时清 hints + IndexedDB credentialId | 是 |

#### `src/app/sw/__tests__/handlers.test.ts`(新增,SW 逻辑提取成纯函数)

把 SW 的 message handler 写成可注入 session state 的纯函数,不依赖 `self`:

```typescript
// 提取前 (难测):
self.onmessage = (e) => { ... session.vaultKey ... }

// 提取后 (易测):
export function handleUnlock(state: SessionState, req: UnlockReq): { state, resp } { ... }
```

| 测试 | 验证点 |
|---|---|
| `handleUnlock` 正确密码 | 返回 `{ok, db}`,state.vaultKey 已设 |
| `handleUnlock` 错误密码 | 返回 `{error}`,state.vaultKey 仍 null |
| `handleUnlock` 后 `handleStatus` | unlocked=true |
| `handleLock` 后 `handleStatus` | unlocked=false |
| `handleHeartbeat` 更新 lastHeartbeatAt | 是 |
| `handleSave` 加密 + 写盘 | fileHandle.write 被调,密文写入 |
| `handleChangePassword` 错误 old password | 返回 error |
| `handleChangePassword` 正确 | vaultKey 不变,新 wrapBlock 写盘,payload 字节不变 |
| `handleEnrollPrf` | 新增 deviceWrapBlock,flags.bit0=1 |
| `handleUnlockPrf` 无 deviceWrapBlock | 返回 error 提示走密码 |
| Auto-lock check 函数 (idle > deadline) | 返回 shouldLock=true |
| Heartbeat-timeout check (no hb > 60s) | 返回 shouldLock=true |

### 7.3 集成测试

用 Vitest + `MessageChannel` mock SW 双向通信:

```typescript
// 把 SW 当作黑盒,通过 postMessage 双向通信
const { clientPort, swPort } = createMessageChannelPair();
installSwHandler(swPort);  // 加载真实 SW handler
// 用 clientPort 发消息,验证响应
```

| 测试 | 验证点 |
|---|---|
| UNLOCK → STATUS → GET_DB 完整流程 | 三步都正确 |
| UNLOCK → LOCK → STATUS | STATUS 在 LOCK 后 unlocked=false |
| UNLOCK → 60s 无心跳 → STATUS | unlocked=false (abandoned lock) |
| UNLOCK → auto-lock 到期 → LOCKED 广播 | 收到广播 |
| 改密码后旧密码 UNLOCK 失败 | 是 |
| 改密码后新密码 UNLOCK 成功 | 是 |
| ENROLL_PRF → UNLOCK_PRF | 成功 |
| DISABLE_PRF → UNLOCK_PRF | 失败 |

### 7.4 E2E 测试(Playwright)

E2E 是唯一能真实跑 SW 的层。

| 测试 | 步骤 | 验证 |
|---|---|---|
| 解锁 + 刷新 | 解锁 → 等 1s → reload → 等 2s | 自动恢复 unlocked,看到 keys UI |
| 解锁 + 关 tab + 立刻重开 | 解锁 → close page → new page → navigate | SW 仍存活(60s 内)→ 自动恢复 |
| 解锁 + 关 tab + 等 70s + 重开 | 同上但等 70s | SW 已 lock → 看到密码框 |
| 手动 lock 多 tab | tab A lock → 检查 tab B | tab B 自动跳 locked 页 |
| Auto-lock | autoLockMinutes=1,解锁,等 65s | 自动 lock |
| 改密码 | 设置页改密码 → 关 tab → 重开 → 用旧密码 | 失败 |
| 改密码 | 同上 → 用新密码 | 成功 |
| PRF enroll + cold start unlock | enroll → close all tabs → reopen → click Touch ID | 自动 unlock |
| PRF 取消 → 回退密码 | unlock 时 Touch ID 弹窗 → cancel | 看到密码框 |
| 文件篡改 | 解锁 → 在文件管理器改 vault.keya 1 byte → 保存 | SAVE 抛错,UI 提示文件损坏 |
| Atomic write 中断 | 模拟 SAVE 时 page crash → 重启 | 看到 vault.tmp → 自动清理 → vault.keya 仍是旧版完整 |

### 7.5 验收标准(用户视角)

| # | 标准 | 怎么验证 |
|---|---|---|
| AC1 | 单 tab 刷新不解锁状态丢失 | E2E: reload → 仍显示 keys UI |
| AC2 | 多 tab 共享解锁 | E2E: tab A unlock → tab B 打开自动 unlocked |
| AC3 | 任一 tab lock → 所有 tab 同步 lock | E2E: 验证 |
| AC4 | 浏览器重启后必须重输密码 | 手动: 关浏览器 → 重开 → 看 locked 页 |
| AC5 | PRF 浏览器支持 Touch ID 替代密码冷启动解锁 | E2E on Chrome |
| AC6 | non-PRF 浏览器 auto-lock 后 Touch ID 可重新显示 UI(仅 UI 门) | E2E on Safari |
| AC7 | 改密码不重加密整个 payload | 单元测试验证 payload 字节不变 |
| AC8 | 浏览器存储(IndexedDB/localStorage/sessionStorage)不含 vaultKey 或 password | 手动 inspect DevTools |
| AC9 | 主线程全局 state(useStore)无 password / vaultKey 字段 | `grep password src/app/store/useStore.ts` 无业务字段 |
| AC10 | SW 死亡后页面优雅降级到 locked | 单元 + E2E |

### 7.6 不在范围内

| 项目 | 原因 |
|---|---|
| 保存前冲突检测(compare-before-save) | 独立 feature,可后续添加 |
| 多设备 PRF(一个 vault 多个 deviceWrapBlock) | 单 block 已满足单人使用,扩展时再加 |
| 跨浏览器重启 PRF 解锁(无密码) | 与"重启可丢"冲突,设计上排除 |
| Vault 密钥重置(regenerate vaultKey) | 高级功能,后续 |
| 移动端 PWA 支持 | 当前 Keya 是桌面应用,移动端另行规划 |

---

## §8 — 受影响的代码

### 新增

| 文件 | 职责 |
|---|---|
| `public/keya-sw.js` | Service Worker 入口(必须放在 `public/`,确保 origin root 可访问) |
| `src/app/sw/handlers.ts` | SW 消息处理函数(纯函数,可单测) |
| `src/app/sw/protocol.ts` | 消息类型定义、序列化 |
| `src/app/sw/client.ts` | 主线程侧 SW RPC 客户端 |
| `src/app/sw/heartbeat.ts` | 心跳 + auto-lock 推送 hook |

### 重写

| 文件 | 原因 |
|---|---|
| `src/core/schema.ts` | 新文件格式(vaultKey-centric) |
| `src/core/crypto.ts` | 新增 `wrapVaultKey` / `unwrapVaultKey` / `derivePasswordKEK` / `deriveDeviceKEK` |
| `src/app/store/useStore.ts` | 移除 `password` 字段,所有写操作改为 RPC 调 SW |
| `src/app/lib/biometric.ts` | PRF 路径走 SW.ENROLL_PRF,non-PRF 只做 UI 门 |
| `src/app/components/SessionRestore.tsx` | 改为 SW.STATUS → GET_DB |

### 删除

| 文件 | 原因 |
|---|---|
| `src/app/lib/session-worker.ts` | SharedWorker 替换为 Service Worker |
| `src/app/lib/session-broker.ts` | 同上 |

### 修改

| 文件 | 修改点 |
|---|---|
| `src/app/components/vault/VaultPasswordDialog.tsx` | 输密码后调 `sw.unlock()` 而不是本地解密 |
| `src/app/components/vault/BiometricPrompt.tsx` | 区分 PRF / non-PRF 路径 |
| `src/app/components/settings/GeneralPage.tsx` | 改密码 / PRF enroll 走 SW |
| `src/app/components/layout/TopBar.tsx` | 导出走 SW.EXPORT |
| `src/app/hooks/useAutoLock.ts` | 简化为发 TOUCH,auto-lock 由 SW 计算 |
| `src/app/lib/storage.ts` | `setupWorkspace` / `listVaultFiles` 仍由 page 处理(读目录);`openVault` 改为返回 `(dirHandle, fileHandle)` 给 SW,主线程不再直接 save |
| `src/help/content/security.md` | 文档同步更新 |
| `vite.config.ts` | 配置 SW 构建(`vite-plugin-pwa` 或自定义) |

---

## §9 — 实施顺序

### Phase 0 — 准备(无功能改动)

- 新增 `src/core/crypto.ts` 的 wrap/unwrap/KDF 函数,与现有 `encrypt/decrypt` 并存。
- 新增 `src/core/schema.ts` 的新格式 parser/serializer,与旧格式并存(测试用)。
- 跑通"纯函数 wrap → unwrap → verify" round-trip 单测。

### Phase 1 — Service Worker 骨架

- 新增 `public/keya-sw.js` + `src/app/sw/*`。
- 实现 STATUS / UNLOCK / LOCK / HEARTBEAT / TOUCH / GET_DB。
- 主线程 `useStore` 仍保留 password,但 unlock 流程同时走 SW。
- 主线程写盘逻辑暂时保留,SW 只读。
- 验证刷新恢复 + 多 tab 共享 + auto-lock。

### Phase 2 — Save Authority 移交

- SW 实现 SAVE / CHANGE_PASSWORD / EXPORT。
- 主线程删除 `password` 字段。
- 主线程删除直接写盘逻辑。
- 验证 autosave + 改密码 + 导出。

### Phase 3 — PRF 集成

- SW 实现 ENROLL_PRF / DISABLE_PRF / UNLOCK_PRF。
- 文件格式 deviceWrapBlock 接入。
- 设置页 PRF UI。
- PRF 解锁 + 取消回退。

### Phase 4 — 清理与文档

- 删除 `session-worker.ts` / `session-broker.ts`。
- 删除 `src/core/schema.ts` 中的旧格式代码。
- 删除 `src/core/crypto.ts` 中不再用的旧派生函数。
- 帮助文档同步更新。

---

## §10 — 成功标准

如果这个设计完整落地,以下标准成立:

- ✅ 浏览器存储(sessionStorage / localStorage / IndexedDB)不含 vaultKey 或 password。
- ✅ 主线程全局 state(useStore)无 password / vaultKey 字段。
- ✅ 单 tab 刷新不解锁状态丢失(刷新前 unlocked → 刷新后仍 unlocked)。
- ✅ 多 tab 共享解锁,lock 全局同步。
- ✅ 浏览器重启后必须重输密码(无持久化秘密)。
- ✅ PRF 浏览器支持 Touch ID 替代密码冷启动解锁。
- ✅ Non-PRF 浏览器仍可用,生物识别作 UI 门。
- ✅ 改密码不重加密整个 payload,只 rewrap 32 B vaultKey。
- ✅ SW 异常死亡后页面优雅降级到 locked。
- ✅ vault 文件不可被未授权篡改(AEAD AAD 校验)。
