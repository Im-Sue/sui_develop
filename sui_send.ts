import {suiClient} from "./sui_config";
import {Transaction} from '@mysten/sui/transactions';
import * as dotenv from "dotenv";
import * as readline from "readline";
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';


console.log("作者：wukong");
console.log("tg：https://t.me/wukong_web3");
dotenv.config();
// const suiAddress = signer.toSuiAddress();
// console.log("主钱包sui地址：", suiAddress);


// 从环境变量读取secretKey
const secretKey = process.env.SECRET_KEY || '';
// 转移的币地址
const targetCoinType = (process.env.SEND_COIN_TYPE || "");
// 转移代币的精度
const targetCoinDecimals = (Number(process.env.TARGET_COIN_DECIMALS) || 0);
// 接收转移的sui地址
const recipient = process.env.RECEIVE_ADDRESS || "";

function generateNumberWithZeros(digitCount: number): number {
    // 1后面加上指定数量的0
    return Number('1' + '0'.repeat(digitCount));
}

function generateSinger() {
    return Ed25519Keypair.fromSecretKey(secretKey); // 生成签名者
}

async function getFilteredCoins() {
    try {
        const res = await suiClient.getAllCoins({owner: generateSinger().toSuiAddress()});
        console.log("res:", JSON.stringify(res));
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
    if (coinIds.length === 0) {
        return "账户没有指定代币！";
    }
    const tx = new Transaction();

    const coidObArr = coinIds.map(coinId => {
        return tx.object(coinId)
    });

    const [newCoinObject] = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([newCoinObject], recipient); // 支持一次性转移多个对象

    try {
        const signer = generateSinger()
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
async function run() {
    try {
        const filteredCoins = await getFilteredCoins();
        console.log("filteredCoins:", JSON.stringify(filteredCoins));

        const totalBalance = filteredCoins.reduce((sum, coin) => sum + coin.balance, 0);
        const allCoinObjectIds = filteredCoins.map(coin => coin.coinObjectId);
        console.log("totalBalance:", JSON.stringify(totalBalance));
        console.log("allCoinObjectIds:", JSON.stringify(allCoinObjectIds));

        if (allCoinObjectIds.length === 0 || totalBalance === 0) {
            console.log("主钱包里没有代币，请检查后重试");
            return [];
        }

        console.log("指定代币账户信息：", {
            "总额：": totalBalance,
            "代币对象ID": allCoinObjectIds
        });

        return filteredCoins;


    } catch (error) {
        console.error("处理过程中出现错误:", error);
    }
    return []
}

// 创建 readline 接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let allCoinObject: any[] = [];

async function main() {
    allCoinObject = await run()
    rl.question("请输入send金额:", (input) => {
        if (input === 'exit') {
            console.log(`退出程序！`);
            rl.close(); // 关闭 readline 接口
        } else {
            // 请输入兑换数量(监听cmd面板输入)：
            let amount = 0
            amount = Number(input)
            console.log(`send金额为: ${amount}`);
            amount = (generateNumberWithZeros(targetCoinDecimals) * amount);
            (async () => {
                allCoinObject = await run()
                let allCoinObjectIds = allCoinObject
                    .filter(coin => coin.balance >= amount)
                    .map(coin => coin.coinObjectId)

                if (allCoinObjectIds.length > 0) {
                    if (allCoinObjectIds.length > 1) {
                        allCoinObjectIds = allCoinObjectIds.slice(0, 1);
                    }
                    console.log("准备发送代币：", allCoinObjectIds);
                    const result = await moneyTransfer(recipient, allCoinObjectIds, amount);
                    console.log("send代币结束：", result);
                }else {
                    console.log("输入的金额无法拆分，请先自行合并！" );
                }
                console.log("\n")
                console.log("\n")
                await sleep(5000); // 暂停 5 秒
                await main(); // 重新提示用户输入
            })();
        }
    });
}

main()
