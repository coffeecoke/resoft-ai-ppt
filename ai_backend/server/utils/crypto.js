/**
 * 加密/解密工具
 * 用于敏感信息（如API密钥）的加密存储
 */

const crypto = require('crypto');

// 从环境变量获取加密密钥（32字节）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16; // AES块大小

class CryptoUtil {
  /**
   * 加密文本
   * @param {string} text - 原始文本
   * @returns {string} 加密后的文本（格式：iv:encrypted）
   */
  encrypt(text) {
    if (!text) return null;
    
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error('加密失败');
    }
  }

  /**
   * 解密文本
   * @param {string} text - 加密后的文本（格式：iv:encrypted）
   * @returns {string} 原始文本
   */
  decrypt(text) {
    if (!text) return null;
    
    try {
      const parts = text.split(':');
      if (parts.length !== 2) {
        throw new Error('无效的加密格式');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('解密失败:', error);
      throw new Error('解密失败');
    }
  }

  /**
   * 判断文本是否已加密
   * @param {string} text - 文本
   * @returns {boolean}
   */
  isEncrypted(text) {
    if (!text) return false;
    
    // 检查格式：32位hex:加密内容
    const parts = text.split(':');
    return parts.length === 2 && parts[0].length === IV_LENGTH * 2 && /^[0-9a-f]+$/i.test(parts[0]);
  }

  /**
   * 掩码显示敏感信息
   * @param {string} text - 原始文本
   * @param {number} visibleLength - 可见长度
   * @returns {string} 掩码后的文本
   */
  mask(text, visibleLength = 4) {
    if (!text) return '';
    if (text.length <= visibleLength * 2) return '***';
    
    const start = text.substring(0, visibleLength);
    const end = text.substring(text.length - visibleLength);
    const maskLength = Math.min(text.length - visibleLength * 2, 10);
    
    return start + '*'.repeat(maskLength) + end;
  }
}

module.exports = new CryptoUtil();

