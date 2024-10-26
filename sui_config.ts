import * as dotenv from 'dotenv';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
dotenv.config();

// 初始化SUI Client, 用于和主网(mainnet)交互
const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });
// 从环境变量读取secretKey
const secretKey = process.env.SECRET_KEY || '';
/** 这里把base64编码的secretKey转换为字节数组后截掉第一个元素，是因为第一位是一个私钥类型的标记位，后续派生签名者时不需要 **/
const signer = Ed25519Keypair.fromSecretKey(secretKey ); // 生成签名者

export { suiClient, signer }