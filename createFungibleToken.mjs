import dotenv from 'dotenv';
dotenv.config();
import { AccountId, PrivateKey, Client, TokenCreateTransaction, TokenType, TokenSupplyType, AccountBalanceQuery } from '@hashgraph/sdk';

// Configure accounts and client, and generate needed keys
const myAcctID = AccountId.fromString(process.env.MY_ACCOUNT_ID);
const myAcctPK = PrivateKey.fromString(process.env.MY_PRIVATE_KEY);

const tokenName = process.env.TOKEN_NAME;
const tokenSymbol = process.env.TOKEN_SYMBOL;
const tokenDecimal = Number(process.env.TOKEN_DECIMALS);
const tokenInitalSupply = Number(process.env.TOKEN_INITALSUPPLY);

const supplyKey = PrivateKey.generate();
const adminKey = PrivateKey.generate();
const pauseKey = PrivateKey.generate();
const freezeKey = PrivateKey.generate();

function getArg(arg) {
	const customIndex = process.argv.indexOf(`-${arg}`);
	let customValue;

	if (customIndex > -1) {
		// Retrieve the value after --custom
		customValue = process.argv[customIndex + 1];
	}

	return customValue;
}

function getArgFlag(arg) {
	const customIndex = process.argv.indexOf(`-${arg}`);

	if (customIndex > -1) {
		return true;
	}

	return false;
}

function isInt(value) {
	const x = parseFloat(value);
	return !isNaN(value) && (x | 0) === x;
}

async function main() {

	if (getArgFlag('h')) {
		console.log('Usage: node createFungibleToken.mjs [-mainnet] [-adminkey] [-freezekey] [-pausekey] [-maxsupply XXX]');
		console.log('       -mainnet 	optional - defaults to testnet unless specified');
		console.log('       -adminkey	optional - add an admin key');
		console.log('       -freezekey	optional - add a freeze key');
		console.log('       -pausekey	optional - add an pause key');
		console.log('       -maxsupply 	optional - if used please provide an integer, if omitted then infinite supply assumed');
		return;
	}

	let client;

	if (getArgFlag('mainnet')) {
		console.log('using mainnet');
		client = Client.forMainnet();
	}
	else {
		console.log('Using testnet');
		client = Client.forTestnet();
	}

	client.setOperator(myAcctID, myAcctPK);

	// CREATE FUNGIBLE TOKEN (STABLECOIN)
	const tokenCreateTx = new TokenCreateTransaction()
		.setTokenName(tokenName)
		.setTokenSymbol(tokenSymbol)
		.setTokenType(TokenType.FungibleCommon)
		.setDecimals(tokenDecimal)
		.setInitialSupply(tokenInitalSupply)
		.setTreasuryAccountId(myAcctID);

	if (getArgFlag('maxsupply')) {
		tokenCreateTx.setSupplyType(TokenSupplyType.Finite);
		const maxSupply = Number(getArg('-maxsupply'));
		if (isInt(maxSupply)) {
			tokenCreateTx.setMaxSupply = maxSupply;
		}
		else {
			console.log(maxSupply, 'must be an integer');
			return;
		}

	}
	else {
		tokenCreateTx.setSupplyType(TokenSupplyType.Infinite);
	}

	const useFreeze = getArgFlag('freezekey');
	const usePause = getArgFlag('pausekey');
	const useAdmin = getArgFlag('adminkey');

	if (useFreeze) tokenCreateTx.setFreezeKey(freezeKey);
	if (usePause) tokenCreateTx.setPauseKey(pauseKey);
	if (useAdmin) tokenCreateTx.setAdminKey(adminKey);

	tokenCreateTx
		.setSupplyKey(supplyKey)
		.freezeWith(client);

	const tokenCreateSign = await tokenCreateTx.sign(myAcctPK);
	if (useAdmin) await tokenCreateSign.sign(adminKey);
	const tokenCreateSubmit = await tokenCreateSign.execute(client);
	const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
	const tokenId = tokenCreateRx.tokenId;
	console.log(`- Created token with ID: ${tokenId} \n`);
	console.log(`Supply Key: ${supplyKey}`);
	if (useAdmin) console.log(`Admin Key: ${adminKey}`);
	if (usePause) console.log(`Pause Key: ${pauseKey}`);
	if (useFreeze) console.log(`Freeze Key: ${freezeKey}`);

	// BALANCE CHECK
	const balanceCheckTx = await new AccountBalanceQuery().setAccountId(myAcctID).execute(client);
	console.log(`- Treasury balance: ${balanceCheckTx.tokens._map.get(tokenId.toString())} units of token ID ${tokenId}`);
}
main();