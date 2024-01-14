const { ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

const BASE_FEE = ethers.parseEther("0.25") // 0.25 is the premium link, it cost 025 LINK
const GAS_PRICE_LINK = 1e9

module.exports = async ({ getNamedAccounts, deployments }) => {
    const args = [BASE_FEE, GAS_PRICE_LINK]
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    if (developmentChains.includes(network.name)) {
        log("Local network detected, now deploying")

        await deploy("VRFCoordinatorV2Mock", {
            /*contract: "VRFCoordinatorV2Mock",*/
            from: deployer,
            log: true,
            args: args,
        })
        log("yeees!,mock deployed")
        log("-----------------------------------------")
    }
}
module.exports.tags = ["all", "mocks"]
