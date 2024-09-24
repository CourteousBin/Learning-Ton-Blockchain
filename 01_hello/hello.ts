import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto";
import { WalletContractV4, TonClient, fromNano, internal } from "@ton/ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { promises as fs } from 'fs';


// 修改返回类型以包含钱包和密钥
interface WalletWithKey {
  wallet: WalletContractV4;
  key: any; // 根据实际情况替换为正确的类型
}

async function createWallet(): Promise<WalletWithKey> {
  let mnemonic: string[];

  try {
    // 检查是否存在 mnemonic.txt 文件
    const mnemonicFile = 'mnemonic.txt';
    const fileExists = await fs.stat(mnemonicFile).then(() => true).catch(() => false);

    if (fileExists) {
      // 如果文件存在，读取助记词
      const mnemonicString = await fs.readFile(mnemonicFile, 'utf-8');
      mnemonic = mnemonicString.split(' ');
      console.log('Mnemonic loaded from mnemonic.txt');
    } else {
      // 如果文件不存在，生成新的助记词
      mnemonic = await mnemonicNew(24);
      const mnemonicString = mnemonic.join(' ');

      // 将助记词写入 txt 文件
      await fs.writeFile(mnemonicFile, mnemonicString);
      console.log('Mnemonic saved to mnemonic.txt');
    }

    // 使用助记词生成钱包密钥
    const key = await mnemonicToWalletKey(mnemonic);

    const wallet = WalletContractV4.create({
      publicKey: key.publicKey,
      workchain: 0
    });

    return { wallet, key };

  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error; // 抛出错误以便调用者处理
  }
}

async function connectClient(): Promise<TonClient> {
  const endpoint = await getHttpEndpoint({ network: "testnet" });
  const client = new TonClient({ endpoint });
  return client;
}

async function main() {
  let { wallet, key } = await createWallet();
  let client = await connectClient();


  // query balance from chain
  const balance = await client.getBalance(wallet.address);
  console.log("balance:", fromNano(balance));


  // query seqno from chain
  const walletContract = client.open(wallet);
  const seqno = await walletContract.getSeqno();
  console.log("seqno:", seqno);

  await walletContract.sendTransfer({
    secretKey: key.secretKey,
    seqno: seqno,
    messages: [
      internal({
        to: "EQA4V9tF4lY2S_J-sEQR7aUj9IwW-Ou2vJQlCn--2DLOLR5e",
        value: "0.01", // 0.05 TON
        body: "Hello", // optional comment
        bounce: false,
      })
    ]
  });

  // wait until confirmed
  let currentSeqno = seqno;
  while (currentSeqno == seqno) {
    console.log("waiting for transaction to confirm...");
    await sleep(1500);
    currentSeqno = await walletContract.getSeqno();
  }
  console.log("transaction confirmed!");

}
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
main()