const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
require("dotenv").config()

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30")
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock
    if (developmentChains.includes(network.name)) {
        const contractAddress = (await deployments.get("VRFCoordinatorV2Mock")).address
        // console.log(await deployments.get("VRFCoordinatorV2Mock"))
        vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", contractAddress)
        // console.log(vrfCoordinatorV2Mock)
        // console.log(createSubscription())
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target
        console.log(contractAddress === vrfCoordinatorV2Address)
        const trxRes = await vrfCoordinatorV2Mock.createSubscription()
        const trxReceipt = await trxRes.wait(1)
        subscriptionId = BigInt(trxReceipt.logs[0].topics[1])
        //Fund the subscription
        //On a real network, you will need LINK to fund the subscription
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinator"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    log("---------------------------------")
    log(await getNamedAccounts())
    log("---------------------------------")

    const args = [
        networkConfig[chainId]["VRFCoordinator"],
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["gasLane"],
        subscriptionId,
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["interval"],
    ]
    log("Here")
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args, //contract address from priceFeed
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
        log("Consumer is added")
    }
    log("Here")
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying.................")
        await verify(raffle.address, args)
    }
    log("-------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]
