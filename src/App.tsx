import axios from 'axios';
import React, {useState} from 'react'
// @ts-ignore
import Check from 'baseui/icon/check';
// @ts-ignore
import Delete from 'baseui/icon/delete';
import {
  Checkbox,
  LABEL_PLACEMENT
} from "baseui/checkbox";
import {useSnackbar} from "baseui/snackbar";
import {Heading, HeadingLevel} from 'baseui/heading'
import {Button} from "baseui/button";
import {Block} from 'baseui/block'
import {Avatar} from "baseui/avatar";
import {ProgressSteps, Step} from "baseui/progress-steps";
import {Paragraph2, Paragraph3, ParagraphSmall} from "baseui/typography";
import {StyledLink} from "baseui/link";
import {expandBorderStyles} from 'baseui/styles';
import {Input, SIZE} from "baseui/input";
import {FileUploader} from "baseui/file-uploader";

import JSONPretty from 'react-json-pretty';
import {CodeBlock} from "react-code-blocks";
import * as sigUtil from "@metamask/eth-sig-util";
import * as ethUtil from "ethereumjs-util";

import {Contract, ContractFactory, providers, utils} from "ethers"
import {Web3Provider} from "@ethersproject/providers";
import {WebBundlr} from "@bundlr-network/client";
import BundlrTransaction from "@bundlr-network/client/build/common/transaction";
import BigNumber from "bignumber.js";

import contractABI from "./contracts/ArweaveStorageManagerContractABI.json";
import contractBytecode from "./contracts/ArweaveStorageManagerContractBytecode.json";

const networkChainId = "0x1c";
const networkRPC = "https://rinkeby.boba.network/";
const bundlrHttpRPC = "https://devnet.bundlr.network";

function App() {
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState<Web3Provider>();
  const [address, setAddress] = useState<string | undefined>("");
  const [bundlrRPC, setbundlrRPC] = React.useState(bundlrHttpRPC);
  const [bundlr, setbundlr] = useState<WebBundlr>();
  const [bundlrBalance, setBundlrBalance] = useState<BigNumber>(new BigNumber(0));

  // access
  const [accessFileTx, setAccessFileTx] = useState("");

  // upload
  const [uploadedFileTx, setUploadedFileTx] = useState<BundlrTransaction>();
  const [uploadedFileSize, setUploadedFileSize] = useState(0);
  const [uploadedFileCost, setUploadedFileCost] = useState<BigNumber>(new BigNumber(0));
  const [isFunding, setFunding] = useState(false);
  const [customFundingValue, setCustomFundingValue] = useState("");
  const [isUploading, setUploading] = useState(false);
  const [isUploaded, setUploaded] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);

  // contract as a pointer
  const [inputContractAddress, setInputContractAddress] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [isDeploying, setDeploying] = useState(false);
  const [storageContract, setStorageContract] = useState<Contract>();
  const [storageGetPointer, setStorageGetPointer] = useState("");
  const [storageSetPointer, setStorageSetPointer] = useState("");
  const [isPending, setPending] = useState(false);
  const [pointerStep, setPointerStep] = useState(0);

  // database
  const [isFetching, setFetching] = useState(false);
  const [databaseWriteKey, setDatabaseWriteKey] = useState("");
  const [databaseWriteValue, setDatabaseWriteValue] = useState("");
  const [databaseRemoveKey, setDatasetRemoveKey] = useState("");
  const [databaseReadKey, setDatabaseReadKey] = useState("");
  const [databaseReadValue, setDatabaseReadValue] = useState("");
  const [database, setDatabase] = useState({});
  const [rawDatabase, setRawDatabase] = useState("");
  const [enableEncryption, setEncryption] = useState(false);
  const [encryptionPubkey, setEncryptionPubkey] = useState("");
  const [databaseStep, setDatabaseStep] = useState(0);

  const { enqueue } = useSnackbar();

  const resetUploadState = () => {
    setUploadedFileTx(undefined);
    setUploadedFileSize(0);
    setUploadedFileCost(new BigNumber(0));
    setFunding(false);
    setUploading(false);
    setUploaded(false);
    setUploadStep(2);
  }

  // add Boba network to metamask
  const addBobaNetwork = async () => {
    let networkData = [
      {
        chainId: networkChainId,
        chainName: "BOBA Rinkeby",
        rpcUrls: [networkRPC],
        nativeCurrency: {
          name: "BOBA ETH",
          symbol: "ETH",
          decimals: 18,
        },
        blockExplorerUrls: ["https://blockexplorer.rinkeby.boba.network/"],
      },
    ];

    return window.ethereum?.request({
      method: "wallet_addEthereumChain",
      params: networkData,
    });
  }

  const switchBobaChain = async () => {
    await window.ethereum?.request({ method: 'wallet_switchEthereumChain', params:[{chainId: networkChainId}]});
  }

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      console.error('MetaMask is not installed!');
      enqueue({
        message: 'MetaMask is not installed!',
        startEnhancer: ({size}) => <Delete size={size} />,
      })
      return;
    }
    await window.ethereum?.request({method: 'eth_requestAccounts'});
    let retry = 0;
    while (await window.ethereum.request({ method: 'eth_chainId' }) !== networkChainId) {
      if (retry > 3) {
        console.error("Failed to connect!")
        enqueue({
          message: 'Failed to connect!',
          startEnhancer: ({size}) => <Delete size={size} />,
        })
        return;
      }
      retry += 1;
      await addBobaNetwork();
      await switchBobaChain();
    }
    const _provider = new providers.Web3Provider(window.ethereum);
    await _provider._ready();
    setProvider(_provider);
    setAddress(await _provider?.getSigner().getAddress());
    setConnected(true);
    enqueue({
      message: 'Wallet connected!',
      startEnhancer: ({size}) => <Check size={size} />,
    })
    setUploadStep(uploadStep + 1);
    setPointerStep(pointerStep + 1);
    setDatabaseStep(databaseStep + 1);
  }

  const initializeBundlr = async () => {
    const _bundlr = new WebBundlr(bundlrRPC, "boba", provider, { providerUrl: networkRPC });
    await _bundlr.ready();
    // @ts-ignore
    _bundlr.currencyConfig.minConfirm = 0;
    setbundlr(_bundlr);
    enqueue({
      message: 'bundlr initialized!',
      startEnhancer: ({size}) => <Check size={size} />,
    })
    setBundlrBalance(await _bundlr?.getLoadedBalance() || new BigNumber(0));
    setUploadStep(uploadStep + 1);
    setDatabaseStep(databaseStep + 1);
  }

  const fundAmount = async (amount: BigNumber) => {
    setFunding(true);
    try {
      await bundlr?.fund(amount)
      setFunding(false);
    } catch (e) {
      setFunding(false);
      return;
    }
  }

  const deployContract = async () => {
    setDeploying(true);
    try {
      const factory = new ContractFactory(contractABI, contractBytecode.object, provider?.getSigner());
      const contract = await factory.deploy();
      setContractAddress(contract.address);
      await contract.deployed();
      setStorageContract(contract);
      setDeploying(false);
      setPointerStep(pointerStep + 1);
    } catch (e: any) {
      console.error(e);
      enqueue({
        message: e.message,
        startEnhancer: ({size}) => <Delete size={size} />,
      });
      setDeploying(false);
    }
  }

  const getData = async (txId: string) => {
    const url = `${bundlrHttpRPC}/tx/${txId}/data`;
    return (await axios.get(url)).data;
  }

  const fetchDatabase = async (end=true) => {
    setFetching(true);
    const _pointer = await storageContract?.get();
    const rawData = await getData(_pointer);
    let dataObject;
    if (enableEncryption) {
      dataObject = await decryptByMetamask(rawData);
    } else {
      dataObject = rawData;
    }
    if (typeof rawData === "string") {
      dataObject = JSON.parse(dataObject);
    }
    setRawDatabase(rawData)
    setDatabase(dataObject);
    if (end)
      setFetching(false);
    return dataObject;
  }

  const getEncryptionPubkeyFromMetamask = async () => {
    if (typeof address === 'undefined') return;
    return await provider?.send('eth_getEncryptionPublicKey', [address]);
  }

  const encryptByMetamask = (publicKey: string, text: string) => {
    const result = sigUtil.encrypt({
      publicKey,
      data: text,
      // https://github.com/MetaMask/eth-sig-util/blob/v4.0.0/src/encryption.ts#L40
      version: "x25519-xsalsa20-poly1305"
    });

    // https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods
    return ethUtil.bufferToHex(Buffer.from(JSON.stringify(result), "utf8"));
  };

  const decryptByMetamask = async (text: string) => {
    if (typeof address === 'undefined') return;
    return await provider?.send("eth_decrypt", [text, address]);
  };

  const processData = async (data: string, key: string) => {
    if (enableEncryption)
      return await encryptByMetamask(key, data);
    return data
  }

  // @ts-ignore
  return (
    <Block width="500px">
      <HeadingLevel>
        <Heading>Welcome to BABO</Heading>
        <Paragraph3>
          In this demo web application, you can interact with Arweave with just your BABO wallet, powered by Bundlr Network.
          This demo runs on BABO Rinkeby Testnet, you can bridge your ETH Rinkeby tokens to BABO Rinkeby using <a href="https://gateway.rinkeby.boba.network/">BABO Gateway</a>
        </Paragraph3>
        <HeadingLevel><Heading>Read File</Heading></HeadingLevel>
        <Paragraph3>
          In this section you would be able to access files stored on Arweave by providing ID.
        </Paragraph3>
        <div>
          <ParagraphSmall>Input ID:</ParagraphSmall>
          <Input
              value={accessFileTx}
              onChange={e => setAccessFileTx((e.currentTarget as HTMLInputElement).value)}
              size={SIZE.compact}
              placeholder="AVmT4rqbAg..."
              clearOnEscape
          />
          <div style={{marginTop: 8, marginBottom: 8}}/>
          <Button size="compact" onClick={() => {
            // @ts-ignore
            window.open(`https://arweave.net/${accessFileTx}`, '_blank');
          }}>
            Access File in Browser
          </Button>
        </div>
        <HeadingLevel><Heading>Upload File</Heading></HeadingLevel>
        <Paragraph3>
          In this section you would be able to upload your file to Arweave for permanent storing. You don't need to prepare an AR wallet or to purchase AR token for gas fee, all you need is a BABO wallet with some ETH tokens.
        </Paragraph3>
        <ProgressSteps current={uploadStep}>
          <Step title="Connect with Metamask">
            {!connected &&
            <Button size="compact" onClick={connectWallet}>
              Connect
            </Button>
            }
          </Step>
          <Step title="Initialize Bundlr Network">
            { !bundlr && (
              <div>
                <Avatar
                    overrides={{
                      Root: {
                        style: ({$theme}) => ({
                          ...expandBorderStyles($theme.borders.border600),
                        }),
                      },
                    }}
                    name={address ? address : ""}
                    size="scale1600"
                    src={`https://identicon-api.herokuapp.com/${address}/256?format=png`}
                />
                <div style={{marginTop: 8, marginBottom: 8}}/>
                <StyledLink href={`https://blockexplorer.rinkeby.boba.network/address/${address}`}>
                  {address}
                </StyledLink>
                <ParagraphSmall>bundlr RPC:</ParagraphSmall>
                <Input
                    value={bundlrRPC}
                    onChange={e => setbundlrRPC((e.currentTarget as HTMLInputElement).value)}
                    size={SIZE.compact}
                    placeholder="https://devnet.bundlr.network"
                    clearOnEscape
                />
                <div style={{marginTop: 8, marginBottom: 8}}/>
                <Button size="compact" onClick={initializeBundlr}>
                  Initialize
                </Button>
              </div>
            )}
          </Step>
          <Step title="Upload File">
            { bundlr && (<div>
              <FileUploader multiple={false}
                onDrop={(acceptedFiles, rejectedFiles) => {
                  const reader = new FileReader();
                  reader.onload = async () => {
                    // @ts-ignore
                    const tx = bundlr?.createTransaction(reader.result);
                    const _price = await bundlr?.getPrice(tx.size);
                    setUploadedFileSize(tx.size);
                    setUploadedFileCost(_price);
                    setUploadedFileTx(tx);
                    setUploadStep(bundlrBalance.isGreaterThan(_price) ? uploadStep + 2 : uploadStep + 1);
                  }
                  reader.readAsArrayBuffer(acceptedFiles[0]);
                }}
              />
            </div>)}
          </Step>
          <Step title="Fund Your Wallet">
            { uploadedFileTx && (
                <div>
                  <ParagraphSmall>File Size: {uploadedFileSize}</ParagraphSmall>
                  <ParagraphSmall>Estimated Cost: {bundlr?.utils.unitConverter(uploadedFileCost).toString()}</ParagraphSmall>
                  <ParagraphSmall>Your Balance: {bundlr?.utils.unitConverter(bundlrBalance).toString()}</ParagraphSmall>
                  <Button size="compact" isLoading={isFunding} onClick={async () => {
                    await fundAmount(uploadedFileCost.minus(bundlrBalance).multipliedBy(1.1).integerValue(BigNumber.ROUND_CEIL));
                    setBundlrBalance(await bundlr?.getLoadedBalance() || new BigNumber(0));
                    if (bundlrBalance.isGreaterThan(uploadedFileCost)) {
                      setUploadStep(uploadStep + 1);
                    }
                  }}>
                    Fund Needed
                  </Button>
                  <Button size="compact" onClick={async () => {
                    setBundlrBalance(await bundlr?.getLoadedBalance() || new BigNumber(0));
                    if (bundlrBalance.isGreaterThan(uploadedFileCost)) {
                      setUploadStep(uploadStep + 1);
                    }
                  }}>
                    Check Balance
                  </Button>
                  <Input
                      value={customFundingValue}
                      onChange={e => setCustomFundingValue((e.currentTarget as HTMLInputElement).value)}
                      size={SIZE.compact}
                      placeholder="1_000_000_000... Base Units"
                      clearOnEscape
                  />
                  <div style={{marginTop: 8, marginBottom: 8}}/>
                  <Button size="compact" isLoading={isFunding} onClick={async () => {
                    // @ts-ignore
                    try {
                      await fundAmount(new BigNumber(customFundingValue));
                      setBundlrBalance(await bundlr?.getLoadedBalance() || new BigNumber(0));
                      if (bundlrBalance.isGreaterThan(uploadedFileCost)) {
                        setUploadStep(uploadStep + 1);
                      }
                    } catch (e: any) {
                      console.error(e);
                      enqueue({
                        message: e.message,
                        startEnhancer: ({size}) => <Delete size={size} />,
                      });
                    }
                  }}>
                    Fund Inputed
                  </Button>
                </div>
            )}
          </Step>
          <Step title="Confirm">
            <p>ID: {isUploaded ? uploadedFileTx?.id : "Not Uploaded"}</p>
            <Button disabled={isUploaded} size="compact" isLoading={isUploading} onClick={async () => {
              await uploadedFileTx?.sign();
              setUploading(true);
              await uploadedFileTx?.upload();
              setUploading(false);
              setUploaded(true);
            }}>
              Confirm Uploading
            </Button>
            <Button size="compact" isLoading={isUploading} onClick={resetUploadState}>
              Upload Another File
            </Button>
          </Step>
        </ProgressSteps>
        <HeadingLevel><Heading>Contract as a Arweave pointer</Heading></HeadingLevel>
        <Paragraph3>
          As it can be seen from previous section, every time the content is changed, the ID is changed as well, making the file difficult to follow on Arweave. To address problem, we can deploy a simple contract to store the current Arweave ID, like a pointer in RAM.
          The reason we don't use GraphQL tags here is that its index may cause additional time, making the latency larger.
        </Paragraph3>
        <ProgressSteps current={pointerStep}>
          <Step title="Connect with Metamask">
            {!connected &&
            <Button size="compact" onClick={connectWallet}>
              Connect
            </Button>
            }
          </Step>
          <Step title="Deploy or use deployed contract">
            <ParagraphSmall>Input a deployed ArweaveStorageManagerContract address</ParagraphSmall>
            <Input
                value={inputContractAddress}
                onChange={e => setInputContractAddress((e.currentTarget as HTMLInputElement).value)}
                size={SIZE.compact}
                placeholder="0x..."
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" onClick={() => {
              try {
                const _address = utils.getAddress(inputContractAddress)
                const contract = new Contract(_address, contractABI, provider?.getSigner());
                setContractAddress(_address);
                setStorageContract(contract);
                setPointerStep(pointerStep + 1);
              } catch (e: any) {
                console.error(e);
                enqueue({
                  message: e.message,
                  startEnhancer: ({size}) => <Delete size={size} />,
                });
              }
            }}>
              Confirm
            </Button>
            <ParagraphSmall>Or deploy one right now</ParagraphSmall>
            <Button size="compact" isLoading={isDeploying} onClick={deployContract}>
              Deploy
            </Button>
          </Step>
          <Step title="Write/Read the contract">
            <p>Your Contract Address: {contractAddress}</p>
            <ParagraphSmall>Read your Arweave pointer: {storageGetPointer}</ParagraphSmall>
            <Button size="compact" onClick={async () => {
              const _pointer = await storageContract?.get();
              setStorageGetPointer(_pointer);
            }}>
              Read
            </Button>
            <ParagraphSmall>Set your Arweave pointer: </ParagraphSmall>
            <Input
                value={storageSetPointer}
                onChange={e => setStorageSetPointer((e.currentTarget as HTMLInputElement).value)}
                size={SIZE.compact}
                placeholder="AVmT4rqo..."
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={isPending} onClick={async () => {
              setPending(true);
              const tx = await storageContract?.set(storageSetPointer);
              await tx.wait(1);
              setStorageSetPointer("");
              setPending(false);
            }}>
              Set
            </Button>
          </Step>
        </ProgressSteps>
        <HeadingLevel><Heading>Combine Them Together: A POC of On-chain Database</Heading></HeadingLevel>
        <Paragraph3>
          By combining BOBA, Bundlr and Arweave together, we can build a database that lives on-chain.
        </Paragraph3>
        <ParagraphSmall>
          To prevent raw user data from directly exposing to the general public, it is optional to enable encryption. The encryption is achieved by Elliptic-curve Diffie–Hellman (ECDH). That is, message is encrypted by user's public key and is latter decrypted by user's private key. Note that we derive user's public key by calling RPC method provided by Metamask Desktop, consequently, currently database encryption can only be enabled with Metamask Desktop.
        </ParagraphSmall>
        <ProgressSteps current={databaseStep}>
          <Step title="Connect with Metamask">
            {!connected &&
            <Button size="compact" onClick={connectWallet}>
              Connect
            </Button>
            }
          </Step>
          <Step title="Initialize Bundlr Network">
            { !bundlr && (
                <div>
                  <Avatar
                      overrides={{
                        Root: {
                          style: ({$theme}) => ({
                            ...expandBorderStyles($theme.borders.border600),
                          }),
                        },
                      }}
                      name={address ? address : ""}
                      size="scale1600"
                      src={`https://identicon-api.herokuapp.com/${address}/256?format=png`}
                  />
                  <div style={{marginTop: 8, marginBottom: 8}}/>
                  <StyledLink href={`https://blockexplorer.rinkeby.boba.network/address/${address}`}>
                    {address}
                  </StyledLink>
                  <ParagraphSmall>bundlr RPC:</ParagraphSmall>
                  <Input
                      value={bundlrRPC}
                      onChange={e => setbundlrRPC((e.currentTarget as HTMLInputElement).value)}
                      size={SIZE.compact}
                      placeholder="https://devnet.bundlr.network"
                      clearOnEscape
                  />
                  <div style={{marginTop: 8, marginBottom: 8}}/>
                  <Button size="compact" onClick={initializeBundlr}>
                    Initialize
                  </Button>
                </div>
            )}
          </Step>
          <Step title="Deploy or use deployed contract">
            <ParagraphSmall>Input deployed ArweaveStorageManagerContract address</ParagraphSmall>
            <Input
                value={inputContractAddress}
                onChange={e => setInputContractAddress((e.currentTarget as HTMLInputElement).value)}
                size={SIZE.compact}
                placeholder="0x..."
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" onClick={() => {
              try {
                const _address = utils.getAddress(inputContractAddress)
                const contract = new Contract(_address, contractABI, provider?.getSigner());
                setContractAddress(_address);
                setStorageContract(contract);
                setDatabaseStep(databaseStep + 1);
              } catch (e: any) {
                console.error(e);
                enqueue({
                  message: e.message,
                  startEnhancer: ({size}) => <Delete size={size} />,
                });
              }
            }}>
              Confirm
            </Button>
          </Step>
          <Step title="Fund Your Wallet">
            <ParagraphSmall>Make sure to fund enough tokens here, something like 1e12 base units.</ParagraphSmall>
            <ParagraphSmall>Your Balance: {bundlr?.utils.unitConverter(bundlrBalance).toString()}</ParagraphSmall>
            <Input
                value={customFundingValue}
                onChange={e => setCustomFundingValue((e.currentTarget as HTMLInputElement).value)}
                size={SIZE.compact}
                placeholder="1_000_000_000... Base Units"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={isFunding} onClick={async () => {
              try {
                await fundAmount(new BigNumber(customFundingValue));
                setDatabaseStep(databaseStep + 1);
              } catch (e: any) {
                console.error(e);
                enqueue({
                  message: e.message,
                  startEnhancer: ({size}) => <Delete size={size} />,
                });
              }
            }}>
              Fund
            </Button>
            <Button size="compact" isLoading={isFunding} onClick={async () => {
              setDatabaseStep(databaseStep + 1);
            }}>
              Skip
            </Button>
          </Step>
          <Step title="Database Initialization">
            <ParagraphSmall>If this is the first time you use the database, please initialize it first. Otherwise you can skip this step.</ParagraphSmall>
            <ParagraphSmall>Note that if you decide to switch the encryption mode (e.g. from non encrypted to encrypted database), the database needs to be initialized as well.</ParagraphSmall>
            <Checkbox
                checked={enableEncryption}
                onChange={e => setEncryption(e.currentTarget.checked)}
                labelPlacement={LABEL_PLACEMENT.right}
            >
              Encryption (Only Available for Metamask Desktop)
            </Checkbox>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={isPending} onClick={async () => {
              if (typeof bundlr === 'undefined') return;
              setPending(true);
              let _encryptionPubkey;
              if (enableEncryption) {
                _encryptionPubkey = await getEncryptionPubkeyFromMetamask();
                setEncryptionPubkey(_encryptionPubkey);
              }
              const bundlrTx = bundlr.createTransaction(await processData("{}", _encryptionPubkey));
              await bundlrTx.sign();
              await bundlrTx.upload();
              const tx = await storageContract?.set(bundlrTx.id);
              await tx.wait(1);
              await fetchDatabase();
              setPending(false);
              setDatabaseStep(databaseStep + 1);
            }}>
              Initialize Database
            </Button>
            <Button size="compact" isLoading={isFunding} onClick={async () => {
              let _encryptionPubkey;
              if (enableEncryption) {
                _encryptionPubkey = await getEncryptionPubkeyFromMetamask();
                setEncryptionPubkey(_encryptionPubkey);
              }
              await fetchDatabase();
              setDatabaseStep(databaseStep + 1);
            }}>
              Skip
            </Button>
          </Step>
        </ProgressSteps>
        {databaseStep >= 5 && (
            <div>
              <ParagraphSmall>Your Balance: {bundlr?.utils.unitConverter(bundlrBalance).toString()}</ParagraphSmall>
              <Button size="compact" onClick={async () => {
                setBundlrBalance(await bundlr?.getLoadedBalance() || new BigNumber(0));
              }}>
                Check Balance
              </Button>
              <Paragraph2>Database Overview</Paragraph2>
              <ParagraphSmall>Raw Database. Content stored on Arweave and can be accessed by anyone.</ParagraphSmall>
              <CodeBlock text={rawDatabase} wrapLines/>
              <ParagraphSmall>Parsed Database. Content recognized by us (if encryption is enabled).</ParagraphSmall>
              <JSONPretty id="json-pretty" data={database}/>
              <Paragraph2>Add/Update Key Value</Paragraph2>
              <Input
                  value={databaseWriteKey}
                  onChange={e => setDatabaseWriteKey((e.currentTarget as HTMLInputElement).value)}
                  size={SIZE.compact}
                  placeholder="Key"
                  clearOnEscape
              />
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <Input
                  value={databaseWriteValue}
                  onChange={e => setDatabaseWriteValue((e.currentTarget as HTMLInputElement).value)}
                  size={SIZE.compact}
                  placeholder="Value"
                  clearOnEscape
              />
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                if (typeof bundlr === 'undefined') return;
                const _data = await fetchDatabase(false);
                _data[databaseWriteKey] = databaseWriteValue;
                const bundlrTx = bundlr.createTransaction(await processData(JSON.stringify(_data), encryptionPubkey));
                await bundlrTx.sign();
                await bundlrTx.upload();
                const tx = await storageContract?.set(bundlrTx.id);
                await tx.wait(1);
                await fetchDatabase();
                setDatabaseWriteKey("");
                setDatabaseWriteValue("");
              }}>
                Add / Update
              </Button>
              <Paragraph2>Remove Key</Paragraph2>
              <Input
                  value={databaseRemoveKey}
                  onChange={e => setDatasetRemoveKey((e.currentTarget as HTMLInputElement).value)}
                  size={SIZE.compact}
                  placeholder="Key"
                  clearOnEscape
              />
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                if (typeof bundlr === 'undefined') return;
                const _data = await fetchDatabase(false);
                if (!(databaseRemoveKey in _data)) {
                  return;
                }
                delete _data[databaseRemoveKey];
                const bundlrTx = bundlr.createTransaction(await processData(JSON.stringify(_data), encryptionPubkey));
                await bundlrTx.sign();
                await bundlrTx.upload();
                const tx = await storageContract?.set(bundlrTx.id);
                await tx.wait(1);
                await fetchDatabase();
                setDatasetRemoveKey("");
              }}>
                Remove
              </Button>
              <Paragraph2>Read Key</Paragraph2>
              <Input
                  value={databaseReadKey}
                  onChange={e => setDatabaseReadKey((e.currentTarget as HTMLInputElement).value)}
                  size={SIZE.compact}
                  placeholder="Key"
                  clearOnEscape
              />
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                await fetchDatabase();
                setDatabaseReadValue((databaseReadKey in database) ?
                    // @ts-ignore
                    database[databaseReadKey] : "None")
                setDatabaseReadKey("");
              }}>
                Read
              </Button>
              <ParagraphSmall>
                Value: {databaseReadValue}
              </ParagraphSmall>
            </div>
        )}
      </HeadingLevel>
    </Block>
  );
}

export default App;
