import { PaginatedCoins } from "@mysten/sui/dist/cjs/client/types";
import { suiClient, signer } from "./sui_config";
import { Transaction } from '@mysten/sui/transactions';
import { getFullnodeUrl } from '@mysten/sui/client';
import * as dotenv from "dotenv";

console.log("作者：wukong");
console.log("tg：https://t.me/wukong_web3");
dotenv.config();
const suiAddress = signer.toSuiAddress();
console.log("主钱包sui地址：", suiAddress);

// 转移的币地址
const targetCoinType = process.env.SEND_COIN_TYPE || "";
// 接收转移的sui地址
const recipient = process.env.RECEIVE_ADDRESS || "";

// 获取符合条件的代币
async function getFilteredCoins() {
    try {
        const res = await suiClient.getAllCoins({ owner: suiAddress });
        // console.log("sui_all_coins:", JSON.stringify(res));
        return res.data
            .filter(coin => coin.coinType === targetCoinType)
            .map(coin => ({
                coinObjectId: coin.coinObjectId,
                balance: Number(coin.balance)  // 直接转换为数字
            }));
    } catch (error) {
        console.error("获取代币失败:", error);
        throw error;
    }
}

// 转移代币到指定sui地址
async function moneyTransfer(recipient: string, coinIds: string[], amount: number) {
    const tx = new Transaction();
    tx.transferObjects(coinIds, recipient); // 支持一次性转移多个对象

    try {
        return await suiClient.signAndExecuteTransaction({
            signer,
            transaction: tx,
        });
    } catch (error) {
        console.error("转移代币失败:", error);
        throw error;
    }
}

// 主逻辑
async function main() {
    try {
        const filteredCoins = await getFilteredCoins();
        const totalBalance = filteredCoins.reduce((sum, coin) => sum + coin.balance, 0);
        const allCoinObjectIds = filteredCoins.map(coin => coin.coinObjectId);

        if (allCoinObjectIds.length === 0 || totalBalance === 0) {
            console.log("主钱包里没有代币，请检查后重试");
            return;
        }

        console.log("开始发送代币：", {
            "总额：": totalBalance,
            "代币对象ID": allCoinObjectIds
        });

        const result = await moneyTransfer(recipient, allCoinObjectIds, totalBalance);
        console.log("转移代币结束，转移结果：", result);
    } catch (error) {
        console.error("处理过程中出现错误:", error);
    }
}

main();
