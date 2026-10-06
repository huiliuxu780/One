-- API Key 的 value 为 GZIP 压缩后 Base64URL 编码的 JWT（sk- 前缀）。
-- 实测在 HS512 签名与含中文的 UserDetail subject 下会超过 500 字符，
-- 创建密钥时首条 INSERT 成功、随后回填 value 的 UPDATE 报
-- "Data too long for column 'value'"，并遗留 value 为 NULL 的僵尸行。
ALTER TABLE `secret_key`
    MODIFY COLUMN `value` varchar(1000) DEFAULT NULL COMMENT '密钥';
