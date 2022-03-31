import axios from 'axios';
import React, {useState} from 'react'
// @ts-ignore
import Check from 'baseui/icon/check';
// @ts-ignore
import Delete from 'baseui/icon/delete';
import {Checkbox, LABEL_PLACEMENT} from "baseui/checkbox";
import {useSnackbar} from "baseui/snackbar";
import {Heading, HeadingLevel} from 'baseui/heading'
import {Button} from "baseui/button";
import {Block} from 'baseui/block'
import {Avatar} from "baseui/avatar";
import {ProgressSteps, Step} from "baseui/progress-steps";
import {Paragraph2, ParagraphSmall} from "baseui/typography";
import {StyledLink} from "baseui/link";
import {expandBorderStyles} from 'baseui/styles';
import {Input, SIZE} from "baseui/input";
import {FileUploader} from "baseui/file-uploader";

import JSONPretty from 'react-json-pretty';
import {CodeBlock} from "react-code-blocks";
import * as sigUtil from "@metamask/eth-sig-util";
import * as ethUtil from "ethereumjs-util";
import AES from "crypto-js/aes";
import Utf8 from 'crypto-js/enc-utf8';

import {Contract, ContractFactory, providers, utils} from "ethers"
import {Web3Provider} from "@ethersproject/providers";
import {WebBundlr} from "@bundlr-network/client";
import BundlrTransaction from "@bundlr-network/client/build/common/transaction";
import BigNumber from "bignumber.js";

import contractABI from "./contracts/ArweaveStorageManagerContractABIV2.json";
import contractBytecode from "./contracts/ArweaveStorageManagerContractBytecodeV2.json";
import pngArchitecture from "./architecture.png"
import {ethers} from "ethers/lib.esm";

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

  // sharing
  const [isPublic, setPublic] = useState(false);
  const [requiredFee, setRequiredFee] = useState("");
  const [whitelist, setWhitelist] = useState([]);
  const [harvest, setHarvest] = useState("UNKNOWN");

  const [purchaseContentAddress, setPurchaseContentAddress] = useState("");
  const [isAddressPublic, setAddressPublic] = useState(false);
  const [isAddressWhitelisted, setAddressWhitelisted] = useState(false);
  const [addressRequiredFee, setAddressRequiredFee] = useState("");
  const [addressDatabase, setAddressDatabase] = useState({});
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
    } catch (e: any) {
      console.error(e);
      enqueue({
        message: e.message,
        startEnhancer: ({size}) => <Delete size={size} />,
      });
    }
    setDeploying(false);
  }

  const getData = async (txId: string) => {
    const url = `${bundlrHttpRPC}/tx/${txId}/data`;
    return (await axios.get(url)).data;
  }

  const fetchDatabase = async (targetStorage: string, encryptionKey: string) => {
    const _pointer = await storageContract?.get(targetStorage);
    let rawData = await getData(_pointer);
    if (typeof rawData === "string") {
      rawData = JSON.parse(rawData);
    }
    let dataObject, _password;
    if (enableEncryption && rawData.encrypted) {
      if (!(encryptionKey in rawData.access)) {
        return [undefined, undefined]
      }
      _password = await decryptByMetamask(rawData.access[encryptionKey]);
      dataObject = decryptWithAES(rawData.data, _password);
    } else {
      dataObject = rawData.data;
    }
    if (typeof dataObject === "string") {
      dataObject = JSON.parse(dataObject);
    }
    rawData = JSON.stringify(rawData);
    return [rawData, dataObject];
  }

  const getEncryptionPubkeyFromMetamask = async () => {
    if (typeof address === 'undefined') return;
    return await provider?.send('eth_getEncryptionPublicKey', [address]);
  }

  const encrypt = (publicKey: string, text: string) => {
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

  const getRandomPassword = () => {
    return Array(64).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
        .map(function(x) {
          return x[Math.floor(Math.random() * x.length)]
        }).join('');
  }

  const encryptWithAES = (text: string, passphrase: string) => {
    return AES.encrypt(text, passphrase).toString();
  };

  const decryptWithAES = (ciphertext: string, passphrase: string) => {
    const bytes = AES.decrypt(ciphertext, passphrase);
    return bytes.toString(Utf8);
  };

  const processData = async (data: string, key: string, initialize: boolean = false) => {
    let _data = data;
    let _password = getRandomPassword();
    const wrappedData = {
      access: {},
      data: _data,
      encrypted: false,
    }
    if (enableEncryption) {
      wrappedData.encrypted = true;
      wrappedData.data = encryptWithAES(data, _password);
      // @ts-ignore
      wrappedData.access[key] = encrypt(key, _password);
      if (!initialize) {
        const otherPubkeys = await storageContract?.getPubkeys();
        for (const pubkey of otherPubkeys) {
//      @ts-ignore
          wrappedData.access[pubkey] = encrypt(pubkey, _password);
        }
      }
    }
    return JSON.stringify(wrappedData)
  }

  // @ts-ignore
  return (
    <Block width="500px">
      <HeadingLevel>
        <Heading>Welcome to BABO</Heading>
        <Paragraph2>
          In this demo web application, you can interact with Arweave with just your BABO wallet, powered by Bundlr Network.
          This demo runs on BABO Rinkeby Testnet, you can bridge your ETH Rinkeby tokens to BABO Rinkeby using <a href="https://gateway.rinkeby.boba.network/">BABO Gateway</a>
        </Paragraph2>
        <Paragraph2>
          Here is our whole story:
        </Paragraph2>
        <img src={pngArchitecture} alt={"Architecture"} style={{height: "100%", width: "100%"}}/>
        <HeadingLevel><Heading>Read File</Heading></HeadingLevel>
        <ParagraphSmall>
          In this section you would be able to access files stored on Arweave by providing ID.
        </ParagraphSmall>
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
        <Paragraph2>
          In this section you would be able to upload your file to Arweave for permanent storing. You don't need to prepare an AR wallet or to purchase AR token for gas fee, all you need is a BABO wallet with some ETH tokens.
        </Paragraph2>
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
        <Paragraph2>
          As it can be seen from previous section, every time the content is changed, the ID is changed as well, making the file difficult to follow on Arweave. To address problem, we can deploy a simple contract to store the current Arweave ID, like a pointer in RAM.
          The reason we don't use GraphQL tags here is that its index may cause additional time, making the latency larger.
        </Paragraph2>
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
            <Button size="compact" isLoading={isDeploying} onClick={async () => {
              await deployContract();
              setPointerStep(pointerStep + 1);
            }}>
              Deploy
            </Button>
          </Step>
          <Step title="Write/Read the contract">
            <p>Your Contract Address: {contractAddress}</p>
            <ParagraphSmall>Read your Arweave pointer: {storageGetPointer}</ParagraphSmall>
            <Button size="compact" onClick={async () => {
              const _pointer = await storageContract?.get(address);
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
        <Paragraph2>
          By combining BOBA, Bundlr and Arweave together, we can build a database that lives on-chain.
        </Paragraph2>
        <ParagraphSmall>
          To prevent raw user data from directly exposing to the general public, it is optional to enable encryption. The encryption is achieved by Elliptic-curve Diffie–Hellman (ECDH) with AES. That is, message is encrypted by AES, and the passphrase for AES encryption is also encrypted by user's public key. The reason of using two encryption here is 1. to reduce encrypted message size (AES) and therefore reduce fee, and 2. for latter usage, you will know it very soon. Note that we derive user's public key by calling RPC method provided by Metamask Desktop, consequently, currently database encryption can only be enabled with Metamask Desktop.
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
            <ParagraphSmall>Or deploy one right now</ParagraphSmall>
            <Button size="compact" isLoading={isDeploying} onClick={async () => {
              await deployContract();
              setDatabaseStep(databaseStep + 1);
            }}>
              Deploy
            </Button>
          </Step>
          <Step title="Fund Your Wallet">
            <p>Your Contract Address: {contractAddress}</p>
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
            <ParagraphSmall>Your Balance: {bundlr?.utils.unitConverter(bundlrBalance).toString()}</ParagraphSmall>
            <Button size="compact" onClick={async () => {
              setBundlrBalance(await bundlr?.getLoadedBalance() || new BigNumber(0));
            }}>
              Check Balance
            </Button>
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
              if (typeof address === 'undefined') return;
              setPending(true);
              setFetching(true);
              try {
                let _encryptionPubkey;
                if (enableEncryption) {
                  _encryptionPubkey = await getEncryptionPubkeyFromMetamask();
                  setEncryptionPubkey(_encryptionPubkey);
                }
                const bundlrTx = bundlr.createTransaction(await processData("{}", _encryptionPubkey, true));
                await bundlrTx.sign();
                await bundlrTx.upload();
                const tx = await storageContract?.set(bundlrTx.id);
                await tx.wait(1);

                const [rawData, dataObject] = await fetchDatabase(address, _encryptionPubkey);
                setRawDatabase(rawData);
                setDatabase(dataObject);
                setDatabaseStep(databaseStep + 1);
              } catch (e: any) {
                console.error(e);
                enqueue({
                  message: e.message,
                  startEnhancer: ({size}) => <Delete size={size} />,
                })
              }
              setFetching(false);
              setPending(false);
            }}>
              Initialize Database
            </Button>
            <Button size="compact" isLoading={isFunding} onClick={async () => {
              if (typeof address === 'undefined') return;
              let _encryptionPubkey;
              if (enableEncryption) {
                _encryptionPubkey = await getEncryptionPubkeyFromMetamask();
                setEncryptionPubkey(_encryptionPubkey);
              }
              setFetching(true);
              const [rawData, dataObject] = await fetchDatabase(address, _encryptionPubkey);
              setRawDatabase(rawData);
              setDatabase(dataObject);
              setFetching(false);
              setDatabaseStep(databaseStep + 1);
            }}>
              Skip
            </Button>
          </Step>
        </ProgressSteps>
        {databaseStep >= 5 ? (
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
              <JSONPretty id="json-pretty-1" data={database}/>
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
                if (typeof address === 'undefined') return;
                setFetching(true);
                const [, _data] = await fetchDatabase(address, encryptionPubkey);

                _data[databaseWriteKey] = databaseWriteValue;
                const bundlrTx = bundlr.createTransaction(await processData(JSON.stringify(_data), encryptionPubkey));
                await bundlrTx.sign();
                await bundlrTx.upload();
                const tx = await storageContract?.set(bundlrTx.id);
                await tx.wait(1);

                const [rawData, dataObject] = await fetchDatabase(address, encryptionPubkey);
                setRawDatabase(rawData);
                setDatabase(dataObject);
                setFetching(false);
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
                if (typeof address === 'undefined') return;
                setFetching(true);
                const [, _data] = await fetchDatabase(address, encryptionPubkey);
                if (!(databaseRemoveKey in _data)) {
                  return;
                }
                delete _data[databaseRemoveKey];
                const bundlrTx = bundlr.createTransaction(await processData(JSON.stringify(_data), encryptionPubkey));
                await bundlrTx.sign();
                await bundlrTx.upload();
                const tx = await storageContract?.set(bundlrTx.id);
                await tx.wait(1);

                const [rawData, dataObject] = await fetchDatabase(address, encryptionPubkey);
                setRawDatabase(rawData);
                setDatabase(dataObject);
                setFetching(false);
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
                if (typeof address === 'undefined') return;
                setFetching(true);
                const [rawData, dataObject] = await fetchDatabase(address, encryptionPubkey);
                setRawDatabase(rawData);
                setDatabase(dataObject);
                setFetching(false);
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
              <ParagraphSmall>
                So far, we have a working database alike interface for individuals to do CRUD directly to the blockchain. Everything here is decentralized, from content creating to content distributing. A question raises: can we go one step further?
              </ParagraphSmall>
              <HeadingLevel><Heading>A POC for Decentralized Cloud Drive: Creating and Sharing</Heading></HeadingLevel>
              <Paragraph2>
                As a content creator, you can share you content with others by making it public in the ArweaveStorageManagerContract. You can specify a fee to take if others want to see your content.
              </Paragraph2>
              <Paragraph2>When others want to see your content, they will pay your required fee to gain access. However, this access will only take effect from the next time you update the content. Consequently, content owners are required to update their content after users purchasing in order to withdraw the earned fee.</Paragraph2>
              <ParagraphSmall>Your Storage is {isPublic ? "Public" : "Private"}</ParagraphSmall>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                const _public = await storageContract?.isPublic(address);
                setPublic(_public);
              }}>
                Check Visibility
              </Button>
              <div style={{marginTop: 8, marginBottom: 8}}/>
              {!isPublic ? (
                  <div>
                    <Input
                        value={requiredFee}
                        onChange={e => setRequiredFee((e.currentTarget as HTMLInputElement).value)}
                        size={SIZE.compact}
                        placeholder="0.001 (ETH)"
                        clearOnEscape
                    />
                    <div style={{marginTop: 8, marginBottom: 8}}/>
                    <Button size="compact" isLoading={isFetching} onClick={async () => {
                      setFetching(true);
                      const _public = await storageContract?.isPublic(address);
                      setPublic(_public);
                      if (isPublic) {
                        setFetching(false);
                        return;
                      }
                      try {
                        const tx = await storageContract?.permitSharing(ethers.utils.parseEther(requiredFee));
                        await tx.wait(1);
                      } catch (e: any) {
                        console.error(e);
                        enqueue({
                          message: e.message,
                          startEnhancer: ({size}) => <Delete size={size} />,
                        })
                      }
                      setFetching(false);
                      setPublic(await storageContract?.isPublic(address));
                    }}>
                      Set to Public
                    </Button>
                  </div>
              ) : (
                  <Button size="compact" isLoading={isFetching} onClick={async () => {
                    const _public = await storageContract?.isPublic(address);
                    setPublic(_public);
                    if (!isPublic) {
                      setFetching(false);
                      return;
                    }
                    try {
                      const tx = await storageContract?.closeSharing();
                      await tx.wait(1);
                    } catch (e: any) {
                      console.error(e);
                      enqueue({
                        message: e.message,
                        startEnhancer: ({size}) => <Delete size={size} />,
                      })
                    }
                    setFetching(false);
                    setPublic(await storageContract?.isPublic(address));
                  }}>
                    Set to Private
                  </Button>
              )}
              <ParagraphSmall>Whitelisted Users for You Content</ParagraphSmall>
              <JSONPretty id="json-pretty-2" data={whitelist}/>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                const _whitelist = await storageContract?.getPubkeys();
                setWhitelist(_whitelist)
              }}>
                Get Whitelist
              </Button>
              <ParagraphSmall>You can harvest {harvest} ETH</ParagraphSmall>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                const _harvest = await storageContract?.getUnharvested(address);
                setHarvest(ethers.utils.formatEther(_harvest))
              }}>
                Get Harvest
              </Button>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                setFetching(true);
                try {
                  const tx = await storageContract?.harvest();
                  await tx.wait(1);
                } catch (e: any) {
                  console.error(e);
                  enqueue({
                    message: e.message,
                    startEnhancer: ({size}) => <Delete size={size} />,
                  })
                }
                const _harvest = await storageContract?.getUnharvested(address);
                setHarvest(ethers.utils.formatEther(_harvest))
                setFetching(false);
              }}>
                Harvest All
              </Button>
              <Paragraph2>
                On the other hand, you can also purchase access to other users' content.
              </Paragraph2>
              <ParagraphSmall>Purchase Access</ParagraphSmall>
              <Input
                  value={purchaseContentAddress}
                  onChange={e => setPurchaseContentAddress((e.currentTarget as HTMLInputElement).value)}
                  size={SIZE.compact}
                  placeholder="0x..."
                  clearOnEscape
              />
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <ParagraphSmall>{purchaseContentAddress} Storage is {isAddressPublic ? "Public" : "Private"}, You are {isAddressWhitelisted ? "Whitelisted" : "Not Whitelisted"}</ParagraphSmall>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                const _public = await storageContract?.isPublic(purchaseContentAddress);
                const _whitelist = await storageContract?.checkWhitelisted(purchaseContentAddress);
                setAddressPublic(_public);
                setAddressWhitelisted(_whitelist);
              }}>
                Check Visibility
              </Button>
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <ParagraphSmall>Fee: {addressRequiredFee} ETH</ParagraphSmall>
              <Button size="compact" isLoading={isFetching} onClick={async () => {
                const _fee = await storageContract?.getFee(purchaseContentAddress);
                setAddressRequiredFee(ethers.utils.formatEther(_fee));
              }}>
                Check Fee
              </Button>
              <div style={{marginTop: 8, marginBottom: 8}}/>
              <Button size="compact" disabled={!isAddressPublic || isAddressWhitelisted} isLoading={isFetching} onClick={async () => {
                const _fee = await storageContract?.getFee(purchaseContentAddress);
                setAddressRequiredFee(ethers.utils.formatEther(_fee));
                try {
                  const tx = await storageContract?.addWhitelist(
                      utils.getAddress(purchaseContentAddress),
                      await getEncryptionPubkeyFromMetamask(),
                      {
                        value: _fee,
                      }
                  );
                  await tx.wait(1);
                  setAddressWhitelisted(true);
                } catch (e: any) {
                  console.error(e);
                  enqueue({
                    message: e.message,
                    startEnhancer: ({size}) => <Delete size={size} />,
                  })
                }
              }}>
                Purchase
              </Button>
              <ParagraphSmall>Read Purchased Database</ParagraphSmall>
              <JSONPretty id="json-pretty-3" data={addressDatabase}/>
              <Button size="compact" disabled={!isAddressPublic || !isAddressWhitelisted} isLoading={isFetching} onClick={async () => {
                setFetching(true);
                const [, dataObject] = await fetchDatabase(purchaseContentAddress, encryptionPubkey);
                if (typeof dataObject === 'undefined') {
                  setAddressDatabase({
                    "message": "waiting for the file owner to update..."
                  });
                } else {
                  setAddressDatabase(dataObject);
                }
                setFetching(false);
              }}>
                Read Database
              </Button>
              <ParagraphSmall>If you are tired of waiting, you can withdraw your fee back as long as you still don't have access to purchased content (i.e. content is not updated)</ParagraphSmall>
              <Button size="compact" disabled={!isAddressPublic || !isAddressWhitelisted} isLoading={isFetching} onClick={async () => {
                setFetching(true);
                try {
                  const tx = await storageContract?.withdraw(purchaseContentAddress);
                  await tx.wait(1);
                  setAddressWhitelisted(false);
                } catch (e: any) {
                  console.error(e);
                  enqueue({
                    message: e.message,
                    startEnhancer: ({size}) => <Delete size={size} />,
                  })
                }
                setFetching(false);
              }}>
                Withdraw
              </Button>
            </div>
        ) : (
            <div>
              <HeadingLevel><Heading>There are something hidden here...</Heading></HeadingLevel>
              <Paragraph2>Please complete the `Database Initialization` section to reveal ;)</Paragraph2>
            </div>
        )}
        <div style={{marginTop: 64, marginBottom: 64}}/>
      </HeadingLevel>
    </Block>
  );
}

export default App;
