import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Wallet from '@project-serum/sol-wallet-adapter';
import { Connection, SystemProgram, Transaction, clusterApiUrl, 
  StakeProgram, Authorized, Account, Lockup, GetProgramAccountsConfig, PublicKey } from '@solana/web3.js';

function toHex(buffer) {
  return Array.prototype.map
    .call(buffer, (x) => ('00' + x.toString(16)).slice(-2))
    .join('');
}

function App() {
  const [logs, setLogs] = useState([]);
  function addLog(log) {
    setLogs((logs) => [...logs, log]);
  }

  const network = clusterApiUrl('testnet');
  const [providerUrl, setProviderUrl] = useState('https://www.sollet.io');
  const connection = useMemo(() => new Connection(network), [network]);
  const urlWallet = useMemo(() => new Wallet(providerUrl, network), [
    providerUrl,
    network,
  ]);
  const injectedWallet = useMemo(() => {
    try {
      return new Wallet(window.solana, network);
    } catch (e) {
      console.log(`Could not create injected wallet: ${e}`);
      return null;
    }
  }, [network]);
  const [selectedWallet, setSelectedWallet] = useState(undefined);
  const [, setConnected] = useState(false);
  useEffect(() => {
    if (selectedWallet) {
      selectedWallet.on('connect', () => {
        setConnected(true);
        addLog('Connected to wallet ' + selectedWallet.publicKey.toBase58());
        const stakes = getStakeAccount();
        addLog("Stakes object keye " + Object.keys(stakes));
        
      });
      selectedWallet.on('disconnect', () => {
        setConnected(false);
        addLog('Disconnected from wallet');
      });
      selectedWallet.connect();
      return () => {
        selectedWallet.disconnect();
      };
    }
  }, [selectedWallet]);

  async function sendTransaction() {
    try {
      let transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: selectedWallet.publicKey,
          toPubkey: selectedWallet.publicKey,
          lamports: 100,
        })
      );
      addLog('Getting recent blockhash');
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash()
      ).blockhash;
      addLog('Sending signature request to wallet');
      transaction.feePayer = selectedWallet.publicKey;
      let signed = await selectedWallet.signTransaction(transaction);
      addLog('Got signature, submitting transaction');
      let signature = await connection.sendRawTransaction(signed.serialize());
      addLog('Submitted transaction ' + signature + ', awaiting confirmation');
      await connection.confirmTransaction(signature, 'singleGossip');
      addLog('Transaction ' + signature + ' confirmed');
    } catch (e) {
      console.warn(e);
      addLog('Error: ' + e.message);
    }
  }

  async function signMessage() {
    try {
      const message = "Please sign this message for proof of address ownership.";
      addLog('Sending message signature request to wallet');
      const data = new TextEncoder().encode(message);
      const signed = await selectedWallet.sign(data, 'hex');
      addLog('Got signature: ' + toHex(signed.signature));
    } catch (e) {
      console.warn(e);
      addLog('Error: ' + e.message);
    }
  }

  async function airdrop(){
    let addBalance = await connection.requestAirdrop(selectedWallet.publicKey, 9999);
    addLog("Airdrop " + addBalance);
    let balance = await connection.getBalance(selectedWallet.publicKey)
    addLog("Balance lamport " + balance);
  }

  async function createStakeAccount(){
    const authorized = new Authorized(selectedWallet.publicKey, selectedWallet.publicKey);
    const lockup = new Lockup(0, 0, selectedWallet.publicKey);
    const fromPubkey = selectedWallet.publicKey;
    const stakePubkey = new Account().publicKey 
    const transaction = StakeProgram.createAccount({
      authorized: authorized, 
      fromPubkey: fromPubkey,
      lamports: 122,
      lockup: lockup,
      stakePubkey: stakePubkey           
    });
    const [systemInstruction, stakeInstruction] = transaction.instructions;
    addLog("Stake account public key " + stakePubkey);
    addLog("System Instruction program id " + systemInstruction['programId'].toString());
    addLog("Stake Instruction Program id " + stakeInstruction['programId'].toBase58());
    const stakeTransaction = StakeProgram.delegate({
      authorizedPubkey: fromPubkey,
       stakePubkey: stakePubkey,
        votePubkey: "5aGC2ugXkQBDnBpFbhFrEtink5EP29M1o7xEuo7zPyYQ"
    });
    const [stakeInstruction2] = stakeTransaction.instructions;
    addLog("Stake Program Id" + stakeInstruction2.programId);
  }

  async function getStakeAccount(){
    const pubKey = new PublicKey("5aGC2ugXkQBDnBpFbhFrEtink5EP29M1o7xEuo7zPyYQ");
        addLog("Pub key " + pubKey);
        const stakes = await connection.getProgramAccounts(pubKey);
        addLog("Stakes object keys inside get stakes " + Object.keys(stakes));
        
  }
  return (
    <div className="App">
      <h1>Wallet Adapter Demo</h1>
      <div>Network: {network}</div>
      <div>
        Waller provider:{' '}
        <input
          type="text"
          value={providerUrl}
          onChange={(e) => setProviderUrl(e.target.value.trim())}
        />
      </div>
      {selectedWallet && selectedWallet.connected ? (
        <div>
          <div>Wallet address: {selectedWallet.publicKey.toBase58()}.</div>
          <button onClick={sendTransaction}>Send Transaction</button>
          <button onClick={signMessage}>Sign Message</button>
          <button onClick={airdrop}>Airdrop</button>
          <button onClick={createStakeAccount}>Create Stake Account</button>
          <button onClick={() => selectedWallet.disconnect()}>Disconnect</button>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedWallet(urlWallet)}>Connect to Wallet</button>
          <button onClick={() => setSelectedWallet(injectedWallet)}>Connect to Injected Wallet</button>
        </div>
      )}
      <hr />
      <div className="logs">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default App;