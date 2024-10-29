import {TestnetSDK as sdk} from "./init_mainnet_sdk"
import {adjustForSlippage, Percentage, d, Pool} from "@cetusprotocol/cetus-sui-clmm-sdk";
import BN from "bn.js";
import {suiClient, signer} from "./sui_config";
import * as readline from "readline";
import * as dotenv from "dotenv";

dotenv.config();

console.log("作者：wukong");
console.log("tg：https://t.me/wukong_web3");
// 使用的池子 从https://app.cetus.zone/liquidity/analytics?poolAddress=0x2e041f3fd93646dcc877f783c1f2b7fa62d30271bdef1f21ef002cebf857bded 找到poolAddress
const POOL_ADDRESS = process.env.POOL_ADDRESS || ""
// true A换成B，false B换成A
let a2b = process.env.ATOB?.toLowerCase() === 'true';
// 购买数量
// const AMOUNT_VALE = process.env.AMOUNT || '0';
// const amount = Number(AMOUNT_VALE)
// 滑点值
const SLIPPAGE_VALUE = process.env.SLIPPAGE || '0';
const slippage = Percentage.fromDecimal(d(SLIPPAGE_VALUE))
// A币精度  https://suivision.xyz/ 查询指定币精度
const decimalsA = Number(process.env.DECIMALS_A) || 0
// B币精度 https://suivision.xyz/ 查询指定币精度
const decimalsB = Number(process.env.DECIMALS_B) || 0
// true 支出固定数量  false 收到固定数量
const byAmountIn = true


// 创建 readline 接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function generateNumberWithZeros(digitCount: number): number {
    // 1后面加上指定数量的0
    return Number('1' + '0'.repeat(digitCount));
}

async function transfer(pool: Pool | undefined, amount: number) {
    try {

        if (!pool) {
            console.log("找不到兑换池，请检查配置文件...")
            return
        }
        let coinAmount = new BN(0);
        if (a2b) {
            coinAmount = new BN((generateNumberWithZeros(decimalsA) * amount))
        } else {
            coinAmount = new BN((generateNumberWithZeros(decimalsB) * amount))
        }
        console.log("coinAmount：：" + coinAmount)
        console.log("开始执行兑换....")

        // console.log("pool::", pool)
        // Estimated amountIn amountOut fee
        const swapTicks = await sdk.Pool.fetchTicks({
            pool_id: pool.poolAddress,
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB,
        });
        // console.log("SwapTicks data:", swapTicks);
        const res = sdk.Swap.calculateRates({
            decimalsA: decimalsA,
            decimalsB: decimalsB,
            a2b,
            byAmountIn,
            amount: coinAmount,
            swapTicks,
            currentPool: pool,
        });

        console.log("兑换信息：", {
            estimatedAmountIn: res.estimatedAmountIn.toString(),
            estimatedAmountOut: res.estimatedAmountOut.toString(),
            estimatedEndSqrtPrice: res.estimatedEndSqrtPrice.toString(),
            estimatedFeeAmount: res.estimatedFeeAmount.toString(),
            isExceed: res.isExceed,
            extraComputeLimit: res.extraComputeLimit,
            amount: res.amount.toString(),
            aToB: res.aToB,
            byAmountIn: res.byAmountIn,
        });

        const toAmount = byAmountIn ? res.estimatedAmountOut : res.estimatedAmountIn
        const amountLimit = adjustForSlippage(toAmount, slippage, !byAmountIn)

        // build swap Tx
        const swapPayload = await sdk.Swap.createSwapTransactionPayload(
            {
                pool_id: pool.poolAddress,
                coinTypeA: pool.coinTypeA,
                coinTypeB: pool.coinTypeB,
                a2b: a2b,
                by_amount_in: byAmountIn,
                amount: res.amount.toString(),
                amount_limit: amountLimit.toString(),
                // swap_partner: partner,
            },
        )
        // swapPayload.setGasBudget(100000000); // 设置一个较大的预算
        const transferTxn = await sdk.fullClient.sendTransaction(signer, swapPayload)
        console.log('兑换结果返回::', JSON.stringify(transferTxn))
        if (transferTxn && transferTxn.effects && transferTxn.effects.status.status == "success"){
            console.log("\n")
             console.log('兑换结果：', transferTxn.effects.status.status == "success" ? "成功！" : "失败！")
        }
    } catch (error) {
        console.error("兑换处理过程中出现错误:", error);
    }
}

async function run() {
    try {

        sdk.senderAddress = signer.toSuiAddress();

        // Fetch pool data
        const pool = await sdk.Pool.getPool(POOL_ADDRESS)
        const coinTypeA = pool.coinTypeA
        const coinTypeB = pool.coinTypeB
        if (coinTypeA != "0x2::sui::SUI" && coinTypeB != "0x2::sui::SUI") {
            console.log("不支持的币类型，请检查后重试")
            return
        }

        const sui_type_A_OR_B = coinTypeA == "0x2::sui::SUI" ? "A币" : "B币"
        console.log("\u00A0\u00A0\u00A0\u00A0当前使用钱包::", sdk.senderAddress + "\n" +
            "\u00A0\u00A0\u00A0\u00A0sui是：" + sui_type_A_OR_B + "\n" +
            "\u00A0\u00A0\u00A0\u00A0兑换模式：" + (a2b ? "A换B" : "B换A") + "\n" +
            "\u00A0\u00A0\u00A0\u00A0滑点：" + SLIPPAGE_VALUE + "%"
        )


        return pool
    } catch (error) {
        console.error("处理过程中出现错误:", error);
    }

    return undefined
}

async function main() {
    const pool = await run()
    rl.question("请输入要兑换的金额:", (input) => {
        if (input === 'exit') {
            console.log(`退出程序！`);
            rl.close(); // 关闭 readline 接口
        } else {
            // 请输入兑换数量(监听cmd面板输入)：
            let amount = 0
            amount = Number(input)
            console.log(`输入金额为: ${amount}`);
            (async () => {
               await transfer(pool, amount)
                console.log("\n")
                console.log("\n")
               await main(); // 重新提示用户输入
            })();
        }
    });
}

main()