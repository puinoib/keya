# .keya 加密安全审计报告

> 审计日期: 2026-06-05
> 审计范围: .keya 文件格式、加密模块、会话管理、生物识别
> 审计版本: main (b589137)

## 总体评价

核心加密架构（Argon2id + XChaCha20-Poly1305）是业界标准的高安全组合，实现正确，**没有发现可直接利用的严重漏洞**。但存在几个值得关注的设计层面问题。

---

## 审计发现

### 1. EncParams 缺少完整性保护 — 设计缺陷但不可直接利用

**严重性**: 设计缺陷
**文件**: `src/core/schema.ts:269`, `src/core/schema.ts:190-222`

**描述**:

Header hash（无密钥 SHA-256）只覆盖 Header（128B），不覆盖 EncParams（96B）。EncParams 中的 `ops`、`mem`、`salt`、`nonce` 均无密码学完整性保护。

文件布局:
```
Header (128B) | HeaderHash (32B) | EncParams (96B) | PayloadLen (4B) | Payload (N)
               ← hash 覆盖范围 →   ← 未受保护区域 →
```

**为什么不可直接利用**:

如果攻击者篡改 EncParams 中的 KDF 参数（降低 ops/mem），派生出的密钥会改变，XChaCha20-Poly1305 的 Poly1305 认证标签会校验失败，解密直接报错。攻击者无法伪造有效的密文，因为不知道原始密码。

攻击者也不需要修改文件即可离线暴力破解——可以直接提取 salt/nonce/masterSeed/ciphertext，用自己的工具跑。EncParams 完整性保护本质上不影响暴力破解难度。

**对比**: KeePassXC 对整个文件头使用 HMAC-SHA256 保护，设计更严谨。

**建议**: 可考虑将 EncParams 纳入 hash 计算范围，或使用 HMAC 替代无密钥 SHA-256。

---

### 2. MasterSeed 明文存储 — 合理的设计模式

**严重性**: 无（正常设计）
**文件**: `src/core/schema.ts:79`, `src/core/crypto.ts:52-61`

**描述**:

MasterSeed 存储在 Header 明文区域，被 Header Hash 完整性保护。`finalizeKey()` 执行 `SHA-256(masterSeed || derivedKey)`。

**结论**: 设计合理。

- MasterSeed 受 Header Hash 保护，**不可被篡改**（篡改会导致 hash 校验失败）
- 作用是**密钥分离**（key separation），确保每个文件有唯一的最终密钥
- 与 KeePass 的 master seed、LUKS 的 anti-forensic splitter 是相同的设计模式
- 不增加暴力破解难度（因为可读），但提供跨文件密钥隔离

---

### 3. 会话密码加密使用可公开推导的密钥 — 安全伪装

**严重性**: 低（浏览器模型下影响有限）
**文件**: `src/app/lib/session.ts:21-30`

**描述**:

```typescript
async function deriveEncryptKey(vaultId: string): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(vaultId));
  // ...
}
```

加密密钥 = `SHA-256(vaultId)`。vaultId 存储在 .keya 文件明文 Header 和 IndexedDB 中，任何能访问这些数据的人都能推导出密钥。

**影响评估**:

- 如果攻击者能读 sessionStorage，在浏览器威胁模型下，他们通常也能访问 IndexedDB（读 vaultId）甚至直接 hook `crypto.subtle.decrypt`
- 比之前的明文存储略好（至少需要多一步推导），但本质上**不提供真正的加密安全**
- 属于混淆级别（obscurity）的防护，而非密码学安全

**建议**: 如果要提供真正有意义的保护，可以引入运行时密钥（`extractable: false` 的 CryptoKey），或直接接受这是浏览器端的固有限制。

---

### 4. 生物识别的 AES 密钥与密文同库存 — 客户端固有局限

**严重性**: 低（客户端固有局限）
**文件**: `src/app/lib/biometric.ts:174-181`

**描述**:

```typescript
await putRecord({
  vault_id: vaultId,
  encryptedPassword,    // 密文
  aesKey: toBase64(aesKey),  // 解密密钥，明文base64
  iv: toBase64(iv),     // IV，明文base64
  // ...
});
```

AES 密钥、IV 和加密后的密码存储在 IndexedDB 的**同一条记录**中。WebAuthn 仅作为 UI 门禁——验证生物特征但不参与密钥派生。

**影响评估**:

- 代码注释明确说明 "WebAuthn serves as a biometric UI gate"，开发者清楚这个权衡
- 能访问 IndexedDB 的攻击者可以直接解密密码
- 但在浏览器客户端，这几乎无法避免——密钥必须以某种方式可访问
- 真正的改进需要 WebAuthn PRF 扩展（用生物特征派生密钥），但浏览器支持有限

**结论**: 这是客户端应用的固有限制，不是具体的漏洞。生物识别层在防止"路过的人偷看"这类场景下仍然有效。

---

### 5. 密码明文驻留内存 — 设计权衡

**严重性**: 信息
**文件**: `src/app/store/useStore.ts`

**描述**:

密码作为 Zustand state 中的字符串存储，在 vault 解锁期间持续存在。这是为了支持自动保存（`scheduleSave` 需要密码重新加密）。JavaScript 字符串不可变，无法安全清零。

**影响**: 内存转储、崩溃报告、浏览器堆快照都可能暴露密码。但对于需要密码做持续加密操作的本地应用，这是常见的设计权衡。

---

### 6. `equalBytes` 非恒定时间比较 — 理论风险

**严重性**: 加固
**文件**: `src/core/schema.ts:339-345`

**描述**:

```typescript
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
```

第一个不匹配字节就返回，存在 timing side-channel。但 Header Hash 验证是本地文件操作，timing attack 在此场景下不具备实际利用价值。

**建议**: 可用 `sodium.memcmp()` 替代，属于防御性编程。

---

## 总结

| 问题 | 严重性 | 可利用性 | 建议 |
|------|--------|----------|------|
| EncParams 无完整性保护 | 设计缺陷 | 不可直接利用 | 可考虑将 EncParams 纳入 hash 范围 |
| 会话密钥可公开推导 | 低 | 浏览器模型下影响有限 | 接受或引入运行时密钥 |
| 生物识别密钥同库存储 | 低 | 客户端固有局限 | 可研究 WebAuthn PRF |
| 密码内存驻留 | 信息 | 设计权衡 | 考虑 CryptoKey 对象 |
| 非恒定时间比较 | 加固 | 不可实际利用 | 用 `sodium.memcmp()` |

**结论**: 当前加密设计**不存在严重的安全漏洞**。Argon2id + XChaCha20-Poly1305 的核心组合是安全的，密钥派生链路正确。主要问题集中在"安全伪装"（session 和 biometric 的加密看起来安全但实际上密钥可推导）和设计严谨性（EncParams 完整性）上。对于本地优先的开源应用，当前设计在安全性和可用性之间取得了合理的平衡。
